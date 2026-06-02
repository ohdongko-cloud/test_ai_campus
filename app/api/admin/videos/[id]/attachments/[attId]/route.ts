import { NextRequest, NextResponse } from 'next/server';
import { del } from '@vercel/blob';
import { sql } from '../../../../../../../lib/db';
import { requireAdmin, isDenied, getActorLabel } from '../../../../../../../lib/admin-auth';
import { logAdminAction } from '../../../../../../../lib/audit';
import { reportError } from '../../../../../../../lib/error-report';

// DELETE /api/admin/videos/[id]/attachments/[attId]
// 첨부파일 삭제 (Blob + DB).
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; attId: string }> },
) {
  const auth = await requireAdmin(req, 'videos');
  if (isDenied(auth)) return auth;

  const { id: videoId, attId } = await ctx.params;
  try {
    const rows = await sql`
      SELECT id, filename, blob_url, blob_pathname
      FROM video_attachments
      WHERE id = ${attId} AND video_id = ${videoId} LIMIT 1`;
    const att = rows[0];
    if (!att) return NextResponse.json({ error: '첨부파일을 찾을 수 없습니다.' }, { status: 404 });

    // Blob 삭제 시도 (실패해도 DB 정리는 계속)
    try {
      await del(att.blob_url);
    } catch (e) {
      reportError(e, { route: 'admin/attachments.delete.blob', detail: { url: att.blob_url } });
    }

    await sql`DELETE FROM video_attachments WHERE id = ${attId}`;

    await logAdminAction({
      action: 'attachment.delete',
      targetType: 'video',
      targetId: videoId,
      detail: { actor: getActorLabel(auth), attId, filename: att.filename },
      req,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    reportError(e, { route: 'admin/attachments.delete', detail: { videoId, attId } });
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
