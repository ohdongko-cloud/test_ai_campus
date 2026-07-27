// GET /sso/logout — 자기 세션만 로그아웃. PRD §2.6 / Q4.
// 크로스앱 전파 없음(글로벌 로그아웃 비목표, N3). 허브 user_session만 삭제.
import { NextRequest, NextResponse } from 'next/server';
import { clearUserSessionCookie, getCurrentUser } from '../../../lib/session';
import { getClient, isAllowedPostLogout } from '../../../lib/sso-clients';
import { logSsoEvent } from '../../../lib/audit';
import { checkRateLimit, getClientIp } from '../../../lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const app = url.searchParams.get('app') ?? '';
  const postLogout = url.searchParams.get('post_logout_redirect_uri') ?? '';

  // 세션 삭제 전에 이메일을 미리 확보(계측용, §4.1) — 응답 흐름·상태코드는 변경하지 않는다.
  const user = await getCurrentUser();

  // 1. 허브 자기 세션만 삭제.
  await clearUserSessionCookie();
  // 계측은 **실제 세션이 있었을 때만** + IP 레이트리밋. 이 라우트는 GET이라
  // 무조건 기록하면 익명 요청(<img src>로도 유발 가능)이 sso_events에 무제한 INSERT를
  // 일으킨다(Neon Free 0.5GB 소진 → 로그인 동반 중단). 익명 로그아웃은 관측 가치도 없다.
  // 세션 쿠키는 sameSite=lax라 서브리소스 요청엔 실리지 않지만, 쿠키 삭제를 무시하는
  // 스크립트 클라이언트(유효 JWT 재전송)는 남으므로 레이트리밋으로 상한을 건다.
  // 로그아웃 동작 자체(쿠키 삭제·리다이렉트)는 레이트리밋과 무관하게 항상 수행한다.
  if (user) {
    try {
      const rl = await checkRateLimit('sso_logout', getClientIp(req), 10, '1 m');
      if (rl.success) {
        await logSsoEvent({ event: 'logout', app, email: user.email, req });
      }
    } catch {
      /* 레이트리밋 백엔드 오류 시 로깅은 건너뛴다(가용성 우선 — 로그아웃 흐름은 계속) */
    }
  }

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
