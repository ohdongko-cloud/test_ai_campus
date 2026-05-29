import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../../lib/db';
import { requireMaster, isDenied, getActorLabel, PERMISSION_KEYS } from '../../../../../lib/admin-auth';
import { logAdminAction } from '../../../../../lib/audit';

// PATCH /api/admin/users/[id]  body: { permissions: Record<string, boolean> }
// 위임 관리자의 권한 갱신.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMaster(req);
  if (isDenied(auth)) return auth;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const incoming = (body?.permissions || {}) as Record<string, unknown>;

  // 허용된 키만 + boolean으로 강제. admins 키는 항상 false 강제 (위임 관리자는 다른 관리자 임명 불가)
  const clean: Record<string, boolean> = {};
  for (const k of PERMISSION_KEYS) {
    if (k === 'admins') { clean[k] = false; continue; }
    clean[k] = !!incoming[k];
  }

  try {
    const rows = await sql`SELECT email, name, role FROM users WHERE id = ${id} LIMIT 1`;
    const u = rows[0];
    if (!u) return NextResponse.json({ error: '회원을 찾을 수 없습니다.' }, { status: 404 });
    if (u.role !== 'admin') return NextResponse.json({ error: '위임 관리자가 아닙니다.' }, { status: 400 });

    await sql`UPDATE users SET permissions = ${JSON.stringify(clean)}::jsonb WHERE id = ${id}`;

    await logAdminAction({
      action: 'admin.permissions_changed',
      targetType: 'user',
      targetId: id,
      detail: { actor: getActorLabel(auth), email: u.email, permissions: clean },
      req,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// DELETE /api/admin/users/[id] — 관리자 권한 해지
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMaster(req);
  if (isDenied(auth)) return auth;

  const { id } = await params;
  try {
    const rows = await sql`SELECT email, name, role FROM users WHERE id = ${id} LIMIT 1`;
    const u = rows[0];
    if (!u) return NextResponse.json({ error: '회원을 찾을 수 없습니다.' }, { status: 404 });
    if (u.role !== 'admin') return NextResponse.json({ error: '위임 관리자가 아닙니다.' }, { status: 400 });

    await sql`UPDATE users SET role = 'user', permissions = '{}'::jsonb WHERE id = ${id}`;

    await logAdminAction({
      action: 'admin.demote',
      targetType: 'user',
      targetId: id,
      detail: { actor: getActorLabel(auth), email: u.email, nickname: u.name },
      req,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
