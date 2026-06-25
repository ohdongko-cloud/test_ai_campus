import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../lib/db';
import { reportError } from '../../../lib/error-report';

// GET /api/resources?category=xxx
// 열람은 공개(게시판과 동일 패턴 — 앱은 클라이언트에서 로그인 게이트). no-store. user_id 비노출.
export async function GET(req: NextRequest) {
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
