import { NextRequest, NextResponse } from 'next/server';
import { put, del } from '@vercel/blob';
import { sql } from '../../../../../../../lib/db';
import { requireAdmin, isDenied } from '../../../../../../../lib/admin-auth';
import { reportError } from '../../../../../../../lib/error-report';

// 스테이지 인라인 이미지 — 어드민 전용 업로드/삭제.
// DB(stages JSONB) 업데이트는 클라이언트가 PATCH /api/admin/videos/[id] 에서 stages 통째 저장 시 일괄 처리.

const STAGE_IMAGE_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const MAX_STAGE_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB

// POST /api/admin/videos/[id]/stages/images
// Body: multipart/form-data — file 필드 + stageId 필드(선택, pathname 분기용).
// 응답: { url, pathname }
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req, 'videos');
  if (isDenied(auth)) return auth;
  void auth;

  const { id: videoId } = await ctx.params;
  if (!videoId) return NextResponse.json({ error: 'video id 누락' }, { status: 400 });

  // 영상 존재 확인
  const vrow = await sql`SELECT id FROM videos WHERE id = ${videoId} LIMIT 1`;
  if (vrow.length === 0) return NextResponse.json({ error: '영상을 찾을 수 없습니다.' }, { status: 404 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식 (multipart/form-data 필요).' }, { status: 400 });
  }
  const file = formData.get('file');
  const stageId = String(formData.get('stageId') || 'unknown');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file 필드가 없습니다.' }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: '빈 파일은 업로드할 수 없습니다.' }, { status: 400 });
  }
  if (file.size > MAX_STAGE_IMAGE_BYTES) {
    return NextResponse.json({ error: `이미지 크기가 10MB 한도를 초과합니다.` }, { status: 413 });
  }
  if (!STAGE_IMAGE_MIME.has((file.type || '').toLowerCase())) {
    return NextResponse.json({ error: `지원하지 않는 이미지 형식입니다: ${file.type || 'unknown'}` }, { status: 415 });
  }

  const safeName = file.name.replace(/[\\/:*?"<>|]/g, '_');
  const pathname = `videos/${videoId}/stages/${stageId}/${Date.now()}_${safeName}`;

  try {
    const blob = await put(pathname, file, {
      access: 'public',
      addRandomSuffix: true, // URL 추측 방지 (random suffix)
      contentType: file.type,
    });
    return NextResponse.json({ url: blob.url, pathname }, { status: 201 });
  } catch (e) {
    reportError(e, { route: 'admin/stages/images.upload', detail: { videoId, stageId, filename: safeName } });
    return NextResponse.json({ error: 'Blob 업로드 실패' }, { status: 500 });
  }
}

// DELETE /api/admin/videos/[id]/stages/images
// Body: { url: string } — 삭제할 Blob URL
// DB 정리는 클라이언트가 stages 저장 시 별도 처리.
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req, 'videos');
  if (isDenied(auth)) return auth;
  void auth;

  void ctx; // videoId 는 권한 가드용으로만 사용
  const body = await req.json().catch(() => ({}));
  const url = String(body?.url || '').trim();
  if (!url) return NextResponse.json({ error: 'url 누락' }, { status: 400 });

  try {
    await del(url);
    return NextResponse.json({ ok: true });
  } catch (e) {
    reportError(e, { route: 'admin/stages/images.delete', detail: { url } });
    // Blob 삭제 실패해도 클라이언트가 stage.images 에서 제거하면 화면상 사라짐.
    return NextResponse.json({ ok: false, error: 'Blob 삭제 실패' }, { status: 500 });
  }
}
