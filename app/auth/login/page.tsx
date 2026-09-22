/**
 * /auth/login — NoA Vibe 사내 통합계정(SSO) 로그인 시작점.
 *
 * NOA_AUTH_INTEGRATION_ID / NOA_AUTH_ISSUER / NOA_AUTH_CLIENT_ID는 배포 Lambda가
 * 주입하는 값인데 NEXT_PUBLIC_* 접두사 주입 여부를 신뢰할 수 없다. 그래서 이 페이지는
 * 서버 컴포넌트로 두고 process.env에서 직접 읽어(전부 공개값) 클라이언트 자식에
 * props로 내려준다. env가 비어 있으면(로컬 등) 클라이언트가 조용히 비활성화 안내를 표시한다.
 */
import AuthLoginClient from './AuthLoginClient';

// next 쿼리·env 기반 리다이렉트 페이지 — 캐시하지 않는다.
export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ next?: string | string[] }>;

export default async function AuthLoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const nextRaw = Array.isArray(sp.next) ? sp.next[0] ?? null : sp.next ?? null;

  const integrationId = process.env.NOA_AUTH_INTEGRATION_ID || '';
  const issuer = process.env.NOA_AUTH_ISSUER || '';
  const clientId = process.env.NOA_AUTH_CLIENT_ID || '';
  const configured = Boolean(integrationId && issuer && clientId);

  return (
    <AuthLoginClient
      configured={configured}
      issuer={issuer}
      clientId={clientId}
      nextRaw={nextRaw}
    />
  );
}
