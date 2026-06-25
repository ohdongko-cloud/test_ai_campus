import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../lib/db';
import { getCurrentUser } from '../../../lib/session';
import { reportError } from '../../../lib/error-report';

// GET /api/resources?category=xxx
// 로그인 회원 전용, no-store. user_id 비노출.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category') || '';

  try {
    const rows = category
      ? await sql`
          SELECT id, title, description, category, external_url, link_type,
                 view_count, like_count, comment_count, is_pinned, sort_order, created_at
          FROM resources
          WHERE category = ${category}
          ORDER BY is_pinned DESC, sort_order ASC, created_at DESC`
      : await sql`
          SELECT id, title, description, category, external_url, link_type,
                 view_count, like_count, comment_count, is_pinned, sort_order, created_at
          FROM resources
          ORDER BY is_pinned DESC, sort_order ASC, created_at DESC`;

    return NextResponse.json(rows, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    reportError(e, { route: 'GET /api/resources' });
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
