import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { checkAdminConfig, getAdminPassword, safeEqual, ADMIN_COOKIE, ADMIN_SESSION_TTL_SECONDS } from '../../../../lib/admin-auth';
import { signAdminSession } from '../../../../lib/jwt';
import { checkRateLimit, getClientIp, tooManyRequests } from '../../../../lib/ratelimit';
import { logAuth } from '../../../../lib/audit';

// POST /api/admin/login  body: { password }
export async function POST(req: NextRequest) {
  const cfg = checkAdminConfig();
  if (cfg) return cfg;

  const ip = getClientIp(req);
  const rl = await checkRateLimit('admin-login', ip, 5, '5 m');
  if (!rl.success) {
    await logAuth({ type: 'rate_limited', success: false, req, detail: 'admin-login' });
    return tooManyRequests('로그인 시도가 너무 잦습니다. 5분 후 다시 시도해주세요.');
  }

  const body = await req.json().catch(() => ({}));
  const password = String(body?.password || '');
  if (!password) {
    return NextResponse.json({ error: '비밀번호를 입력해주세요.' }, { status: 400 });
  }

  const expected = getAdminPassword();
  if (!safeEqual(password, expected)) {
    await logAuth({ type: 'admin_login_failure', success: false, req });
    return NextResponse.json({ error: '비밀번호가 올바르지 않습니다.' }, { status: 401 });
  }

  const token = await signAdminSession(ADMIN_SESSION_TTL_SECONDS);
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_SESSION_TTL_SECONDS,
  });

  await logAuth({ type: 'admin_login_success', success: true, req });
  return NextResponse.json({ ok: true });
}
