import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';
import { verifyPassword, hashPassword } from '../../../../lib/password';
import { setUserSessionCookie } from '../../../../lib/session';
import { checkRateLimit, getClientIp, tooManyRequests } from '../../../../lib/ratelimit';
import { logAuth } from '../../../../lib/audit';

// POST /api/users/login  body: { email, password, rememberMe? }
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit('user-login', ip, 5, '5 m');
  if (!rl.success) {
    await logAuth({ type: 'rate_limited', success: false, req, detail: 'user-login' });
    return tooManyRequests('로그인 시도가 너무 잦습니다. 5분 후 다시 시도해주세요.');
  }

  const body = await req.json().catch(() => ({}));
  const emailRaw = String(body?.email || '').toLowerCase().trim();
  const password = String(body?.password || '');
  const rememberMe = !!body?.rememberMe;

  if (!emailRaw || !password) {
    return NextResponse.json({ error: '이메일과 비밀번호를 입력해주세요.' }, { status: 400 });
  }

  await logAuth({ type: 'login_attempt', email: emailRaw, success: false, req });

  try {
    const rows = await sql`
      SELECT id, name, corporation_name, organization_name, position, email, password_hash
      FROM users
      WHERE email = ${emailRaw}
      LIMIT 1`;
    if (rows.length === 0) {
      await logAuth({ type: 'login_failure', email: emailRaw, success: false, req, detail: 'no-such-user' });
      return NextResponse.json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 });
    }
    const u = rows[0];

    const { matched, isLegacy } = await verifyPassword(password, u.password_hash);
    if (!matched) {
      await logAuth({ type: 'login_failure', email: emailRaw, success: false, req, detail: 'bad-password' });
      return NextResponse.json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 });
    }

    // 레거시 SHA-256 → bcrypt 자동 마이그레이션
    if (isLegacy) {
      try {
        const newHash = await hashPassword(password);
        await sql`UPDATE users SET password_hash = ${newHash} WHERE id = ${u.id}`;
      } catch { /* 마이그레이션 실패해도 로그인은 통과 */ }
    }

    await setUserSessionCookie(u.id, u.email, rememberMe);
    await logAuth({ type: 'login_success', email: emailRaw, success: true, req, detail: rememberMe ? 'remember' : 'session' });

    return NextResponse.json({
      id: u.id,
      nickname: u.name,
      email: u.email,
      corporationName: u.corporation_name,
      organizationName: u.organization_name,
      position: u.position,
    });
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
