// SSO(NoA Vibe 통합계정) 로그인 완료 후 돌아갈 경로를 저장하는 sessionStorage 키.
//
// @noa/auth-sdk의 login({ redirectTo })는 자체 키 'noa-auth-return'에 값을 저장하지만
// handleCallback()이 그 값을 읽지 않는다(SDK 확인 완료). 그래서 앱이 직접 저장·소비하는
// 별도 키를 둔다:
//   - app/auth/login/AuthLoginClient.tsx 가 Keycloak으로 이동하기 직전에 저장
//   - app/auth/callback/AuthCallbackClient.tsx 가 로그인 성공 시에만 읽어서 소비(삭제).
//     실패 시에는 지우지 않고 남겨 두어 에러 화면의 "돌아가기" 링크가 같은 복귀 경로를
//     이어받게 한다(F10 — 안 그러면 next가 사라져 모바일에서 데스크톱 SPA로 떨어진다).
//
// 값은 신뢰하지 않고 콜백 쪽에서 항상 sanitizeNext()로 재검증한다.
export const NOA_SSO_RETURN_KEY = 'campus-noa-auth-return';

// SSO 로그인 시작 시점의 '자동 로그인(30일 유지)' 체크 상태를 콜백까지 이어 전달하는
// sessionStorage 키. AuthLoginClient가 URL의 remember=1|0 쿼리를 읽어 저장하고,
// AuthCallbackClient가 읽어 /api/users/sso-login의 rememberMe로 그대로 전달한다.
// 값이 없거나 손상됐으면(sessionStorage 차단 등) **항상 false**(세션 쿠키)로 취급한다 —
// 공용 PC에서 값 유실로 30일 영구 쿠키가 강제되는 것을 막기 위함(F15).
export const NOA_SSO_REMEMBER_KEY = 'campus-noa-auth-remember';
