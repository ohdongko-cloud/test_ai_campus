import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../../lib/db';
import { checkAdmin } from '../../../../../lib/admin-auth';
import { assertCleanFields, BadTextError } from '../../../../../lib/text-validation';
import { reportError } from '../../../../../lib/error-report';

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

// PATCH /api/admin/resources/[id] — 수정 (부분 업데이트)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await checkAdmin(req, 'resources');
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json();

  // 텍스트 필드 한글 인코딩 검사
  const cleanFields: Record<string, string> = {};
  if (typeof body.title === 'string') cleanFields.title = body.title;
  if (typeof body.description === 'string') cleanFields.description = body.description;
  if (typeof body.category === 'string') cleanFields.category = body.category;

  try {
    assertCleanFields(cleanFields, Object.keys(cleanFields));
  } catch (e) {
    if (e instanceof BadTextError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }

  // external_url 검증 (있을 때만)
  let linkType: string | undefined;
  if (typeof body.external_url === 'string') {
    const urlError = validateExternalUrl(body.external_url.trim());
    if (urlError) return NextResponse.json({ error: urlError }, { status: 400 });
    linkType = detectLinkType(body.external_url.trim());
  }

  try {
    const existing = await sql`SELECT id FROM resources WHERE id = ${id}`;
    if (existing.length === 0) {
      return NextResponse.json({ error: '자료를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 있는 필드만 SET. sql 태그드 템플릿은 동적 SET을 지원하지 않으므로
    // sql.query($1, ...) 형식으로 처리.
    const sets: string[] = [];
    const values: unknown[] = [];

    function add(col: string, val: unknown) {
      values.push(val);
      sets.push(`${col} = $${values.length}`);
    }

    if (typeof body.title === 'string')       add('title', body.title.trim());
    if (typeof body.description === 'string') add('description', body.description.trim() || null);
    if (typeof body.category === 'string')    add('category', body.category.trim() || null);
    if (typeof body.external_url === 'string') {
      add('external_url', body.external_url.trim());
      add('link_type', linkType!);
    }
    if (typeof body.is_pinned === 'boolean')  add('is_pinned', body.is_pinned);
    if (Number.isFinite(body.sort_order))     add('sort_order', Number(body.sort_order));

    if (sets.length === 0) return NextResponse.json({ ok: true });

    sets.push(`updated_at = now()`);
    values.push(id);
    const query = `UPDATE resources SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING id`;
    await sql.query(query, values);

    return NextResponse.json({ ok: true });
  } catch (e) {
    reportError(e, { route: 'PATCH /api/admin/resources/[id]' });
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// DELETE /api/admin/resources/[id] — 삭제 (연결 댓글/좋아요 CASCADE)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = await checkAdmin(req, 'resources');
  if (denied) return denied;

  const { id } = await params;

  try {
    const rows = await sql`DELETE FROM resources WHERE id = ${id} RETURNING id`;
    if (rows.length === 0) {
      return NextResponse.json({ error: '자료를 찾을 수 없습니다.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    reportError(e, { route: 'DELETE /api/admin/resources/[id]' });
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
