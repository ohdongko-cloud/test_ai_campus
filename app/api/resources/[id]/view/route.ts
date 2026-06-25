import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../../lib/db';
import { getCurrentUser } from '../../../../../lib/session';
import { checkRateLimit, getClientIp, tooManyRequests } from '../../../../../lib/ratelimit';
import { reportError } from '../../../../../lib/error-report';

// POST /api/resources/[id]/view — 조회수 +1 (레이트리밋)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  // 사내 NAT 고려: 세션 uid 기준 레이트리밋 (넉넉하게 10회/1h)
  const rlKey = user.uid ?? getClientIp(req);
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
