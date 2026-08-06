// === ELAND SSO SPOKE KIT v2.0.0 (contract v2) — DO NOT EDIT ===
// 원본: retail_ai_campus repo docs/sso/spoke-kit/ — 수정은 허브 레포에서만. 스포크는 복사만.
// 유일한 수정 허용: import 경로 별칭(@/*)이 없는 레포의 import 줄.
// 앱별 커스터마이징은 lib/sso-adapter.ts 에서만.

/**
 * GET /sso/login?returnTo=/path — SSO 시작점 (계약 §5).
 *
 * 하는 일: state·nonce 생성 → httpOnly 임시 쿠키 3종 저장 → 허브 /sso/authorize로 302.
 * 로그인 버튼 예: <a href="/sso/login?returnTo=/현재경로">AI캠퍼스로 로그인</a>
 *
 * 이 라우트가 지키는 계약 요건
 *  - `state` 필수 — 없으면 허브가 400 `state required`(리다이렉트 없음).
 *    근거: app/sso/authorize/route.ts:106-109
 *  - `nonce` 형식 — `[A-Za-z0-9._~-]` 16~128자. randomToken()은 base64url 43자라 항상 만족.
 *    근거: 계약 §2.2 / app/sso/authorize/route.ts:32,113-118
 *  - `redirect_uri` — 허브 레지스트리와 정규화 후 정확매칭. 불일치 시 400(리다이렉트 없음).
 *    근거: lib/sso-clients.ts:30-45,127-131 / app/sso/authorize/route.ts:101-104
 *  - `kit` — 킷 버전 텔레메트리. 허브가 `/^[\w.-]{1,32}$/` 통과분만 sso_events.detail에 기록.
 *    근거: app/sso/authorize/route.ts:67-69,166-174
 *  - `prompt=none` 패스스루 — 허브 세션이 없으면 로그인 UI 대신
 *    `redirect_uri?error=login_required&state=…`로 302된다(콜백 ⓪단계가 받는다).
 *    근거: app/sso/authorize/route.ts:130-134
 *
 * ★ redirect_uri는 반드시 env(SSO_SELF_URL)로 구성한다 — Host 헤더에서 유도하면
 *   호스트 헤더 위조로 콜백 대상이 바뀔 수 있다. `${cfg.selfUrl}/sso/callback` 문자열 결합이므로
 *   SSO_SELF_URL에 trailing slash가 있으면 //sso/callback이 되어 항상 400이다(코어가 방어적으로 제거).
 *
 * ★ 콜백 URL에 추가 쿼리 파라미터를 붙이지 않는다. 허브 정확매칭은 쿼리를 제거한 베이스만
 *   비교하므로 기술적으로는 통과하지만(lib/sso-clients.ts:43-44), 콜백 쿼리에 새 의미를 부여하는
 *   확장은 금지다(SSO-SPOKE-KIT.md §6).
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  SSO_KIT_VERSION,
  getSsoConfig,
  randomToken,
  sanitizeReturnTo,
  setSsoTxnCookies,
  type SsoSpokeConfig,
} from '@/lib/sso-spoke';

// Edge 금지: 코어가 node:crypto(randomBytes·timingSafeEqual)를 쓴다(허브 F8과 동일 근거).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // env 미설정(SSO_APP_ID·SSO_SELF_URL)은 사용자가 고칠 수 없는 배포 설정 오류 → 500.
  // 실패 UX(302 → errorPath) 대상이 아니다. 원문 메시지는 노출하지 않는다.
  let cfg: SsoSpokeConfig;
  try {
    cfg = getSsoConfig();
  } catch {
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.', sso_error: 'server_error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // ※ url은 여기서 한 번만 파싱해 returnTo·prompt 양쪽에 재사용한다.
  const url = new URL(req.url);
  const returnTo = sanitizeReturnTo(url.searchParams.get('returnTo')); // 오픈리다이렉트 방지
  const state = randomToken(); // CSRF — 콜백에서 timing-safe 대조
  const nonce = randomToken(); // 허브가 id_token nonce 클레임에 그대로 echo(치환 없음, 계약 §2.2)

  const authorize = new URL('/sso/authorize', cfg.hubUrl);
  authorize.searchParams.set('app', cfg.appId);
  authorize.searchParams.set('redirect_uri', `${cfg.selfUrl}/sso/callback`);
  authorize.searchParams.set('state', state);
  authorize.searchParams.set('nonce', nonce);
  authorize.searchParams.set('kit', SSO_KIT_VERSION);
  // prompt=none 패스스루 — 스포크가 "조용한 세션 확인"을 원할 때만 붙여 보낸다.
  if (url.searchParams.get('prompt') === 'none') {
    authorize.searchParams.set('prompt', 'none');
  }

  const res = NextResponse.redirect(authorize.toString(), 302);
  // state/nonce/returnTo → httpOnly·sameSite=lax·path=/sso·20분(코어가 속성을 소유).
  // sameSite=lax는 필수: 콜백이 허브발 top-level GET 302(크로스사이트)로 도착하므로
  // 'strict'면 쿠키가 동봉되지 않아 매번 state_mismatch가 된다.
  setSsoTxnCookies(res, { state, nonce, returnTo });
  res.headers.set('Cache-Control', 'no-store'); // state·nonce가 실린 응답 캐시 금지
  return res;
}
