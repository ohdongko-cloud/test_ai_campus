import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../../../lib/db';
import { getCurrentUser } from '../../../../../../lib/session';
import { checkRateLimit, getClientIp, tooManyRequests } from '../../../../../../lib/ratelimit';
import { reportError } from '../../../../../../lib/error-report';

// POST /api/resources/comments/[id]/like — 댓글 좋아요
// DELETE /api/resources/comments/[id]/like — 댓글 좋아요 취소
// resource_comment_likes(comment_id, user_id) PK. like_count 동기화.

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const rlKey = user.uid ?? getClientIp(req);
  const { id } = await params;
  const rl = await checkRateLimit('resource-comment-like', rlKey, 30, '1 h');
  if (!rl.success) return tooManyRequests();

  try {
    const inserted = await sql`
      INSERT INTO resource_comment_likes (comment_id, user_id)
      VALUES (${id}, ${user.uid})
      ON CONFLICT (comment_id, user_id) DO NOTHING
      RETURNING comment_id`;

    if (inserted.length > 0) {
      await sql`UPDATE resource_comments SET like_count = like_count + 1 WHERE id = ${id}`;
    }

    const rows = await sql`SELECT like_count FROM resource_comments WHERE id = ${id}`;
    if (rows.length === 0) {
      return NextResponse.json({ error: '댓글을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json(
      { like_count: rows[0].like_count, liked: true },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    reportError(e, { route: 'POST /api/resources/comments/[id]/like' });
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const rlKey = user.uid ?? getClientIp(req);
  const { id } = await params;
  const rl = await checkRateLimit('resource-comment-like', rlKey, 30, '1 h');
  if (!rl.success) return tooManyRequests();

  try {
    const deleted = await sql`
      DELETE FROM resource_comment_likes
      WHERE comment_id = ${id} AND user_id = ${user.uid}
      RETURNING comment_id`;

    if (deleted.length > 0) {
      await sql`
        UPDATE resource_comments
        SET like_count = GREATEST(0, like_count - 1)
        WHERE id = ${id}`;
    }

    const rows = await sql`SELECT like_count FROM resource_comments WHERE id = ${id}`;
    if (rows.length === 0) {
      return NextResponse.json({ error: '댓글을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json(
      { like_count: rows[0].like_count, liked: false },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    reportError(e, { route: 'DELETE /api/resources/comments/[id]/like' });
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
