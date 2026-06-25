import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../../lib/db';
import { getCurrentUser } from '../../../../../lib/session';
import { getAdminContext } from '../../../../../lib/admin-auth';
import { reportError } from '../../../../../lib/error-report';

// DELETE /api/resources/comments/[id] — 댓글 삭제 (본인 또는 관리자)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const rows = await sql`
      SELECT id, resource_id, user_id FROM resource_comments WHERE id = ${id}`;
    if (rows.length === 0) {
      return NextResponse.json({ error: '댓글을 찾을 수 없습니다.' }, { status: 404 });
    }

    const comment = rows[0];

    // 본인 확인 또는 관리자 확인
    const isOwner = comment.user_id === user.uid;
    if (!isOwner) {
      const adminCtx = await getAdminContext(req);
      if (!adminCtx) {
        return NextResponse.json({ error: '삭제 권한이 없습니다.' }, { status: 403 });
      }
    }

    await sql`DELETE FROM resource_comments WHERE id = ${id}`;
    await sql`
      UPDATE resources
      SET comment_count = GREATEST(0, comment_count - 1)
      WHERE id = ${comment.resource_id}`;

    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    reportError(e, { route: 'DELETE /api/resources/comments/[id]' });
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
