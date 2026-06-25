import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';
import { checkAdmin } from '../../../../lib/admin-auth';
import { assertCleanFields, BadTextError } from '../../../../lib/text-validation';
import { reportError } from '../../../../lib/error-report';

/** link_type 자동 판별: drive → notion → url */
function detectLinkType(url: string): 'drive' | 'notion' | 'url' {
  if (url.includes('drive.google.com') || url.includes('docs.google.com')) return 'drive';
  if (url.includes('notion.so') || url.includes('notion.site')) return 'notion';
  return 'url';
}

/** external_url 안전성 검증: https://로 시작하는 유효한 URL만 허용 */
function validateExternalUrl(url: string): string | null {
  if (!url || !url.startsWith('https://')) return '링크는 https://로 시작해야 합니다.';
  try {
    new URL(url);
    return null;
  } catch {
    return '유효하지 않은 URL입니다.';
  }
}

// GET /api/admin/resources — 관리용 전체 목록 (master 또는 resources 권한)
export async function GET(req: NextRequest) {
  const denied = await checkAdmin(req, 'resources');
  if (denied) return denied;

  try {
    const rows = await sql`
      SELECT id, title, description, category, external_url, link_type,
             created_by, view_count, like_count, comment_count,
             is_pinned, sort_order, created_at, updated_at
      FROM resources
      ORDER BY is_pinned DESC, sort_order ASC, created_at DESC`;

    return NextResponse.json(rows, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    reportError(e, { route: 'GET /api/admin/resources' });
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST /api/admin/resources — 자료 등록
// body: { title, description?, category?, external_url, is_pinned?, sort_order? }
export async function POST(req: NextRequest) {
  const denied = await checkAdmin(req, 'resources');
  if (denied) return denied;

  const body = await req.json();
  const title: string = (body.title ?? '').trim();
  const description: string = (body.description ?? '').trim();
  const category: string = (body.category ?? '').trim();
  const externalUrl: string = (body.external_url ?? '').trim();
  const isPinned: boolean = typeof body.is_pinned === 'boolean' ? body.is_pinned : false;
  const sortOrder: number = Number.isFinite(body.sort_order) ? Number(body.sort_order) : 0;

  if (!title) {
    return NextResponse.json({ error: 'title은 필수입니다.' }, { status: 400 });
  }
  const urlError = validateExternalUrl(externalUrl);
  if (urlError) {
    return NextResponse.json({ error: urlError }, { status: 400 });
  }

  try {
    assertCleanFields({ title, description, category }, ['title', 'description', 'category']);
  } catch (e) {
    if (e instanceof BadTextError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }

  const linkType = detectLinkType(externalUrl);

  try {
    const rows = await sql`
      INSERT INTO resources (title, description, category, external_url, link_type, is_pinned, sort_order)
      VALUES (${title}, ${description || null}, ${category || null}, ${externalUrl}, ${linkType}, ${isPinned}, ${sortOrder})
      RETURNING id`;

    return NextResponse.json({ ok: true, id: rows[0].id }, { status: 201 });
  } catch (e) {
    reportError(e, { route: 'POST /api/admin/resources' });
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
