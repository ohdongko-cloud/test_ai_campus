import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../../lib/db';
import { checkRateLimit, getClientIp, tooManyRequests } from '../../../../../lib/ratelimit';
import { reportError } from '../../../../../lib/error-report';

// POST /api/resources/[id]/view — 조회수 +1 (열람 공개, IP 레이트리밋)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // 열람은 비로그인도 허용 → IP 기준 레이트리밋 (10회/1h)
  const rlKey = getClientIp(req);
  const { id } = await params;
  const rl = await checkRateLimit(`resource-view:${id}`, rlKey, 10, '1 h');
  if (!rl.success) return tooManyRequests();

  try {
    const rows = await sql`SELECT id FROM resources WHERE id = ${id}`;
    if (rows.length === 0) {
      return NextResponse.json({ error: '자료를 찾을 수 없습니다.' }, { status: 404 });
    }
    await sql`UPDATE resources SET view_count = view_count + 1 WHERE id = ${id}`;
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    reportError(e, { route: 'POST /api/resources/[id]/view' });
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
