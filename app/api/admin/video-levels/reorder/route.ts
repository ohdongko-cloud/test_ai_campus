import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../../lib/db';
import { checkAdmin } from '../../../../../lib/admin-auth';

// POST /api/admin/video-levels/reorder  body: { ids: string[] }
// ids 배열 순서대로 order_idx 0, 1, 2, ... 갱신
export async function POST(req: NextRequest) {
  const denied = await checkAdmin(req, 'videos');
  if (denied) return denied;

  const { ids } = await req.json().catch(() => ({ ids: [] }));
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids 배열이 필요합니다.' }, { status: 400 });
  }

  try {
    for (let i = 0; i < ids.length; i++) {
      await sql`UPDATE video_levels SET order_idx = ${i} WHERE id = ${ids[i]}`;
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
