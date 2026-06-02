import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../../../../lib/db';
import { getCurrentUser } from '../../../../../../../lib/session';
import { logAuth } from '../../../../../../../lib/audit';
import { checkRateLimit, getClientIp, tooManyRequests } from '../../../../../../../lib/ratelimit';

// GET /api/videos/[id]/attachments/[attId]/download
// 회원 로그인 필수 → audit 로그 + download_count++ → 302 redirect to Blob URL.
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; attId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  // 회원당 1시간 50건
  const rl = await checkRateLimit('attachment-download-user', user.uid, 50, '1 h');
  if (!rl.success) return tooManyRequests('다운로드 횟수 제한을 초과했습니다.');
  // IP 단위 보조 제한
  const ip = getClientIp(req);
  const rlIp = await checkRateLimit('attachment-download-ip', ip, 100, '1 h');
  if (!rlIp.success) return tooManyRequests();

  const { id: videoId, attId } = await ctx.params;
  try {
    const rows = await sql`
      SELECT id, filename, blob_url, mime_type
      FROM video_attachments
      WHERE id = ${attId} AND video_id = ${videoId} LIMIT 1`;
    const att = rows[0];
    if (!att) return NextResponse.json({ error: '첨부파일을 찾을 수 없습니다.' }, { status: 404 });

    // download_count++ + audit log
    await sql`UPDATE video_attachments SET download_count = download_count + 1 WHERE id = ${attId}`;
    try {
      await logAuth({
        type: 'attachment_download',
        email: user.email,
        success: true,
        req,
        detail: `video=${videoId} att=${attId} file=${att.filename}`,
      });
    } catch { /* 로그 실패는 무시 */ }

    // 302 redirect to Blob URL
    return NextResponse.redirect(att.blob_url, { status: 302 });
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
