import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../../lib/db';
import { getCurrentUser } from '../../../../../lib/session';
import { checkRateLimit, getClientIp, tooManyRequests } from '../../../../../lib/ratelimit';
import { reportError } from '../../../../../lib/error-report';

// POST /api/resources/[id]/like — 좋아요
// DELETE /api/resources/[id]/like — 좋아요 취소
// resource_likes(resource_id, user_id) PK로 중복 방지. like_count 동기화.

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  // 사내 NAT 고려: 세션 uid 기준 레이트리밋 (30회/1h)
  const rlKey = user.uid ?? getClientIp(req);
  const { id } = await params;
  const rl = await checkRateLimit('resource-like', rlKey, 30, '1 h');
  if (!rl.success) return tooManyRequests();

  try {
    const inserted = await sql`
      INSERT INTO resource_likes (resource_id, user_id)
      VALUES (${id}, ${user.uid})
      ON CONFLICT (resource_id, user_id) DO NOTHING
      RETURNING resource_id`;

    if (inserted.length > 0) {
      await sql`UPDATE resources SET like_count = like_count + 1 WHERE id = ${id}`;
    }

    const rows = await sql`SELECT like_count FROM resources WHERE id = ${id}`;
    return NextResponse.json(
      { like_count: rows[0]?.like_count ?? 0, liked: true },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    reportError(e, { route: 'POST /api/resources/[id]/like' });
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const rlKey = user.uid ?? getClientIp(req);
  const { id } = await params;
  const rl = await checkRateLimit('resource-like', rlKey, 30, '1 h');
  if (!rl.success) return tooManyRequests();

  try {
    const deleted = await sql`
      DELETE FROM resource_likes
      WHERE resource_id = ${id} AND user_id = ${user.uid}
      RETURNING resource_id`;

    if (deleted.length > 0) {
      await sql`UPDATE resources SET like_count = GREATEST(0, like_count - 1) WHERE id = ${id}`;
    }

    const rows = await sql`SELECT like_count FROM resources WHERE id = ${id}`;
    return NextResponse.json(
      { like_count: rows[0]?.like_count ?? 0, liked: false },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    reportError(e, { route: 'DELETE /api/resources/[id]/like' });
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
