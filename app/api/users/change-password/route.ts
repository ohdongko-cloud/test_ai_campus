import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';
import { getCurrentUser } from '../../../../lib/session';
import { verifyPassword, hashPassword, isValidSimplePassword, PASSWORD_POLICY_MESSAGE } from '../../../../lib/password';
import { checkRateLimit, getClientIp, tooManyRequests } from '../../../../lib/ratelimit';
import { logAuth } from '../../../../lib/audit';

// POST /api/users/change-password  body: { currentPassword, newPassword, newPasswordConfirm }
// 로그인 사용자가 현재 비밀번호 확인 후 새 비밀번호로 변경.
export async function POST(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const ip = getClientIp(req);
  const rl = await checkRateLimit('change-password', `${session.uid}:${ip}`, 5, '10 m');
  if (!rl.success) return tooManyRequests();

  const body = await req.json().catch(() => ({}));
  const currentPassword = String(body?.currentPassword || '');
  const newPassword = String(body?.newPassword || '');
  const newPasswordConfirm = String(body?.newPasswordConfirm || '');

  if (!currentPassword || !newPassword || !newPasswordConfirm) {
    return NextResponse.json({ error: '모든 항목을 입력해주세요.' }, { status: 400 });
  }
  if (newPassword !== newPasswordConfirm) {
    return NextResponse.json({ error: '새 비밀번호가 일치하지 않습니다.' }, { status: 400 });
  }
  if (!isValidSimplePassword(newPassword)) {
    return NextResponse.json({ error: PASSWORD_POLICY_MESSAGE }, { status: 400 });
  }

  try {
    const rows = await sql`SELECT id, email, password_hash FROM users WHERE id = ${session.uid} LIMIT 1`;
    const u = rows[0];
    if (!u) return NextResponse.json({ error: '회원을 찾을 수 없습니다.' }, { status: 404 });

    const { matched } = await verifyPassword(currentPassword, u.password_hash);
    if (!matched) {
      await logAuth({ type: 'change_password_failure', email: u.email, success: false, req, detail: 'wrong-current' });
      return NextResponse.json({ error: '현재 비밀번호가 올바르지 않습니다.' }, { status: 401 });
    }

    const password_hash = await hashPassword(newPassword);
    await sql`UPDATE users SET password_hash = ${password_hash}, updated_at = now() WHERE id = ${u.id}`;

    await logAuth({ type: 'change_password_success', email: u.email, success: true, req });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
