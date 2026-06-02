import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';
import { checkRateLimit, getClientIp, tooManyRequests } from '../../../../lib/ratelimit';
import { verifyResetToken } from '../../../../lib/jwt';
import { hashPassword, isValidSimplePassword, PASSWORD_POLICY_MESSAGE } from '../../../../lib/password';
import { logAuth } from '../../../../lib/audit';

// POST /api/users/reset-password  body: { resetToken, password, passwordConfirm }
// reset_token 검증 후 새 비밀번호로 갱신.
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit('reset-password', ip, 10, '10 m');
  if (!rl.success) return tooManyRequests();

  const body = await req.json().catch(() => ({}));
  const resetToken = String(body?.resetToken || '');
  const password = String(body?.password || '');
  const passwordConfirm = String(body?.passwordConfirm || '');

  const payload = await verifyResetToken(resetToken);
  if (!payload) {
    return NextResponse.json({ error: '인증이 만료되었습니다. 처음부터 다시 시도해주세요.' }, { status: 401 });
  }
  const email = payload.email.toLowerCase();

  if (!password || !passwordConfirm) {
    return NextResponse.json({ error: '비밀번호를 입력해주세요.' }, { status: 400 });
  }
  if (password !== passwordConfirm) {
    return NextResponse.json({ error: '비밀번호가 일치하지 않습니다.' }, { status: 400 });
  }
  if (!isValidSimplePassword(password)) {
    return NextResponse.json({ error: PASSWORD_POLICY_MESSAGE }, { status: 400 });
  }

  try {
    const password_hash = await hashPassword(password);
    const rows = await sql`
      UPDATE users SET password_hash = ${password_hash}, updated_at = now()
      WHERE email = ${email} RETURNING id`;
    if (rows.length === 0) {
      return NextResponse.json({ error: '회원을 찾을 수 없습니다.' }, { status: 404 });
    }
    await logAuth({ type: 'reset_password_success', email, success: true, req });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
