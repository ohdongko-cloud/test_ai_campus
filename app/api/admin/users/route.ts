import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';
import { requireMaster, isDenied, getActorLabel, PERMISSION_KEYS } from '../../../../lib/admin-auth';
import { logAdminAction } from '../../../../lib/audit';

// GET /api/admin/users — 위임 관리자 목록 (master 전용)
export async function GET(req: NextRequest) {
  const auth = await requireMaster(req);
  if (isDenied(auth)) return auth;
  try {
    const rows = await sql`
      SELECT id, name, email, corporation_name, organization_name, position, permissions, created_at, updated_at
      FROM users
      WHERE role = 'admin'
      ORDER BY name ASC`;
    return NextResponse.json(rows.map(r => ({
      id: r.id,
      nickname: r.name,
      email: r.email,
      corporationName: r.corporation_name,
      organizationName: r.organization_name,
      position: r.position,
      permissions: r.permissions || {},
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })));
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST /api/admin/users — 이메일로 회원 검색 + admin으로 승격
// body: { email }
export async function POST(req: NextRequest) {
  const auth = await requireMaster(req);
  if (isDenied(auth)) return auth;

  const body = await req.json().catch(() => ({}));
  const email = String(body?.email || '').trim().toLowerCase();
  if (!email) return NextResponse.json({ error: '이메일을 입력해주세요.' }, { status: 400 });

  try {
    const rows = await sql`SELECT id, name, role FROM users WHERE email = ${email} LIMIT 1`;
    const u = rows[0];
    if (!u) return NextResponse.json({ error: '등록된 회원이 아닙니다.' }, { status: 404 });
    if (u.role === 'admin') return NextResponse.json({ error: '이미 관리자입니다.' }, { status: 409 });

    // 기본 권한: admins 제외 모든 키 true
    const defaultPerms: Record<string, boolean> = {};
    for (const k of PERMISSION_KEYS) defaultPerms[k] = k !== 'admins';

    await sql`
      UPDATE users
      SET role = 'admin', permissions = ${JSON.stringify(defaultPerms)}::jsonb
      WHERE id = ${u.id}`;

    await logAdminAction({
      action: 'admin.promote',
      targetType: 'user',
      targetId: u.id,
      detail: { actor: getActorLabel(auth), email, nickname: u.name },
      req,
    });

    return NextResponse.json({ ok: true, id: u.id });
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
