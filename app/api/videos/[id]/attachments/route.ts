import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../../lib/db';
import { getCurrentUser } from '../../../../../lib/session';

// GET /api/videos/[id]/attachments — 회원용 첨부파일 목록 (로그인 필수)
// blob_url 은 응답에 포함하지 않고, 다운로드는 별도 라우트로 audit 추적.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }
  void req;
  const { id: videoId } = await ctx.params;
  try {
    const rows = await sql`
      SELECT id, filename, size_bytes, mime_type, download_count, created_at
      FROM video_attachments
      WHERE video_id = ${videoId}
      ORDER BY created_at ASC`;
    const res = NextResponse.json(rows.map(r => ({
      id: r.id,
      filename: r.filename,
      sizeBytes: Number(r.size_bytes),
      mimeType: r.mime_type,
      downloadCount: r.download_count,
      createdAt: r.created_at,
    })));
    // 자료 추가/삭제 즉시 반영되도록 캐시 짧게
    res.headers.set('Cache-Control', 'private, max-age=10');
    return res;
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
