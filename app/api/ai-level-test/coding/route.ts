import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { sql } from '../../../../lib/db';
import { getCurrentUser } from '../../../../lib/session';
import { checkRateLimit, getClientIp, tooManyRequests } from '../../../../lib/ratelimit';
import { reportError } from '../../../../lib/error-report';

// POST /api/ai-level-test/coding  (multipart/form-data)
// 코딩(질) 산출물 제출: 파일(zip/html/이미지) 또는 링크 + 서비스 설명·계정 필요여부·테스트 계정.
// 관리자 주1회 오프라인 채점 대상으로 저장(점수는 추후 관리자 입력).
const MAX_FILE = 25 * 1024 * 1024; // 25MB
const ALLOWED_EXT = ['.zip', '.html', '.htm', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf'];

export async function POST(req: NextRequest) {
  const session = await getCurrentUser();
  if (!session?.uid) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const rl = await checkRateLimit('ai-level-coding', `uid:${session.uid}`, 20, '10 m');
  if (!rl.success) return tooManyRequests();

  let form: FormData;
  try { form = await req.formData(); }
  catch { return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 }); }

  const serviceDesc = String(form.get('serviceDesc') || '').slice(0, 1000);
  const needsAccount = String(form.get('needsAccount') || '') === 'yes';
  const testAccount = String(form.get('testAccount') || '').slice(0, 200) || null;
  const linkUrl = String(form.get('linkUrl') || '').slice(0, 1000) || null;
  const file = form.get('file');

  // 링크도 파일도 없으면 거부 (스킵은 클라이언트가 API 호출 안 함)
  const hasFile = file instanceof File && file.size > 0;
  if (!hasFile && !linkUrl) {
    return NextResponse.json({ error: '링크 또는 파일 중 하나는 제출해주세요.' }, { status: 400 });
  }

  let blobUrl: string | null = null, blobPathname: string | null = null, filename: string | null = null;
  if (hasFile) {
    const f = file as File;
    const ext = (f.name.match(/\.[a-zA-Z0-9]+$/)?.[0] || '').toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      return NextResponse.json({ error: 'zip·html·이미지·pdf 파일만 올릴 수 있습니다.' }, { status: 400 });
    }
    if (f.size > MAX_FILE) {
      return NextResponse.json({ error: '파일 크기가 25MB 한도를 초과합니다. 링크 제출을 이용해주세요.' }, { status: 400 });
    }
    const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
    blobPathname = `ai-level/${session.uid}/${Date.now()}_${safe}`;
    try {
      const res = await put(blobPathname, f, { access: 'public', addRandomSuffix: false, contentType: f.type || 'application/octet-stream' });
      blobUrl = res.url; filename = f.name;
    } catch (e) {
      reportError(e, { route: 'ai-level-test/coding.blob' });
      return NextResponse.json({ error: '파일 업로드에 실패했습니다. 잠시 후 다시 시도해주세요.' }, { status: 500 });
    }
  }

  try {
    await sql`
      INSERT INTO ai_level_coding
        (user_id, email, submit_kind, link_url, blob_url, blob_pathname, filename, service_desc, needs_account, test_account)
      VALUES (${session.uid}, ${session.email ?? null}, ${hasFile ? 'file' : 'link'},
              ${linkUrl}, ${blobUrl}, ${blobPathname}, ${filename}, ${serviceDesc}, ${needsAccount}, ${testAccount})`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    reportError(e, { route: 'ai-level-test/coding.insert' });
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
