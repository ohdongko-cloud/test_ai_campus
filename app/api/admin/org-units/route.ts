import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';
import { requireMaster, isDenied } from '../../../../lib/admin-auth';
import { assertCleanFields, BadTextError } from '../../../../lib/text-validation';
import { checkRateLimit, getClientIp, tooManyRequests } from '../../../../lib/ratelimit';
import { ORG_DIRECTORY_CORP } from '../../../../lib/org';

// /api/admin/org-units — 부서/직무 조직 분류 관리 (마스터 전용)
//   GET    : 전체 행 조회 (비활성 포함)
//   POST   : (부서, 직무) 행 추가
//   PATCH  : 행 수정(직무명/활성/순서) 또는 부서명 일괄 변경
//   DELETE : ?id= 단일 직무 삭제 또는 ?department= 부서 전체 삭제

const MAX_LEN = 60;

function isDuplicateErr(e: unknown): boolean {
  return String(e).includes('duplicate key') || String(e).includes('unique constraint');
}

function validateText(value: string, field: string): string | null {
  const v = value.trim();
  if (!v) return `${field}을(를) 입력해주세요.`;
  if (v.length > MAX_LEN) return `${field}은(는) ${MAX_LEN}자 이내로 입력해주세요.`;
  return null;
}

export async function GET(req: NextRequest) {
  const auth = await requireMaster(req);
  if (isDenied(auth)) return auth;
  try {
    const corp = (req.nextUrl.searchParams.get('corp') || ORG_DIRECTORY_CORP).trim();
    const rows = await sql`
      SELECT id, corporation_name, department, position, sort_order, is_active
      FROM org_units
      WHERE corporation_name = ${corp}
      ORDER BY sort_order ASC, department ASC, position ASC`;
    return NextResponse.json({ ok: true, corporation: corp, units: rows }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireMaster(req);
  if (isDenied(auth)) return auth;
  const rl = await checkRateLimit('admin-org-units', getClientIp(req), 60, '1 m');
  if (!rl.success) return tooManyRequests();

  const body = await req.json().catch(() => ({}));
  const corp = String(body.corporationName || ORG_DIRECTORY_CORP).trim();
  const department = String(body.department ?? '');
  const position = String(body.position ?? '');

  const err = validateText(department, '부서') || validateText(position, '직무');
  if (err) return NextResponse.json({ error: err }, { status: 400 });
  try {
    assertCleanFields({ corp, department, position }, ['corp', 'department', 'position']);
  } catch (e) {
    if (e instanceof BadTextError) return NextResponse.json({ error: '지원하지 않는 문자가 포함되어 있습니다.' }, { status: 400 });
    throw e;
  }

  try {
    // sort_order: 같은 부서의 마지막 다음 순번
    const maxRow = await sql`
      SELECT COALESCE(MAX(sort_order), 0) AS m FROM org_units
      WHERE corporation_name = ${corp} AND department = ${department.trim()}`;
    const nextOrder = Number(maxRow[0]?.m ?? 0) + 1;
    const rows = await sql`
      INSERT INTO org_units (corporation_name, department, position, sort_order)
      VALUES (${corp}, ${department.trim()}, ${position.trim()}, ${nextOrder})
      ON CONFLICT (corporation_name, department, position) DO NOTHING
      RETURNING id`;
    if (rows.length === 0) {
      return NextResponse.json({ error: '이미 존재하는 부서/직무입니다.' }, { status: 409 });
    }
    return NextResponse.json({ ok: true, id: rows[0].id }, { status: 201 });
  } catch (e) {
    if (isDuplicateErr(e)) return NextResponse.json({ error: '이미 존재하는 부서/직무입니다.' }, { status: 409 });
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireMaster(req);
  if (isDenied(auth)) return auth;
  const rl = await checkRateLimit('admin-org-units', getClientIp(req), 60, '1 m');
  if (!rl.success) return tooManyRequests();

  const body = await req.json().catch(() => ({}));

  try {
    // 1) 부서명 일괄 변경
    if (body.action === 'renameDepartment') {
      const corp = String(body.corporationName || ORG_DIRECTORY_CORP).trim();
      const from = String(body.from ?? '').trim();
      const to = String(body.to ?? '').trim();
      const err = validateText(from, '기존 부서') || validateText(to, '새 부서');
      if (err) return NextResponse.json({ error: err }, { status: 400 });
      try {
        assertCleanFields({ to }, ['to']);
      } catch {
        return NextResponse.json({ error: '지원하지 않는 문자가 포함되어 있습니다.' }, { status: 400 });
      }
      await sql`
        UPDATE org_units SET department = ${to}, updated_at = now()
        WHERE corporation_name = ${corp} AND department = ${from}`;
      return NextResponse.json({ ok: true });
    }

    // 2) 단일 행 수정
    const id = String(body.id ?? '').trim();
    if (!id) return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });

    if (typeof body.position === 'string') {
      const e1 = validateText(body.position, '직무');
      if (e1) return NextResponse.json({ error: e1 }, { status: 400 });
      try { assertCleanFields({ position: body.position }, ['position']); }
      catch { return NextResponse.json({ error: '지원하지 않는 문자가 포함되어 있습니다.' }, { status: 400 }); }
      await sql`UPDATE org_units SET position = ${body.position.trim()}, updated_at = now() WHERE id = ${id}`;
    }
    if (typeof body.department === 'string') {
      const e2 = validateText(body.department, '부서');
      if (e2) return NextResponse.json({ error: e2 }, { status: 400 });
      try { assertCleanFields({ department: body.department }, ['department']); }
      catch { return NextResponse.json({ error: '지원하지 않는 문자가 포함되어 있습니다.' }, { status: 400 }); }
      await sql`UPDATE org_units SET department = ${body.department.trim()}, updated_at = now() WHERE id = ${id}`;
    }
    if (typeof body.is_active === 'boolean') {
      await sql`UPDATE org_units SET is_active = ${body.is_active}, updated_at = now() WHERE id = ${id}`;
    }
    if (typeof body.sort_order === 'number' && Number.isFinite(body.sort_order)) {
      await sql`UPDATE org_units SET sort_order = ${Math.trunc(body.sort_order)}, updated_at = now() WHERE id = ${id}`;
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (isDuplicateErr(e)) return NextResponse.json({ error: '이미 존재하는 부서/직무입니다.' }, { status: 409 });
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireMaster(req);
  if (isDenied(auth)) return auth;
  const rl = await checkRateLimit('admin-org-units', getClientIp(req), 60, '1 m');
  if (!rl.success) return tooManyRequests();

  const id = (req.nextUrl.searchParams.get('id') || '').trim();
  const department = (req.nextUrl.searchParams.get('department') || '').trim();
  const corp = (req.nextUrl.searchParams.get('corp') || ORG_DIRECTORY_CORP).trim();

  try {
    if (id) {
      await sql`DELETE FROM org_units WHERE id = ${id}`;
      return NextResponse.json({ ok: true });
    }
    if (department) {
      await sql`DELETE FROM org_units WHERE corporation_name = ${corp} AND department = ${department}`;
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'id 또는 department가 필요합니다.' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
