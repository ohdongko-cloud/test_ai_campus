// GET /sso/authorize — 인증 시작점(Authorization Endpoint, 단순화). PRD §2.2.
// 허브 세션 확인 → 없으면 허브 로그인 유도 → 있으면 단명 id_token 발급 후 redirect_uri로 302.
import { NextRequest, NextResponse, after } from 'next/server';
import { getCurrentUser } from '../../../lib/session';
import { getClient, isAllowedRedirect } from '../../../lib/sso-clients';
import { storeNonce } from '../../../lib/sso-nonce';
import { signIdToken, randomNonce, getIssuer } from '../../../lib/sso';
import { checkRateLimit, getClientIp, tooManyRequests } from '../../../lib/ratelimit';
import { logSsoEvent } from '../../../lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 오픈리다이렉트 차단: 미등록/불일치 시 400(리다이렉트 금지, PRD §7.1).
function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(req: NextRequest) {
  // 파라미터 파싱을 레이트리밋 앞으로 이동(순수 동기 파싱 — 기존 동작 변화 없음).
  // rate_limited 이벤트 로깅에 app 값을 쓰기 위함(§4.1).
  const url = new URL(req.url);
  const app = url.searchParams.get('app') ?? '';
  const redirectUri = url.searchParams.get('redirect_uri') ?? '';
  const state = url.searchParams.get('state') ?? '';
  const nonceIn = url.searchParams.get('nonce') ?? '';
  const prompt = url.searchParams.get('prompt') ?? '';
  // 킷 버전 텔레메트리(§4.1) — 쿼리 원문이므로 화이트리스트 통과분만 기록한다.
  const kitRaw = url.searchParams.get('kit') ?? '';
  const kit = /^[\w.-]{1,32}$/.test(kitRaw) ? kitRaw : '';

  // 레이트리밋(IP 단위, §7.9). 백엔드 오류는 무시하고 통과시킨다(가용성 우선).
  // 판정과 429 반환을 try 밖으로 분리한다 — 로깅용 보조 호출이 throw해도
  // `return tooManyRequests()`를 건너뛰어 차단 대상이 통과하는 일이 없도록.
  let limited = false;
  try {
    const ip = getClientIp(req);
    const rl = await checkRateLimit('sso_authorize', ip, 60, '1 m');
    if (!rl.success) {
      limited = true;
      // 429마다 기록하면 레이트리밋이 DB 쓰기를 전혀 못 막는다(초과 트래픽 = 행 폭증).
      // 별도 저빈도 버킷으로 IP당 분당 3행까지만 남긴다 — 공격 관측은 유지, 증폭은 차단.
      const canLog = await checkRateLimit('sso_authorize_log', ip, 3, '1 m');
      if (canLog.success) await logSsoEvent({ event: 'rate_limited', app, req });
    }
  } catch {
    /* 레이트리밋 백엔드 오류는 무시(가용성 우선) — limited 판정은 그대로 유지 */
  }
  if (limited) return tooManyRequests();

  // 1. app / redirect_uri 검증 — 정확매칭. 불일치 시 리다이렉트 금지.
  const client = await getClient(app);
  if (!client) {
    await logSsoEvent({ event: 'deny_unknown_app', app, req });
    return badRequest('unknown app');
  }
  if (!isAllowedRedirect(client, redirectUri)) {
    await logSsoEvent({ event: 'deny_redirect_mismatch', app, req });
    return badRequest('redirect_uri not allowed');
  }
  // 2. state 필수(CSRF, §7.2).
  if (!state) {
    await logSsoEvent({ event: 'deny_state_missing', app, req });
    return badRequest('state required');
  }

  // 3. 허브 세션 확인.
  const user = await getCurrentUser();
  if (!user) {
    const sep = redirectUri.includes('?') ? '&' : '?';
    // login_required(미로그인) 302 분기는 의도적으로 원시 행을 기록하지 않는다.
    // 이유: /login 리다이렉트·prompt=none 실패 리다이렉트 둘 다 "자동 리다이렉트"가 도입되면
    // 페이지뷰 스케일로 폭증할 수 있는 경로(블루프린트 §4.1)이고, v1은 자동 리다이렉트가 없어도
    // 매 authorize 방문마다 트리거될 수 있어 issue/거부 이벤트 대비 노이즈가 크다.
    // SsoEventType.login_required는 타입만 예약해 두고(향후 표본추출/카운터 집계로 전환 여지),
    // v1은 기록하지 않는 쪽을 기본값으로 판단했다.
    if (prompt === 'none') {
      // silent 체크 — 로그인 UI 없이 조용히 에러 리다이렉트.
      const loc = `${redirectUri}${sep}error=login_required&state=${encodeURIComponent(state)}`;
      return NextResponse.redirect(loc, 302);
    }
    // 원래 authorize URL 보존 후 허브 로그인으로. next는 동일 오리진 경로만.
    const next = encodeURIComponent(url.pathname + url.search);
    return NextResponse.redirect(new URL(`/login?next=${next}`, url.origin), 302);
  }

  // 5. id_token 발급(RS256, 60초) + nonce 1회성 저장.
  const nonce = nonceIn || randomNonce();
  try {
    await storeNonce(nonce, app);
  } catch (e) {
    // nonce 저장 실패(테이블 미존재 등)는 토큰 발급을 막지 않는다(스포크 측 1회성 소비가 추가 방어).
    // 단 침묵하면 userinfo 401이 "재사용"인지 "미저장"인지 사후 구분 불가 → 에러만 로그(토큰·PII 없음).
    console.error('[sso/authorize] storeNonce 실패:', e instanceof Error ? e.message : e);
  }

  let idToken: string;
  try {
    idToken = await signIdToken({
      iss: getIssuer(),
      sub: user.email,
      aud: app,
      nonce,
    });
  } catch {
    // 키 env 미설정 등 — 통일 에러(토큰 미발급).
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }

  // 발급 성공 계측(§4.1) — kit 버전 텔레메트리를 detail에 남긴다(토큰 원문·쿼리스트링 전체는 절대 넘기지 않음).
  // 응답 전송 후 실행(after) — DB 지연·장애가 SSO 로그인 리다이렉트를 늦추지 않도록.
  // 관측용 로깅이라 유실돼도 인증 흐름에 영향 없음(로깅은 가용성 우선, §4.6 고지와 일치).
  after(async () => {
    await logSsoEvent({
      event: 'issue',
      app,
      email: user.email,
      req,
      detail: kit ? `kit=${kit}` : undefined,
    });
  });

  // 6. redirect_uri로 302 (token + state echo).
  const sep = redirectUri.includes('?') ? '&' : '?';
  const loc = `${redirectUri}${sep}token=${encodeURIComponent(idToken)}&state=${encodeURIComponent(state)}`;
  return NextResponse.redirect(loc, 302);
}
