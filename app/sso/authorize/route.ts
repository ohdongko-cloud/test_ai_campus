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

// nonce 형식 화이트리스트.
// 스포크가 준 값을 토큰 nonce 클레임에 그대로 echo하고 sso_nonces.nonce(TEXT PRIMARY KEY,
// supabase/schema.sql:217)에 저장하므로, 상한이 없으면 로그인 계정 1개로 btree PK 상한(~2.7KB)
// 크기의 행을 분당 60건(authorize 레이트리밋) 적재할 수 있다 → Neon Free 0.5GB 공유 소진.
// 허용 집합 = RFC 3986 unreserved(A-Za-z0-9-._~): 쿼리스트링에 인코딩 없이 안전하고,
//   · 킷 randomToken()의 base64url(A-Za-z0-9_-, docs/sso/SSO-SPOKE-KIT.md:146-147)
//   · 계약 §5 예시의 crypto.randomUUID()(hex + '-', docs/sso-spoke-integration-contract.md:223)
//   · 허브 자신의 randomNonce()(randomBytes(24).base64url = 32자, lib/sso.ts:19)
//   를 모두 포함한다.
// 길이 16~128: 하한은 replay 방지에 의미 있는 엔트로피(base64url 16자 ≈ 96bit), 상한은
// UUID(36)·base64url 64바이트(86자)를 덮는 값. 위반 시 400(리다이렉트 금지).
// ★ 치환(조용히 허브 값으로 대체)은 선택지가 아니다 — 킷은 토큰의 nonce를 자기 httpOnly
//   쿠키와 대조하므로(docs/sso/SSO-SPOKE-KIT.md §2.3) 값을 바꾸면 정상 스포크 로그인이 전부 깨진다.
const NONCE_PATTERN = /^[A-Za-z0-9._~-]{16,128}$/;

/**
 * 관측 로그 예산 게이트(§4.1 + 저장소 소진 방어). rate_limited·deny_* 가 공유한다.
 *
 * - **절대 throw하지 않는다**: 레이트리밋 백엔드 오류를 false(=기록 생략)로 흡수한다.
 *   호출부의 `return badRequest(...)` / `return tooManyRequests()`가 예외로 건너뛰어지는 회귀를
 *   구조적으로 불가능하게 만들기 위함이다(과거 사고: 로깅용 보조 호출을 판정 try 안에 두는 바람에
 *   throw 시 차단 대상이 통과 — 아래 :72-73 주석 참조). 응답은 로깅 성공 여부와 무관하다.
 * - 백엔드 장애 시 기본값 = **기록 생략**. 이 게이트의 목적 자체가 DB 쓰기 상한이므로,
 *   상한을 계산할 수 없는 상태에서 무제한 INSERT를 허용하면 게이트가 없는 것과 같다.
 *   (동일 판단이 app/sso/logout/route.ts:34-36에도 적용돼 있다.)
 * - 버킷 키는 rate_limited와 **동일 키 재사용**: 지키려는 불변식이 "authorize가 IP당 분당 남기는
 *   관측 행 ≤ 3"(= 4,320행/일/IP)이기 때문. 429는 :87에서 조기 반환되어 deny_* 분기에 도달하지
 *   않으므로 두 계열이 같은 분에 경쟁하는 구간은 레이트리밋 임계 전후뿐이고, 그때는 정보량이 큰
 *   deny_*가 먼저 예산을 쓴다(공격 관측 유지). 키를 나누면 IP당 상한이 2배가 된다.
 */
async function canLogSso(req: Request): Promise<boolean> {
  try {
    const rl = await checkRateLimit('sso_authorize_log', getClientIp(req), 3, '1 m');
    return rl.success;
  } catch {
    return false; // 로깅은 부수효과 — 판정 불가 시 기록을 생략한다(응답 흐름 불변)
  }
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
      if (await canLogSso(req)) await logSsoEvent({ event: 'rate_limited', app, req });
    }
  } catch {
    /* 레이트리밋 백엔드 오류는 무시(가용성 우선) — limited 판정은 그대로 유지 */
  }
  if (limited) return tooManyRequests();

  // 1. app / redirect_uri 검증 — 정확매칭. 불일치 시 리다이렉트 금지.
  //
  // ※ 아래 deny_* 3종의 로깅은 모두 canLogSso() 예산 게이트를 통과할 때만 수행한다.
  //   게이트 없이 기록하면 authorize 레이트리밋(60/분/IP) 상한까지 그대로 INSERT가 되어
  //   86,400행/일/IP → Neon Free 0.5GB(앱 전체 공유) 소진 = 로그인·가입 OTP·재설정 동반 중단.
  //   canLogSso()는 throw하지 않으므로(정의부 참조) 각 분기의 `return badRequest(...)`는
  //   레이트리밋 백엔드 상태와 무관하게 항상 실행된다 — 로깅은 순수 부수효과다.
  const client = await getClient(app);
  if (!client) {
    if (await canLogSso(req)) await logSsoEvent({ event: 'deny_unknown_app', app, req });
    return badRequest('unknown app');
  }
  if (!isAllowedRedirect(client, redirectUri)) {
    if (await canLogSso(req)) await logSsoEvent({ event: 'deny_redirect_mismatch', app, req });
    return badRequest('redirect_uri not allowed');
  }
  // 2. state 필수(CSRF, §7.2).
  if (!state) {
    if (await canLogSso(req)) await logSsoEvent({ event: 'deny_state_missing', app, req });
    return badRequest('state required');
  }
  // 2-1. nonce 형식 검증(선택 파라미터 — 주어진 경우에만). 세션 확인·리다이렉트 분기보다 앞에 둔다:
  //      위반값이 /login?next= 나 prompt=none 리다이렉트에 실려 나가지 않도록(400 + 리다이렉트 금지).
  //      이벤트는 새 타입을 만들지 않고 deny_state_missing + detail로 구분한다(lib/audit.ts:46-48).
  if (nonceIn && !NONCE_PATTERN.test(nonceIn)) {
    if (await canLogSso(req)) {
      await logSsoEvent({ event: 'deny_state_missing', app, req, detail: 'nonce_invalid' });
    }
    return badRequest('nonce format invalid');
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
