import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../../lib/db';
import { checkAdmin } from '../../../../../lib/admin-auth';

// PATCH /api/admin/reservations/[id]  body: { status }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await checkAdmin(req, 'meetings');
  if (denied) return denied;
  const { id } = await params;
  const { status } = await req.json();
  if (!['pending', 'confirmed', 'cancelled'].includes(status)) {
    return NextResponse.json({ error: '잘못된 status' }, { status: 400 });
  }
  try {
    await sql`UPDATE reservations SET status = ${status} WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE /api/admin/reservations/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await checkAdmin(req, 'meetings');
  if (denied) return denied;
  const { id } = await params;
  try {
    await sql`DELETE FROM reservations WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
