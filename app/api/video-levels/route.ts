import { NextResponse } from 'next/server';
import { sql } from '../../../lib/db';

// GET /api/video-levels
export async function GET() {
  try {
    const rows = await sql`
      SELECT id, name, description, order_idx
      FROM video_levels
      ORDER BY order_idx ASC, name ASC`;
    const res = NextResponse.json(rows.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
    })));
    res.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res;
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
