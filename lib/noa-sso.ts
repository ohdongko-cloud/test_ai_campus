// 사내 통합계정(NoA Vibe Keycloak) SSO 서버측 토큰 검증 헬퍼.
//
// 브라우저는 lib/noa-oidc.ts의 PKCE 플로우로 Keycloak과 직접 토큰을 교환해 id_token을
// 받아온다. 즉 서버 입장에서 id_token은 "클라이언트가 보낸 값"에 불과하므로 절대 그대로
// 신뢰하지 않고, 여기서 서명(JWKS)·iss·aud·typ·azp·iat·nonce·jti를 전부 직접 검증한다.
//
// 앱 세션은 이 결과로 기존 lib/session.ts httpOnly JWT를 발급한다(브리지 방식).
import { createRemoteJWKSet, jwtVerify } from 'jose';
// lib/noa-directory.ts는 서버 전용이다(모듈이 window 존재를 보고 throw). 이 파일은
// route.ts(서버 라우트)에서만 import되므로 안전하다. 클라이언트 컴포넌트에서 이 파일을
// import하지 말 것.
import { getDirectoryUser, type DirectoryUser } from './noa-directory';
import { sql } from './db';
import { reportError } from './error-report';

/**
 * N2: 디렉터리 조회 실패를 verifyNoaIdToken 호출부(route.ts)가 "토큰 자체가 무효"인 경우와
 * 구분할 수 있게 하는 마커. NOA_AUTH_DIRECTORY_TOKEN 만료/로테이트로 브로커가 401을 주면
 * email 클레임이 없거나 미검증인 임직원 전원이 로그인 불가가 되는데, 원인을 구분하지 않으면
 * 감사로그에는 'sso-token-invalid'(사용자 토큰 문제)로 오기록되고 Sentry에는 아무것도 안 남는다.
 */
export class NoaDirectoryUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'NoaDirectoryUnavailableError';
  }
}

export interface NoaSsoConfig {
  /** Keycloak realm issuer. 끝 '/' 제거됨. */
  issuer: string;
  clientId: string;
  integrationId: string;
  directoryUrl: string;
  /** 배포 env(NOA_AUTH_*)가 하나라도 없으면 false — 그 경우 로그인은 항상 거부(휴면). */
  enabled: boolean;
}

/**
 * NoA SSO 설정 조회. 코드에 issuer·clientId 등을 하드코딩하지 않고 항상 process.env에서 읽는다
 * (배포 Lambda가 런타임에 주입 — 값 자체는 공개값이지만 하드코딩 시 환경별 분기가 깨진다).
 * env가 비어 있으면 enabled=false로 휴면 동작(기존 SSO 허브 env-미설정 시 휴면 패턴과 동일).
 */
export function noaSsoConfig(): NoaSsoConfig {
  const issuer = (process.env.NOA_AUTH_ISSUER ?? '').trim().replace(/\/+$/, '');
  const clientId = (process.env.NOA_AUTH_CLIENT_ID ?? '').trim();
  const integrationId = (process.env.NOA_AUTH_INTEGRATION_ID ?? '').trim();
  const directoryUrl = (process.env.NOA_AUTH_DIRECTORY_URL ?? '').trim();
  const enabled = Boolean(issuer && clientId && integrationId);
  return { issuer, clientId, integrationId, directoryUrl, enabled };
}

// JWKS 리졸버는 모듈 레벨에서 issuer당 1회만 생성해 재사용한다(요청마다 새로 만들면
// jose 내부 캐시가 매번 비어 로그인 1건마다 Keycloak JWKS를 재조회하게 된다).
// issuer를 키로 들고 있어 로컬에서 env가 바뀌어도 안전하다.
let jwksCache: { issuer: string; resolver: ReturnType<typeof createRemoteJWKSet> } | null = null;

function getJwks(issuer: string): ReturnType<typeof createRemoteJWKSet> {
  if (jwksCache && jwksCache.issuer === issuer) return jwksCache.resolver;
  const url = new URL(`${issuer}/protocol/openid-connect/certs`);
  const resolver = createRemoteJWKSet(url, {
    cacheMaxAge: 600_000,
    cooldownDuration: 30_000,
    timeoutDuration: 5_000,
  });
  jwksCache = { issuer, resolver };
  return resolver;
}

// F11: 디렉터리 브로커가 응답하지 않으면 Lambda maxDuration까지 매달리고 의도한 실패 폴백이
// 실행되지 않는다. lib/noa-directory.ts가 AbortController로 요청 자체를 끊는다(구 SDK의
// fetch에는 signal도 timeout도 없어 Promise.race로 감싸야 했다).
const DIRECTORY_TIMEOUT_MS = 5_000;

/**
 * 디렉터리 사용자 조회(5초 타임아웃 포함). 정상 응답(404는 null)이면 DirectoryUser|null을
 * 반환하고, 타임아웃·네트워크 오류·설정 누락은 모두 throw한다.
 * 실패 시 정책(로그인 거부할지 '-' 필드 폴백으로 넘어갈지)은 호출부가 정한다 — 이 함수는
 * 판단하지 않는다.
 */
export async function lookupDirectoryUser(cfg: NoaSsoConfig, username: string): Promise<DirectoryUser | null> {
  if (!cfg.directoryUrl) {
    throw new Error('noa-sso: directory url not configured');
  }
  return await getDirectoryUser(
    { integrationId: cfg.integrationId, baseUrl: cfg.directoryUrl, timeoutMs: DIRECTORY_TIMEOUT_MS },
    username,
  );
}

export interface NoaIdentity {
  username: string;
  name: string;
  /**
   * 계정 결속에 쓰는 이메일. 소문자·trim 완료. 둘 중 하나로만 채워진다 — 그 외에는 절대
   * 합성하지 않는다(F1):
   *   1) id_token의 email 클레임 + email_verified === true
   *   2) 위가 없거나 미검증이면 서버측 디렉터리 조회(getDirectoryUser)의 email
   * 둘 다 실패하면 verifyNoaIdToken이 throw하여 로그인을 거부한다.
   *
   * 잔여 위험(범위 밖): 결속 키가 여전히 email이라 사용자가 이후 email을 바꾸면 재바인딩된다.
   * 불변 식별자(sub) 결속으로 전환하려면 users.noa_sub 컬럼 마이그레이션이 필요하며 이번
   * 수정 범위 밖이다.
   */
  email: string;
  /**
   * email 해석 과정에서 디렉터리 조회가 이미 발생했다면 그 결과(성공/404 모두)를 담아 둔다.
   * 호출부(route.ts 프로비저닝)가 같은 사용자를 위해 디렉터리를 다시 조회하지 않도록 재사용한다.
   * 조회 자체가 없었다면(email 클레임이 검증된 상태로 바로 확정) undefined.
   */
  directoryUser?: DirectoryUser | null;
  jti: string;
  /** 검증된 exp(epoch seconds). consumeIdTokenJti의 expires_at 계산에 사용. */
  exp: number;
}

/** id_token 재생 창 축소 — exp까지 전체 구간이 아니라 발급 직후 ±120초만 유효로 본다. */
const IAT_SKEW_SECONDS = 120;

/**
 * id_token 검증. 실패 사유별로 구분해 throw하되(디버깅용), 호출부(라우트)는 이유와 무관하게
 * 사용자에게는 통일된 401 메시지만 노출해야 한다(§6-8, 원문 예외 메시지를 응답에 싣지 말 것).
 */
export async function verifyNoaIdToken(idToken: string, expectedNonce?: string): Promise<NoaIdentity> {
  const cfg = noaSsoConfig();
  if (!cfg.enabled) {
    throw new Error('noa-sso: disabled (env missing)');
  }

  const { payload } = await jwtVerify(idToken, getJwks(cfg.issuer), {
    algorithms: ['RS256'],
    issuer: cfg.issuer,
    audience: cfg.clientId,
    // exp는 jose 기본 검증에 포함됨.
  });

  // F13: typ/azp 검증 — 같은 realm의 다른 클라이언트가 발급한 access_token(또는 형제 클라이언트의
  // id_token)이 우리 clientId를 aud에 담고 있다는 이유만으로 통과하는 것을 막는다.
  // Keycloak ID 토큰은 typ="ID"(액세스 토큰은 "Bearer"), azp 검증은 OIDC Core 3.1.3.7-4 요구사항.
  if (payload.typ !== 'ID') {
    throw new Error('noa-sso: unexpected token typ (not an ID token)');
  }
  if (typeof payload.azp === 'string' && payload.azp !== cfg.clientId) {
    throw new Error('noa-sso: azp mismatch');
  }

  // nonce — lib/noa-oidc.ts가 인가 요청에 실어 보낸 값이 그대로 돌아왔는지 본다(OIDC Core 3.1.3.7-11).
  // 한계를 분명히 해 둔다: 기대값을 서버가 따로 보관하지 않고 클라이언트가 함께 보내므로,
  // 악의적 클라이언트는 토큰과 nonce를 둘 다 제시할 수 있다. **재생 방지의 1차 통제는 아래
  // consumeIdTokenJti(jti 1회 소비)** 이고 이 검사는 그 위의 방어층이다.
  if (expectedNonce) {
    if (typeof payload.nonce !== 'string' || payload.nonce !== expectedNonce) {
      throw new Error('noa-sso: nonce mismatch');
    }
  }

  const iat = typeof payload.iat === 'number' ? payload.iat : null;
  if (iat === null) {
    throw new Error('noa-sso: iat claim missing');
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - iat) > IAT_SKEW_SECONDS) {
    throw new Error('noa-sso: iat outside allowed skew');
  }

  const jti = typeof payload.jti === 'string' ? payload.jti.trim() : '';
  if (!jti) {
    throw new Error('noa-sso: jti claim missing');
  }

  const username = typeof payload.preferred_username === 'string' ? payload.preferred_username.trim() : '';
  if (!username) {
    throw new Error('noa-sso: preferred_username claim missing');
  }

  const name = typeof payload.name === 'string' && payload.name.trim() ? payload.name.trim() : username;

  // F1: email 합성 폴백 전면 제거(구 코드는 클레임이 없으면 `${username}@eland.co.kr`을 만들어냈다 —
  // 그 결과 §6-1 도메인 게이트가 이 경로에서 구조적으로 절대 실패할 수 없었다). 3단계 순서를 지킨다:
  //   1) email 클레임 + email_verified === true
  //   2) 서버측 디렉터리 조회(getDirectoryUser)의 email
  //   3) 둘 다 없으면 거부(throw) — 절대 합성하지 않는다.
  const rawEmailClaim = typeof payload.email === 'string' ? payload.email.trim() : '';
  const emailVerified = payload.email_verified === true;

  let email: string;
  let directoryUser: DirectoryUser | null | undefined;

  if (rawEmailClaim && emailVerified) {
    email = rawEmailClaim.toLowerCase();
  } else {
    let dirUser: DirectoryUser | null;
    try {
      dirUser = await lookupDirectoryUser(cfg, username);
    } catch (e) {
      // 타임아웃/디렉터리 오류/설정 누락 — 권위 있는 email을 얻을 방법이 없으므로 거부한다
      // (F11: 여기서는 '-' 폴백을 쓰지 않는다. 그건 프로비저닝 부가 필드 전용 정책이다).
      // N2: 원본 오류를 버리지 않는다 — Sentry로 보고하고 cause로 보존하며, 전용 에러 타입으로
      // route.ts가 "토큰 무효"와 "디렉터리 장애"를 감사로그에서 구분할 수 있게 한다.
      reportError(e, { route: 'noa-sso/directory-lookup' });
      throw new NoaDirectoryUnavailableError(
        'noa-sso: directory lookup failed or timed out while resolving email',
        { cause: e },
      );
    }
    directoryUser = dirUser;
    const dirEmail = dirUser?.email?.trim();
    if (!dirEmail) {
      throw new Error('noa-sso: no verified email available (claim unverified and directory empty)');
    }
    email = dirEmail.toLowerCase();
  }

  // exp는 jose jwtVerify가 기본 검증(만료 체크)을 이미 통과시킨 값이므로 여기서는 존재 확인만.
  const exp = typeof payload.exp === 'number' ? payload.exp : null;
  if (exp === null) {
    throw new Error('noa-sso: exp claim missing');
  }

  return { username, name, email, directoryUser, jti, exp };
}

/** consumeIdTokenJti 결과. 저장소 오류(error)와 실제 재생 시도(replay)를 호출부가 구분할 수 있게 한다(F8/F9). */
export type ConsumeJtiResult =
  | { ok: true }
  | { ok: false; reason: 'replay' | 'error' };

/**
 * id_token jti 1회 사용 보장. noa_sso_used_tokens(jti PK)에 INSERT ... ON CONFLICT DO NOTHING.
 * 반환 행이 없으면(= 이미 존재) 재사용 시도 → { ok:false, reason:'replay' }.
 *
 * fail-closed는 유지한다: 테이블 부재 등 어떤 이유로든 쿼리 자체가 실패하면 "1회성 보장 여부를
 * 알 수 없다"는 뜻이므로 통과시키지 않는다 — 다만 그 경우는 { ok:false, reason:'error' }로
 * 구분해서 반환해, 호출부 감사로그가 실제 재생 공격('replay')과 저장소 오류('error')를 섞어
 * 기록하지 않도록 한다(M014 미적용 배포 시 '전 사용자 401'이 '재생 공격'으로 오기록되는 것 방지).
 * error는 Sentry로도 보고한다.
 */
export async function consumeIdTokenJti(jti: string, expEpochSec: number): Promise<ConsumeJtiResult> {
  let result: ConsumeJtiResult;
  try {
    const expiresAt = new Date(expEpochSec * 1000).toISOString();
    const rows = await sql`
      INSERT INTO noa_sso_used_tokens (jti, expires_at)
      VALUES (${jti}, ${expiresAt})
      ON CONFLICT (jti) DO NOTHING
      RETURNING jti`;

    result = rows.length > 0 ? { ok: true } : { ok: false, reason: 'replay' };
  } catch (e) {
    reportError(e, { route: 'noa-sso/consume-jti' });
    return { ok: false, reason: 'error' };
  }

  // F16/N7: 정리 로직이 없으면 로그인 1건당 1행이 영구 누적된다. 단 lib/db.ts는 neon HTTP
  // 드라이버라 sql 한 건이 각각 독립 커밋이므로, 이 DELETE는 위 INSERT의 1회성 보장 판정과
  // 완전히 분리된 자체 try/catch로 감싼다 — INSERT가 이미 커밋된 뒤 정리만 실패해도(락 경합·
  // statement timeout) jti는 이미 소진된 상태이니 그 실패로 로그인 자체를 401 처리하면 안 된다.
  // 워크플로 스크립트가 아니라 앱 코드이므로 Math.random() 사용 가능하고, 만료된(expires_at
  // 지난) 행만 지우므로 파괴적 변경이 아니다.
  if (Math.random() < 0.01) {
    try {
      await sql`DELETE FROM noa_sso_used_tokens WHERE expires_at < now() - interval '1 day'`;
    } catch (e) {
      reportError(e, { route: 'noa-sso/consume-jti-cleanup' });
    }
  }

  return result;
}
