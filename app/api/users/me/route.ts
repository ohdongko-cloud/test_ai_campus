import { NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';
import { getCurrentUser } from '../../../../lib/session';

// GET /api/users/me — 현재 세션 사용자 정보
export async function GET() {
  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ user: null });

  try {
    const rows = await sql`
      SELECT id, name, corporation_name, organization_name, position, email
      FROM users WHERE id = ${session.uid} LIMIT 1`;
    const u = rows[0];
    if (!u) return NextResponse.json({ user: null });
    return NextResponse.json({
      user: {
        id: u.id,
        nickname: u.name,
        email: u.email,
        corporationName: u.corporation_name,
        organizationName: u.organization_name,
        position: u.position,
      },
    });
  } catch {
    return NextResponse.json({ user: null });
  }
}
