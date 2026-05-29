import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../../lib/db';
import { checkAdmin } from '../../../../../lib/admin-auth';

// DELETE /api/admin/blocked-slots/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await checkAdmin(req, 'meetings');
  if (denied) return denied;
  const { id } = await params;
  try {
    await sql`DELETE FROM blocked_slots WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
