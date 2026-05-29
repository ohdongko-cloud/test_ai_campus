import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../../lib/db';
import { requireAdmin } from '../../../../../lib/admin-auth';

// POST /api/admin/videos/reorder  body: { ids: string[] }
// ids 배열 순서대로 order_idx 0, 1, 2, ... 갱신
export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { ids } = await req.json();
  if (!Array.isArray(ids)) return NextResponse.json({ error: 'ids 배열 필요' }, { status: 400 });

  try {
    for (let i = 0; i < ids.length; i++) {
      await sql`UPDATE videos SET order_idx = ${i} WHERE id = ${ids[i]}`;
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
