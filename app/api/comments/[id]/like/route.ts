import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../../lib/db';

// POST /api/comments/[id]/like  body: { sessionId, action: 'like'|'unlike' }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sessionId, action } = await req.json();
  if (!sessionId) return NextResponse.json({ error: 'sessionId 필요' }, { status: 400 });

  try {
    if (action === 'unlike') {
      await sql`DELETE FROM comment_likes WHERE comment_id = ${id} AND session_id = ${sessionId}`;
      await sql`UPDATE comments SET likes_count = GREATEST(0, likes_count - 1) WHERE id = ${id}`;
      const rows = await sql`SELECT likes_count FROM comments WHERE id = ${id}`;
      return NextResponse.json({ likes_count: rows[0]?.likes_count ?? 0, liked: false });
    }

    const inserted = await sql`
      INSERT INTO comment_likes (comment_id, session_id) VALUES (${id}, ${sessionId})
      ON CONFLICT (comment_id, session_id) DO NOTHING
      RETURNING id`;

    if (inserted.length > 0) {
      await sql`UPDATE comments SET likes_count = likes_count + 1 WHERE id = ${id}`;
    }
    const rows = await sql`SELECT likes_count FROM comments WHERE id = ${id}`;
    return NextResponse.json({ likes_count: rows[0]?.likes_count ?? 0, liked: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
