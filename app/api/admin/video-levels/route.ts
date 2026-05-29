import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';
import { requireAdmin } from '../../../../lib/admin-auth';

// POST /api/admin/video-levels  body: { name, description? }
export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { name, description } = await req.json();
  const trimmed = String(name || '').trim();
  if (!trimmed) return NextResponse.json({ error: 'name 필수' }, { status: 400 });

  try {
    const id = crypto.randomUUID();
    const ord = (await sql`SELECT COALESCE(MAX(order_idx), -1) + 1 AS next FROM video_levels`)[0].next;
    await sql`
      INSERT INTO video_levels (id, name, description, order_idx)
      VALUES (${id}, ${trimmed}, ${description || ''}, ${ord})`;
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (e) {
    const msg = String(e);
    if (msg.includes('unique')) return NextResponse.json({ error: '이미 존재하는 레벨명입니다.' }, { status: 409 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
