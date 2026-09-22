/**
 * /auth/callback — NoA Vibe 사내 통합계정(SSO) 로그인 콜백.
 *
 * 이 경로는 고정이다 — 플랫폼이 Keycloak 클라이언트에 등록한 redirectUri가
 * `${origin}/auth/callback`이고(구 @noa/auth-sdk의 기본값), lib/noa-oidc.ts도 같은 값을 쓴다.
 * NOA_AUTH_* env는 배포 Lambda 주입값이라 서버 컴포넌트에서 읽어 클라이언트 자식에 내려준다
 * (app/auth/login/page.tsx와 동일한 이유 — NEXT_PUBLIC_* 신뢰 불가).
 */
import AuthCallbackClient from './AuthCallbackClient';

export const dynamic = 'force-dynamic';

export default function AuthCallbackPage() {
  const integrationId = process.env.NOA_AUTH_INTEGRATION_ID || '';
  const issuer = process.env.NOA_AUTH_ISSUER || '';
  const clientId = process.env.NOA_AUTH_CLIENT_ID || '';
  const configured = Boolean(integrationId && issuer && clientId);

  return (
    <AuthCallbackClient
      configured={configured}
      issuer={issuer}
      clientId={clientId}
    />
  );
}
