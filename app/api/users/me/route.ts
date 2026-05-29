import { NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';
import { getCurrentUser } from '../../../../lib/session';
import { getAdminContext } from '../../../../lib/admin-auth';

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
