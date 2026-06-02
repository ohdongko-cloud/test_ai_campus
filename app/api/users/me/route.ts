import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';
import { getCurrentUser, clearUserSessionCookie } from '../../../../lib/session';
import { getAdminContext } from '../../../../lib/admin-auth';
import { verifyPassword } from '../../../../lib/password';
import { logAuth } from '../../../../lib/audit';

// GET /api/users/me — 현재 세션 사용자 정보 + 관리자 역할/권한 포함
export async function GET(req: Request) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ user: null });

  try {
    const rows = await sql`
      SELECT id, name, corporation_name, organization_name, position, email
      FROM users WHERE id = ${session.uid} LIMIT 1`;
    const u = rows[0];
    if (!u) return NextResponse.json({ user: null });

    const ctx = await getAdminContext(req);
    const isAdmin = ctx?.role === 'master' || ctx?.role === 'admin' || ctx?.role === 'legacy';
    const isMaster = ctx?.role === 'master' || ctx?.role === 'legacy';

    return NextResponse.json({
      user: {
        id: u.id,
        nickname: u.name,
        email: u.email,
        corporationName: u.corporation_name,
        organizationName: u.organization_name,
        position: u.position,
        role: ctx?.role || 'user',
        isAdmin,
        isMaster,
        permissions: ctx?.role === 'admin' ? (ctx.permissions || {}) : null,
      },
    });
  } catch {
    return NextResponse.json({ user: null });
  }
}

// DELETE /api/users/me — 본인 회원 탈퇴 (비밀번호 재확인 필수)
// 삭제 범위: email_verifications → reservations → users. 세션 쿠키 정리.
export async function DELETE(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const password = String(body?.password || '');
  if (!password) return NextResponse.json({ error: '비밀번호를 입력해주세요.' }, { status: 400 });

  try {
    const rows = await sql`SELECT id, email, password_hash FROM users WHERE id = ${session.uid} LIMIT 1`;
    const u = rows[0];
    if (!u) {
      await clearUserSessionCookie();
      return NextResponse.json({ error: '회원을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 본인 확인 — 비밀번호 검증
    const { matched } = await verifyPassword(password, u.password_hash);
    if (!matched) {
      return NextResponse.json({ error: '비밀번호가 올바르지 않습니다.' }, { status: 401 });
    }

    const email = String(u.email);
    // 개인정보 삭제 (관리자 회원삭제와 동일 범위)
    await sql`DELETE FROM email_verifications WHERE LOWER(email) = LOWER(${email})`;
    await sql`DELETE FROM reservations WHERE LOWER(email) = LOWER(${email})`;
    await sql`DELETE FROM users WHERE id = ${u.id}`;

    await clearUserSessionCookie();
    await logAuth({ type: 'account_delete', email, success: true, req });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
