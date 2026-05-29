import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../../lib/db';
import { requireAdmin } from '../../../../../lib/admin-auth';

// DELETE /api/admin/services/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const { id } = await params;
  try {
    await sql`DELETE FROM shared_services WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
