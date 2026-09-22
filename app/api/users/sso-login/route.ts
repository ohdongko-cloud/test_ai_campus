import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { sql } from '../../../../lib/db';
import { hashPassword } from '../../../../lib/password';
import { setUserSessionCookie } from '../../../../lib/session';
import { checkRateLimit, getClientIp, tooManyRequests } from '../../../../lib/ratelimit';
import { logAuth } from '../../../../lib/audit';
import { reportError } from '../../../../lib/error-report';
import { isAllowedSignupEmail } from '../../../../lib/email-allowlist';
import {
  verifyNoaIdToken,
  consumeIdTokenJti,
  noaSsoConfig,
  lookupDirectoryUser,
  NoaDirectoryUnavailableError,
} from '../../../../lib/noa-sso';

// POST /api/users/sso-login  body: { idToken, rememberMe? }
//
// 사내 통합계정(NoA Vibe Keycloak) SSO 브리지 로그인.
// 브라우저가 lib/noa-oidc.ts의 PKCE 플로우로 Keycloak과 직접 교환해 들고 있는 id_token을
// 보내면, 서버가 서명·클레임을 직접 검증한 뒤(클라이언트가 보낸 값은 절대 신뢰하지 않음) 기존
// lib/session.ts httpOnly JWT 앱 세션을 그대로 발급한다(브리지 방식 — CLAUDE.md §6-4).
//
// 디렉터리 조회(lib/noa-directory.ts, 서버 전용 — 원래 @noa/auth-sdk/server의 와이어 계약을
// 이식한 것)는 lib/noa-sso.ts로 이전됐다 — email 클레임이 없거나 미검증일 때 권위 있는 email을
// 얻는 데도 쓰이고(F1), 여기서는 그 결과를 재사용해 프로비저닝 부가 필드(소속·직급 등)를
// 채운다(F11, 이중 조회 방지).
const SSO_LOGIN_FAILURE_MESSAGE = '사내 계정 인증에 실패했습니다.';

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit('user-sso-login', ip, 10, '5 m');
  if (!rl.success) {
    await logAuth({ type: 'rate_limited', success: false, req, detail: 'user-sso-login' });
    return tooManyRequests();
  }

  // F14: 로그인 CSRF 차단 — body를 파싱하기 전에 동일 오리진인지 먼저 본다. 유일한 정상 호출자는
  // /auth/callback의 동일 오리진 fetch(항상 Origin 헤더를 보낸다). Origin이 없는 구형 클라이언트는
  // Sec-Fetch-Site로 보조 판단하고, 그마저 판단이 서지 않으면 거부한다.
  const origin = req.headers.get('origin');
  let sameOrigin: boolean;
  if (origin) {
    try {
      sameOrigin = new URL(origin).host === req.nextUrl.host;
    } catch {
      sameOrigin = false;
    }
  } else {
    sameOrigin = req.headers.get('sec-fetch-site') === 'same-origin';
  }
  if (!sameOrigin) {
    await logAuth({ type: 'login_failure', success: false, req, detail: 'sso-cross-origin' });
    return NextResponse.json({ error: SSO_LOGIN_FAILURE_MESSAGE }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const idToken = typeof body?.idToken === 'string' ? body.idToken : '';
  // 인가 요청에 실려 나갔던 nonce. 검증 한계는 lib/noa-sso.ts의 nonce 검사 주석 참조.
  const nonce = typeof body?.nonce === 'string' ? body.nonce : '';
  const rememberMe = !!body?.rememberMe;

  try {
    // 1) id_token 검증 — 서명(JWKS)·iss·aud·typ·azp·exp·iat 재생창·jti 존재, 그리고 email 해석
    //    (검증된 클레임 또는 디렉터리 권위값 — 합성 없음, F1). 실패 사유는 서버 로그에만.
    let identity;
    try {
      identity = await verifyNoaIdToken(idToken, nonce || undefined);
    } catch (e) {
      // N2: 디렉터리 장애(브로커 401/타임아웃 등)는 사용자 토큰 자체가 무효한 경우와 원인이
      // 다르다 — 감사로그 detail을 구분해야 "email 미검증 임직원 전원 로그인 불가"가
      // 'sso-token-invalid'로 오기록되지 않는다. reportError는 lib/noa-sso.ts에서 이미 수행.
      const detail =
        e instanceof NoaDirectoryUnavailableError ? 'sso-directory-unavailable' : 'sso-token-invalid';
      await logAuth({ type: 'login_failure', success: false, req, detail });
      return NextResponse.json({ error: SSO_LOGIN_FAILURE_MESSAGE }, { status: 401 });
    }

    // 2) jti 1회성 사용 보장(재생 공격 차단). 저장소 오류(error)와 실제 재생(replay)을 구분해
    //    기록한다(F8/F9) — 어느 쪽이든 fail-closed로 401은 동일하다.
    const consumeResult = await consumeIdTokenJti(identity.jti, identity.exp);
    // strict:false(strictNullChecks off) 하에서는 `!consumeResult.ok`가 판별유니온을 좁히지 못해
    // reason 접근이 컴파일 에러가 난다 — 반드시 `=== false`로 비교할 것(tsc로 실측 확인됨).
    if (consumeResult.ok === false) {
      const detail = consumeResult.reason === 'replay' ? 'sso-token-replay' : 'sso-jti-store-error';
      await logAuth({ type: 'login_failure', email: identity.email, success: false, req, detail });
      return NextResponse.json({ error: SSO_LOGIN_FAILURE_MESSAGE }, { status: 401 });
    }

    // 3) 가입 허용 도메인(§6-1) — 공용 isAllowedSignupEmail(앵커 정규식)로 통일한다(F1-b).
    //    endsWith는 `x@eland.co.kr@eland.co.kr` 같은 값도 통과시킨다.
    if (!isAllowedSignupEmail(identity.email)) {
      await logAuth({ type: 'login_failure', email: identity.email, success: false, req, detail: 'sso-domain' });
      return NextResponse.json({ error: SSO_LOGIN_FAILURE_MESSAGE }, { status: 401 });
    }

    // 4) 사용자 조회 — 없으면 자동 프로비저닝
    let rows = await sql`
      SELECT id, name, corporation_name, organization_name, position, email
      FROM users
      WHERE email = ${identity.email}
      LIMIT 1`;

    if (rows.length === 0) {
      let corporationName = '-';
      let organizationName = '-';
      let position = '-';
      let name = identity.name;

      // F1 단계에서 이미 디렉터리를 조회했다면(email 클레임이 없거나 미검증이었던 경로) 그 결과를
      // 재사용해 동일 사용자를 두 번 조회하지 않는다. 조회한 적이 없다면(email 클레임이 검증된
      // 상태로 바로 확정된 경로) 프로비저닝 부가 필드용으로 여기서 한 번 조회한다.
      let dirUser = identity.directoryUser;
      if (dirUser === undefined) {
        const cfg = noaSsoConfig();
        if (cfg.enabled && cfg.directoryUrl) {
          try {
            dirUser = await lookupDirectoryUser(cfg, identity.username);
          } catch (e) {
            // F11: 타임아웃/오류 — id_token 클레임의 name만 사용하고 나머지는 '-' 폴백
            // (가입 자체는 계속 진행한다. 이메일 해석과 달리 여기서는 거부하지 않는다).
            // N5: 예전엔 이 실패가 통째로 삼켜져 브로커 장애 중 가입한 임직원의 소속·직급이
            // '-'로 영구 고착돼도 아무 데도 남지 않았다. Sentry로는 보고하되 가입은 계속 진행.
            reportError(e, { route: 'users/sso-login/provision-directory' });
            dirUser = null;
          }
        } else {
          dirUser = null;
        }
      }

      if (dirUser) {
        name = dirUser.name || name;
        corporationName = dirUser.companyName || corporationName;
        organizationName = dirUser.deptName || organizationName;
        position = dirUser.positionName || position;
      }

      // 아무도 모르는 임의 비밀번호를 bcrypt로 해시 — 비번 로그인 불가(SSO 전용 계정), 스키마 변경 불필요.
      const randomPasswordHash = await hashPassword(randomBytes(32).toString('hex'));

      await sql`
        INSERT INTO users (name, corporation_name, organization_name, position, email, password_hash)
        VALUES (${name}, ${corporationName}, ${organizationName}, ${position}, ${identity.email}, ${randomPasswordHash})
        ON CONFLICT (email) DO NOTHING`;

      rows = await sql`
        SELECT id, name, corporation_name, organization_name, position, email
        FROM users
        WHERE email = ${identity.email}
        LIMIT 1`;

      if (rows.length === 0) {
        // 경합 등으로 재조회에도 없으면 서버 오류로 처리
        throw new Error('noa-sso: user provisioning failed');
      }

      await logAuth({ type: 'signup_complete', email: identity.email, success: true, req, detail: 'sso-provision' });
    } else {
      // N5: 프로비저닝 당시 디렉터리 장애로 '-' 폴백이 그대로 INSERT되면, 신규 분기를 다시
      // 타지 않는 기존 사용자 경로에서는 지금까지 영원히 갱신될 방법이 없었다(운영 약 1,800명
      // 테이블에 복구 트리거 없는 오염 행). 세 필드 중 하나라도 '-'면 1회 백필을 시도한다.
      // 실패는 무시하고 로그인은 계속 진행 — 디렉터리가 이미 캐시돼 있으면(identity.directoryUser)
      // 재조회하지 않는다.
      const existing = rows[0];
      const needsBackfill =
        existing.corporation_name === '-' || existing.organization_name === '-' || existing.position === '-';

      if (needsBackfill) {
        let dirUser = identity.directoryUser;
        if (dirUser === undefined) {
          const cfg = noaSsoConfig();
          if (cfg.enabled && cfg.directoryUrl) {
            try {
              dirUser = await lookupDirectoryUser(cfg, identity.username);
            } catch (e) {
              reportError(e, { route: 'users/sso-login/backfill-directory' });
              dirUser = null;
            }
          } else {
            dirUser = null;
          }
        }

        if (dirUser) {
          const newCorp = existing.corporation_name === '-' ? dirUser.companyName || null : null;
          const newOrg = existing.organization_name === '-' ? dirUser.deptName || null : null;
          const newPos = existing.position === '-' ? dirUser.positionName || null : null;

          if (newCorp || newOrg || newPos) {
            try {
              await sql`
                UPDATE users SET
                  corporation_name = COALESCE(${newCorp}::text, corporation_name),
                  organization_name = COALESCE(${newOrg}::text, organization_name),
                  position = COALESCE(${newPos}::text, position)
                WHERE id = ${existing.id}`;

              rows = await sql`
                SELECT id, name, corporation_name, organization_name, position, email
                FROM users
                WHERE email = ${identity.email}
                LIMIT 1`;
            } catch (e) {
              reportError(e, { route: 'users/sso-login/backfill-update' });
              // 백필 실패는 무시 — 로그인 자체는 계속 진행한다.
            }
          }
        }
      }
    }

    const u = rows[0];

    // 5) 앱 세션 발급 — 기존 로그인과 동일한 httpOnly JWT
    await setUserSessionCookie(u.id, u.email, rememberMe);
    await logAuth({ type: 'login_success', email: identity.email, success: true, req, detail: 'sso' });

    // PII(이메일·이름·소속·직급) 응답 — no-store (§6-7). 기존 /api/users/login과 동일 필드 모양.
    return NextResponse.json({
      id: u.id,
      nickname: u.name,
      email: u.email,
      corporationName: u.corporation_name,
      organizationName: u.organization_name,
      position: u.position,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    reportError(e, { route: 'users/sso-login' });
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
