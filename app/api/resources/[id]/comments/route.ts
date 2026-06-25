import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../../lib/db';
import { getCurrentUser } from '../../../../../lib/session';
import { checkRateLimit, getClientIp, tooManyRequests } from '../../../../../lib/ratelimit';
import { containsReplacementChar } from '../../../../../lib/text-validation';
import { reportError } from '../../../../../lib/error-report';

const COMMENT_MAX_LENGTH = 1000;

// GET /api/resources/[id]/comments — 댓글 목록
// user_id 비노출, author_name·content·created_at·like_count만 반환.
export async function GET(
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
      SELECT id, author_name, content, like_count, created_at
      FROM resource_comments
      WHERE resource_id = ${id}
      ORDER BY created_at ASC`;

    return NextResponse.json(rows, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    reportError(e, { route: 'GET /api/resources/[id]/comments' });
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST /api/resources/[id]/comments — 댓글 작성 (레이트리밋)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  // 사내 NAT 고려: 세션 uid 기준 레이트리밋 (5회/30s)
  const rlKey = user.uid ?? getClientIp(req);
  const rl = await checkRateLimit('resource-comment', rlKey, 5, '30 s');
  if (!rl.success) return tooManyRequests();

  const { id } = await params;
  const body = await req.json();
  const content: string = (body.content ?? '').trim();

  if (!content) {
    return NextResponse.json({ error: '내용은 필수입니다.' }, { status: 400 });
  }
  if (content.length > COMMENT_MAX_LENGTH) {
    return NextResponse.json(
      { error: `댓글은 ${COMMENT_MAX_LENGTH}자 이하여야 합니다.` },
      { status: 400 },
    );
  }
  if (containsReplacementChar(content)) {
    return NextResponse.json(
      { error: '지원하지 않는 문자가 포함되어 있습니다.' },
      { status: 400 },
    );
  }

  try {
    // 자료 존재 확인
    const res = await sql`SELECT id FROM resources WHERE id = ${id}`;
    if (res.length === 0) {
      return NextResponse.json({ error: '자료를 찾을 수 없습니다.' }, { status: 404 });
    }

    // author_name: 세션에서 이름을 얻을 수 없으면 이메일 로컬파트를 표시명으로 사용
    // (users.name을 JOIN해 가져옴)
    const userRows = await sql`SELECT name FROM users WHERE id = ${user.uid} LIMIT 1`;
    const authorName: string = userRows[0]?.name ?? user.email.split('@')[0];

    await sql`
      INSERT INTO resource_comments (resource_id, user_id, author_name, content)
      VALUES (${id}, ${user.uid}, ${authorName}, ${content})`;

    await sql`
      UPDATE resources SET comment_count = comment_count + 1 WHERE id = ${id}`;

    return NextResponse.json({ ok: true }, {
      status: 201,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    reportError(e, { route: 'POST /api/resources/[id]/comments' });
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
