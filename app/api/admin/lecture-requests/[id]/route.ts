import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../../lib/db';
import { requireAdmin, isDenied } from '../../../../../lib/admin-auth';

// PATCH /api/admin/lecture-requests/[id]  body: { status: 'pending' | 'reviewed' }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req, 'videos');
  if (isDenied(auth)) return auth;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const status = String(body?.status || '');
  if (status !== 'pending' && status !== 'reviewed') {
    return NextResponse.json({ error: '잘못된 상태값입니다.' }, { status: 400 });
  }

  try {
    const rows = await sql`
      UPDATE lecture_requests SET status = ${status}, updated_at = now()
      WHERE id = ${id} RETURNING id`;
    if (rows.length === 0) return NextResponse.json({ error: '요청을 찾을 수 없습니다.' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE /api/admin/lecture-requests/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req, 'videos');
  if (isDenied(auth)) return auth;

  const { id } = await params;
  try {
    await sql`DELETE FROM lecture_requests WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
