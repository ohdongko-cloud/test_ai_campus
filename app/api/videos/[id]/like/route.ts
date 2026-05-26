import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../../lib/db';

// POST /api/videos/[id]/like  body: { sessionId, action: 'like'|'unlike' }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sessionId, action } = await req.json();
  if (!sessionId) return NextResponse.json({ error: 'sessionId 필요' }, { status: 400 });
  if (!id) return NextResponse.json({ error: 'video id 필요' }, { status: 400 });

  try {
    if (action === 'unlike') {
      const removed = await sql`
        DELETE FROM video_likes
        WHERE video_id = ${id} AND session_id = ${sessionId}
        RETURNING id`;
      if (removed.length > 0) {
        await sql`
          INSERT INTO video_stats (video_id, likes_count) VALUES (${id}, 0)
          ON CONFLICT (video_id) DO UPDATE
          SET likes_count = GREATEST(0, video_stats.likes_count - 1)`;
      }
      const rows = await sql`SELECT likes_count FROM video_stats WHERE video_id = ${id}`;
      return NextResponse.json({ likes_count: rows[0]?.likes_count ?? 0, liked: false });
    }

    const inserted = await sql`
      INSERT INTO video_likes (video_id, session_id) VALUES (${id}, ${sessionId})
      ON CONFLICT (video_id, session_id) DO NOTHING
      RETURNING id`;

    if (inserted.length > 0) {
      await sql`
        INSERT INTO video_stats (video_id, likes_count) VALUES (${id}, 1)
        ON CONFLICT (video_id) DO UPDATE
        SET likes_count = video_stats.likes_count + 1`;
    }
    const rows = await sql`SELECT likes_count FROM video_stats WHERE video_id = ${id}`;
    return NextResponse.json({ likes_count: rows[0]?.likes_count ?? 0, liked: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
