import { NextRequest, NextResponse } from 'next/server';
import { put, del } from '@vercel/blob';
import { requireAdmin, isDenied } from '../../../../../lib/admin-auth';

// GET /api/admin/debug/blob
// Vercel Blob 동작 진단 — 인증된 어드민이 호출하면 작은 텍스트 1KB 를 put 시도.
// 환경변수/네트워크/권한 모두 점검. 결과를 JSON 으로 반환.
//
// 사용법: 브라우저 주소창에 https://retail-ai-campus.vercel.app/api/admin/debug/blob
//        직접 입력 (관리자 로그인 상태) → JSON 응답 확인.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'videos');
  if (isDenied(auth)) return auth;

  const report: Record<string, unknown> = {
    step: 'init',
    envTokenPresent: !!process.env.BLOB_READ_WRITE_TOKEN,
    envTokenLength: (process.env.BLOB_READ_WRITE_TOKEN || '').length,
    nodeVersion: process.version,
  };

  // 1. 작은 텍스트 put 시도
  const pathname = `debug/diag-${Date.now()}.txt`;
  const content = `Vercel Blob diagnostic test at ${new Date().toISOString()}`;

  try {
    report.step = 'put';
    const result = await put(pathname, content, {
      access: 'public',
      addRandomSuffix: false,
      contentType: 'text/plain',
    });
    report.putOk = true;
    report.blobUrl = result.url;
    report.blobPathname = result.pathname;

    // 2. 즉시 정리 (테스트 데이터)
    try {
      report.step = 'del';
      await del(result.url);
      report.delOk = true;
    } catch (delErr) {
      report.delOk = false;
      report.delError = delErr instanceof Error ? delErr.message : String(delErr);
    }

    report.step = 'success';
    return NextResponse.json({
      ok: true,
      message: 'Vercel Blob 정상 동작 ✅',
      ...report,
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      message: 'Vercel Blob put 실패 ❌',
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack?.split('\n').slice(0, 8) : undefined,
      ...report,
    }, { status: 500 });
  }
}
