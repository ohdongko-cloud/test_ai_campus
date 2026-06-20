// GET /.well-known/jwks.json — RS256 공개키 JWK Set 배포. PRD §2.3.
// 스포크가 id_token 서명을 검증하기 위한 공개키만 노출. 개인키 절대 미노출.
import { getPublicJwks } from '../../../lib/sso-keys';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const jwks = await getPublicJwks();
    return Response.json(jwks, {
      headers: { 'Cache-Control': 'public, max-age=600' },
    });
  } catch {
    // 키 env 미설정 등 — 토큰 원문/내부정보 노출 없이 통일 에러.
    return Response.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
