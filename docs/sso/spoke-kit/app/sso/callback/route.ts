// === ELAND SSO SPOKE KIT v2.0.0 (contract v2) — DO NOT EDIT ===
// 원본: retail_ai_campus repo docs/sso/spoke-kit/ — 수정은 허브 레포에서만. 스포크는 복사만.
// 유일한 수정 허용: import 경로 별칭(@/*)이 없는 레포의 import 줄.
// 앱별 커스터마이징은 lib/sso-adapter.ts 에서만.

/**
 * GET /sso/callback?token=&state= — 허브 발급 id_token 수신점 (계약 §3).
 *
 * 처리 순서(계약 §3.1 + 킷 §2.3):
 *   ⓪ 허브 에러 패스스루(error=login_required 등) → returnTo로 조용히 복귀
 *   ① state CSRF 검증(httpOnly 쿠키 vs 쿼리, timing-safe)
 *   ② id_token RS256/iss/aud/exp 검증 + 이메일 도메인 재검증(verifyHubToken)
 *   ③ nonce 1회성 검증(쿠키 바인딩 = 기본, adapter.consumeNonce = 선택 심층방어)
 *   ④ provision / lookup (어댑터) [+ 선택: /sso/userinfo 1회 호출 → mergeUserinfo]
 *   ⑤ 자기 세션 쿠키 발급 (어댑터)
 *   ⑥ returnTo 302 + 임시 쿠키 소거
 *
 * 실패 UX(킷 §2.3): 사용자 도달 가능한 실패는 302 → `${errorPath}?sso_error=<code>`.
 *   콜백 실패 경로는 공격자만 오는 곳이 아니다(쿠키 20분 만료·이중 탭·뒤로가기 재진입).
 *   1,800명 비개발 직원이 raw JSON을 보고 멈추지 않도록 항상 사람이 읽는 페이지로 보낸다.
 *   서버 오류(server_error)만 500 JSON. 어느 쪽이든 토큰 원문·email을 절대 싣지 않는다.
 *
 * 임시 쿠키(sso_state/sso_nonce/sso_return_to)는 성공·실패 **양쪽 모두** 소거한다(재사용 방지).
 *
 * 무재진입(MUST NOT, 계약 §2.1): 어떤 실패에서도 /sso/login·/sso/authorize로 자동 재진입하지
 *   않는다. 허브 세션(최대 30일)이 살아 있으면 상호작용 없이 새 토큰이 즉시 발급되어
 *   콜백 → 실패 → 재진입의 무한 루프가 된다. 재개는 사용자가 직접 클릭할 때만.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  clearSsoTxnCookies,
  fetchUserinfoOnce,
  getSsoConfig,
  readSsoTxnCookies,
  sanitizeReturnTo,
  verifyHubToken,
  verifyState,
  type HubIdentity,
  type SpokeUser,
  type SsoSpokeConfig,
} from '@/lib/sso-spoke';
import { ssoAdapter } from '@/lib/sso-adapter';

// Edge 금지: 코어가 node:crypto(timingSafeEqual)·jose RS256 검증을 쓴다(허브 F8과 동일 근거).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 사용자 도달 가능한 실패 코드(킷 §2.3 / 계약 부록 sso_error 코드표). */
type SsoErrorCode =
  | 'state_mismatch'
  | 'nonce_mismatch'
  | 'token_invalid'
  | 'provision_refused'
  | 'userinfo_failed';

/** 응답 공통 헤더: 토큰이 실린 URL이므로 캐시·리퍼러 유출을 함께 막는다. */
function harden(res: NextResponse): NextResponse {
  res.headers.set('Cache-Control', 'no-store');
  res.headers.set('Referrer-Policy', 'no-referrer');
  return res;
}

/** 사용자 도달 가능한 실패 → 302 `${errorPath}?sso_error=<code>` (토큰·email 미포함). */
function failRedirect(cfg: SsoSpokeConfig, code: SsoErrorCode): NextResponse {
  let target: string;
  try {
    const u = new URL(cfg.errorPath, cfg.selfUrl);
    // errorPath가 외부 오리진으로 해석되면(오설정) 자기 홈으로 강등 — 오픈리다이렉트 방지.
    if (u.origin !== new URL(cfg.selfUrl).origin) throw new Error('off-origin errorPath');
    u.searchParams.set('sso_error', code);
    target = u.toString();
  } catch {
    target = `${cfg.selfUrl}/?sso_error=${code}`;
  }
  const res = NextResponse.redirect(target, 302);
  clearSsoTxnCookies(res); // 실패 경로도 임시 쿠키 소거(재사용 방지)
  return harden(res);
}

/** 서버 오류(설정·어댑터 예외)만 500 JSON. 원문 메시지·스택은 노출하지 않는다. */
function serverError(clearCookies: boolean): NextResponse {
  const res = NextResponse.json(
    { error: '서버 오류가 발생했습니다.', sso_error: 'server_error' },
    { status: 500 },
  );
  if (clearCookies) clearSsoTxnCookies(res);
  return harden(res);
}

export async function GET(req: NextRequest) {
  // env 미설정은 배포 설정 오류 → 500(실패 UX 대상 아님. cfg 없이는 errorPath도 만들 수 없다).
  let cfg: SsoSpokeConfig;
  try {
    cfg = getSsoConfig();
  } catch {
    return serverError(false);
  }

  const url = new URL(req.url);
  const token = url.searchParams.get('token') ?? '';
  const state = url.searchParams.get('state') ?? '';
  const hubError = url.searchParams.get('error') ?? '';

  const txn = readSsoTxnCookies(req);
  // returnTo는 자기 httpOnly 쿠키 값이지만 사용 직전에 다시 새니타이즈한다(방어적 이중화).
  const returnTo = sanitizeReturnTo(txn.returnTo);
  // 최종 이동 대상은 항상 env 오리진 기준으로 만든다 — Host 헤더 유도 금지.
  const returnUrl = new URL(returnTo, cfg.selfUrl).toString();

  // ⓪ 허브 에러 패스스루 — prompt=none silent 확인 실패(error=login_required) 등.
  //    허브는 세션이 없을 때 `redirect_uri?error=login_required&state=…`로 302한다
  //    (app/sso/authorize/route.ts:130-134). 이건 "로그인 안 된 상태"라는 정상 응답이므로
  //    에러 화면 없이 원래 목적지로 조용히 복귀시킨다(자동 재진입 금지 — 루프 방지).
  if (hubError) {
    const res = NextResponse.redirect(returnUrl, 302);
    clearSsoTxnCookies(res);
    return harden(res);
  }

  // ① state CSRF 검증(계약 §3.1 1단계) — 쿼리 state vs httpOnly 쿠키, timing-safe.
  //    쿠키 만료(20분)·이중 탭·콜백 URL 재붙여넣기도 여기서 걸린다(정상 사용자 포함).
  if (!state || !txn.state || !verifyState(txn.state, state)) {
    return failRedirect(cfg, 'state_mismatch');
  }

  // ② id_token 검증(계약 §3.1 2단계 + 4단계) — RS256 명시·iss·aud·exp(TTL 60초)를
  //    jose가 검증하고, 코어가 sub(email) 타입 검사 + 허용 도메인 재검증까지 수행한다.
  //    신뢰 원천은 payload.sub이다(허브가 email 클레임도 넣지만 계약에 없는 필드다 —
  //    lib/sso.ts:48 vs 계약 §6 표).
  if (!token) {
    return failRedirect(cfg, 'token_invalid');
  }
  let identity: HubIdentity;
  try {
    identity = await verifyHubToken(token);
  } catch {
    // 만료(60초)·서명 불일치·aud/iss 불일치·도메인 위반을 구분해 노출하지 않는다.
    return failRedirect(cfg, 'token_invalid');
  }

  // ③ nonce 1회성 검증(계약 §3.1 3단계) — 기본 메커니즘 = httpOnly 쿠키 바인딩.
  //    (1) URL·로그로 새어나간 토큰의 제3자 재사용 차단(그 브라우저엔 쿠키가 없다)
  //    (2) 동일 브라우저의 콜백 URL 재실행 차단(성공 시 쿠키를 지운다)
  //    verifyState는 범용 timing-safe 동등비교라 nonce 대조에도 그대로 쓴다.
  if (!txn.nonce || !verifyState(txn.nonce, identity.nonce)) {
    return failRedirect(cfg, 'nonce_mismatch');
  }
  // [선택] 영속 스토어 1회 소비 — 쿠키 바인딩에 더하는 심층 방어(어댑터가 구현한 경우만).
  if (typeof ssoAdapter.consumeNonce === 'function') {
    let consumed: boolean;
    try {
      consumed = await ssoAdapter.consumeNonce(identity.nonce);
    } catch {
      return serverError(true); // 스토어 장애는 fail-closed(재사용 판정 불가)
    }
    if (!consumed) return failRedirect(cfg, 'nonce_mismatch');
  }

  // ④ provision / lookup(계약 §3.1 5단계) — 어댑터 책임(LOWER(email) 조회, 최소권한 생성).
  //    정책상 거부(null)는 사용자 도달 가능한 실패다.
  let user: SpokeUser | null;
  try {
    user = await ssoAdapter.provisionUser(identity.email);
  } catch {
    return serverError(true);
  }
  if (!user) {
    return failRedirect(cfg, 'provision_refused');
  }

  // ④-1 [선택] /sso/userinfo 프로필 보강 — **기본 OFF**.
  //     어댑터에 mergeUserinfo가 정의된 경우에만, 이 콜백 트랜잭션 안에서 **동기 1회** 호출한다
  //     (계약 §2.1 MUST). 재시도·병렬 중복 호출·캐싱 금지 — 허브 nonce가 그 호출 시점에
  //     원자적으로 소비되므로 2회차는 반드시 401이다(app/sso/userinfo/route.ts:81-89).
  //     실패(모든 상태코드 + 네트워크 예외)의 기본 처리는 "이미 검증된 id_token 클레임만으로
  //     세션 발급을 계속"이며, /sso/login·/sso/authorize 자동 재진입은 금지다(MUST NOT).
  //     프로필이 세션 발급의 필수 전제인 어댑터만 userinfoRequired=true로 §2.3 실패 UX 사용
  //     (그 페이지에서도 재개는 사용자 클릭으로만).
  if (typeof ssoAdapter.mergeUserinfo === 'function') {
    try {
      const profile = await fetchUserinfoOnce(token);
      const merged = await ssoAdapter.mergeUserinfo(profile, user);
      if (merged) user = merged;
    } catch {
      if (ssoAdapter.userinfoRequired) return failRedirect(cfg, 'userinfo_failed');
      // 기본값: 프로필 없이 계속 진행(다음 로그인에서 보강). 응답 원문은 저장·로깅하지 않는다.
    }
  }

  // ⑤ 자기 세션 쿠키 발급(계약 §3.1 6단계) — 기존 자체 로그인과 동일한 발급 함수 재사용.
  //    어댑터가 이 응답(res)에 httpOnly 쿠키를 심으므로 리다이렉트 응답을 먼저 만든다.
  const res = NextResponse.redirect(returnUrl, 302);
  try {
    await ssoAdapter.establishSession(user, res, req);
  } catch {
    return serverError(true);
  }

  // ⑥ returnTo 302 + 임시 쿠키 소거(성공 경로).
  clearSsoTxnCookies(res);

  // [선택] SSO 로그인 1건 계측(Tier2 stats 원천). 실패해도 로그인을 막지 않는다.
  if (typeof ssoAdapter.recordSsoLogin === 'function') {
    try {
      await ssoAdapter.recordSsoLogin(user, req);
    } catch {
      /* 계측 실패는 무시 — 인증 흐름 불변 */
    }
  }

  return harden(res);
}
