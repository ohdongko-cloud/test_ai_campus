import { NextResponse } from 'next/server';
import { sql } from '../../../lib/db';

// GET /api/videos → 영상 목록 (order_idx 오름차순)
export async function GET() {
  try {
    const rows = await sql`
      SELECT id, title, level, description, youtube_url, view_count, stages, order_idx
      FROM videos
      ORDER BY order_idx ASC, created_at ASC`;
    // Map snake_case → camelCase (클라이언트의 Video 타입 유지)
    const out = rows.map(r => ({
      id: r.id,
      title: r.title,
      level: r.level,
      description: r.description,
      youtubeUrl: r.youtube_url,
      viewCount: r.view_count,
      stages: r.stages || [],
      order: r.order_idx,
    }));
    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
