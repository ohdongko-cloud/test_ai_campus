import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../lib/db';
import { checkRateLimit, getClientIp, tooManyRequests } from '../../../lib/ratelimit';
import { containsReplacementChar } from '../../../lib/text-validation';

// POST /api/lecture-requests  body: { title, content, name?, email? }
// 사용자 강의 요청 제출 (auth 불필요, 레이트리밋 적용).
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit('lecture-request', ip, 3, '10 m');
  if (!rl.success) return tooManyRequests('잠시 후 다시 시도해주세요.');

  const body = await req.json().catch(() => ({}));
  const title = String(body?.title || '').trim();
  const content = String(body?.content || '').trim();
  const name = String(body?.name || '').trim() || null;
  const email = String(body?.email || '').trim() || null;

  if (!title) return NextResponse.json({ error: '요청 제목을 입력해주세요.' }, { status: 400 });
  if (!content) return NextResponse.json({ error: '요청 내용을 입력해주세요.' }, { status: 400 });
  if (title.length > 200) return NextResponse.json({ error: '제목은 200자 이하로 입력해주세요.' }, { status: 400 });
  if (content.length > 2000) return NextResponse.json({ error: '내용은 2000자 이하로 입력해주세요.' }, { status: 400 });
  if (containsReplacementChar(title) || containsReplacementChar(content)) {
    return NextResponse.json({ error: '지원하지 않는 문자가 포함되어 있습니다.' }, { status: 400 });
  }

  try {
    await sql`
      INSERT INTO lecture_requests (title, content, requester_name, requester_email)
      VALUES (${title}, ${content}, ${name}, ${email})`;
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
