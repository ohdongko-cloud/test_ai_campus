import { NextRequest, NextResponse } from 'next/server';
import { put, del } from '@vercel/blob';
import { sql } from '../../../../../../lib/db';
import { requireAdmin, isDenied, getActorLabel } from '../../../../../../lib/admin-auth';
import { logAdminAction } from '../../../../../../lib/audit';
import { reportError } from '../../../../../../lib/error-report';
import {
  MAX_ATTACHMENT_SIZE_BYTES,
  MAX_ATTACHMENTS_PER_VIDEO,
  isAllowedFile,
} from '../../../../../../lib/attachments';

// POST /api/admin/videos/[id]/attachments
// 영상 첨부파일 업로드 (어드민 전용, 'videos' 권한).
// multipart/form-data — file 필드에 파일.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const tag = `[ATT-UPLOAD ${Date.now()}]`;
  console.log(`${tag} 1) 시작 — Content-Length:`, req.headers.get('content-length'),
    'Content-Type:', req.headers.get('content-type'));

  const auth = await requireAdmin(req, 'videos');
  if (isDenied(auth)) {
    console.log(`${tag} 2) 인증 실패`);
    return auth;
  }
  console.log(`${tag} 2) 인증 OK — role:`, auth.role, 'email:', auth.email);

  const { id: videoId } = await ctx.params;
  if (!videoId) return NextResponse.json({ error: 'video id 누락' }, { status: 400 });
  console.log(`${tag} 3) videoId:`, videoId);

  // 영상 존재 확인
  const vrow = await sql`SELECT id FROM videos WHERE id = ${videoId} LIMIT 1`;
  if (vrow.length === 0) {
    console.log(`${tag} 4) 영상 없음`);
    return NextResponse.json({ error: '영상을 찾을 수 없습니다.' }, { status: 404 });
  }
  console.log(`${tag} 4) 영상 존재 확인 OK`);

  // 영상당 첨부 한도 확인
  const cnt = await sql`SELECT COUNT(*)::int AS n FROM video_attachments WHERE video_id = ${videoId}`;
  if ((cnt[0]?.n ?? 0) >= MAX_ATTACHMENTS_PER_VIDEO) {
    console.log(`${tag} 5) 한도 초과 — 현재:`, cnt[0].n);
    return NextResponse.json(
      { error: `영상당 최대 ${MAX_ATTACHMENTS_PER_VIDEO}개까지 등록 가능합니다.` },
      { status: 409 },
    );
  }
  console.log(`${tag} 5) 한도 OK — 현재:`, cnt[0]?.n ?? 0);

  // multipart parse
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (e) {
    console.error(`${tag} 6) formData parse 실패:`, e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: 'multipart parsing 실패 — ' + (e instanceof Error ? e.message : 'unknown') }, { status: 400 });
  }
  const file = formData.get('file');
  console.log(`${tag} 6) formData OK — file 필드 타입:`, file?.constructor?.name || typeof file);
  if (!(file instanceof File)) {
    console.log(`${tag} 7) file 필드가 File 아님 — 받은 keys:`, [...formData.keys()]);
    return NextResponse.json({ error: 'file 필드가 없습니다.' }, { status: 400 });
  }
  console.log(`${tag} 7) file 정보 — name:`, file.name, 'size:', file.size, 'type:', file.type);

  // 사이즈 검증
  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return NextResponse.json(
      { error: `파일 크기가 ${Math.round(MAX_ATTACHMENT_SIZE_BYTES / 1024 / 1024)}MB 한도를 초과합니다.` },
      { status: 413 },
    );
  }
  if (file.size === 0) {
    return NextResponse.json({ error: '빈 파일은 업로드할 수 없습니다.' }, { status: 400 });
  }

  // MIME + 확장자 화이트리스트 (둘 중 하나라도 통과)
  if (!isAllowedFile(file.name, file.type)) {
    console.log(`${tag} 8) MIME/확장자 거부`);
    return NextResponse.json(
      { error: `지원하지 않는 파일 형식입니다 (${file.type || '확장자: ' + (file.name.split('.').pop() || 'unknown')}).` },
      { status: 415 },
    );
  }
  console.log(`${tag} 8) 형식 OK`);

  // 파일명 안전화 (충돌 회피 + 한글 보존)
  const safeFilename = file.name.replace(/[\\/:*?"<>|]/g, '_');
  const blobPathname = `videos/${videoId}/${Date.now()}_${safeFilename}`;
  console.log(`${tag} 9) Blob put 시도 — pathname:`, blobPathname,
    'BLOB_READ_WRITE_TOKEN 존재:', !!process.env.BLOB_READ_WRITE_TOKEN);

  // Blob 업로드
  let blobResult;
  try {
    blobResult = await put(blobPathname, file, {
      access: 'public', // 직접 URL 접근 가능. 보호는 서버 다운로드 라우트에서 audit 처리.
      addRandomSuffix: false,
      contentType: file.type || 'application/octet-stream',
    });
    console.log(`${tag} 10) Blob put OK — url:`, blobResult.url);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`${tag} 10) Blob put 실패:`, msg, e instanceof Error ? e.stack : '');
    reportError(e, { route: 'admin/videos/attachments.upload.blob', detail: { videoId, filename: safeFilename } });
    return NextResponse.json({ error: 'Blob 업로드 실패: ' + msg }, { status: 500 });
  }

  // DB INSERT (실패 시 Blob 정리)
  try {
    const uploadedBy = auth.userId ?? null;
    const inserted = await sql`
      INSERT INTO video_attachments
        (video_id, filename, blob_pathname, blob_url, size_bytes, mime_type, uploaded_by)
      VALUES
        (${videoId}, ${file.name}, ${blobPathname}, ${blobResult.url}, ${file.size}, ${file.type}, ${uploadedBy})
      RETURNING id, filename, size_bytes, mime_type, download_count, created_at`;

    await logAdminAction({
      action: 'attachment.upload',
      targetType: 'video',
      targetId: videoId,
      detail: { actor: getActorLabel(auth), filename: file.name, size: file.size },
      req,
    });

    const r = inserted[0];
    return NextResponse.json({
      id: r.id,
      filename: r.filename,
      sizeBytes: Number(r.size_bytes),
      mimeType: r.mime_type,
      downloadCount: r.download_count,
      createdAt: r.created_at,
    }, { status: 201 });
  } catch (e) {
    // orphan blob 회수
    try { await del(blobResult.url); } catch (delErr) {
      reportError(delErr, { route: 'admin/videos/attachments.upload.cleanup', detail: { url: blobResult.url } });
    }
    reportError(e, { route: 'admin/videos/attachments.upload.db', detail: { videoId, filename: file.name } });
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// GET /api/admin/videos/[id]/attachments — 어드민용 목록 (조회 자체는 회원도 가능하나 어드민 UI 용)
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req, 'videos');
  if (isDenied(auth)) return auth;

  const { id: videoId } = await ctx.params;
  try {
    const rows = await sql`
      SELECT id, filename, size_bytes, mime_type, download_count, created_at
      FROM video_attachments
      WHERE video_id = ${videoId}
      ORDER BY created_at ASC`;
    return NextResponse.json(rows.map(r => ({
      id: r.id,
      filename: r.filename,
      sizeBytes: Number(r.size_bytes),
      mimeType: r.mime_type,
      downloadCount: r.download_count,
      createdAt: r.created_at,
    })));
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
