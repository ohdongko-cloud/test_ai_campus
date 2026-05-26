import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';

// GET /api/videos/stats?ids=v1,v2,v3&sessionId=xxx
// 응답: [{ video_id, likes_count, comments_count, liked }]
//   - 없는 video_id는 0/0/false 로 채워서 반환
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const idsParam = searchParams.get('ids') || '';
  const sessionId = searchParams.get('sessionId') || '';
  const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean);
  if (ids.length === 0) return NextResponse.json([]);

  try {
    const stats = await sql`
      SELECT video_id, likes_count, comments_count
      FROM video_stats
      WHERE video_id = ANY(${ids}::text[])`;

    const likedRows = sessionId
      ? await sql`
          SELECT video_id FROM video_likes
          WHERE session_id = ${sessionId} AND video_id = ANY(${ids}::text[])`
      : [];
    const likedSet = new Set(likedRows.map(r => r.video_id));

    const byId = new Map(stats.map(r => [r.video_id, r]));
    const out = ids.map(id => {
      const s = byId.get(id);
      return {
        video_id: id,
        likes_count: s?.likes_count ?? 0,
        comments_count: s?.comments_count ?? 0,
        liked: likedSet.has(id),
      };
    });
    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
