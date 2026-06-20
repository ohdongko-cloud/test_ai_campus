// GET /sso/logout — 자기 세션만 로그아웃. PRD §2.6 / Q4.
// 크로스앱 전파 없음(글로벌 로그아웃 비목표, N3). 허브 user_session만 삭제.
import { NextRequest, NextResponse } from 'next/server';
import { clearUserSessionCookie } from '../../../lib/session';
import { getClient, isAllowedPostLogout } from '../../../lib/sso-clients';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const app = url.searchParams.get('app') ?? '';
  const postLogout = url.searchParams.get('post_logout_redirect_uri') ?? '';

  // 1. 허브 자기 세션만 삭제.
  await clearUserSessionCookie();

  // 2. post_logout_redirect_uri는 레지스트리 화이트리스트 정확매칭일 때만 허용.
  if (postLogout && app) {
    const client = await getClient(app);
    if (client && isAllowedPostLogout(client, postLogout)) {
      return NextResponse.redirect(postLogout, 302);
    }
    // 미허용 → 오픈리다이렉트 차단, 홈으로.
  }

  // 3. 없거나 미허용이면 허브 홈.
  return NextResponse.redirect(new URL('/', url.origin), 302);
}
