import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';
import { requireAdmin, isDenied, getMasterEmails, getActorLabel } from '../../../../lib/admin-auth';
import { logAdminAction } from '../../../../lib/audit';

// GET /api/admin/members
// 회원 목록 + 필터/정렬/페이지네이션.
// 권한: 'members' (master/legacy 자동 통과).
//
// Query:
//   search   string  (이메일/닉네임 부분일치)
//   corp     string  (corporation_name 정확일치)
//   org      string  (organization_name 정확일치)
//   role     string  ('admin' | 'user' | 'master')
//   sort     string  ('created_at' | 'email' | 'name')   default 'created_at'
//   order    'asc' | 'desc'                              default 'desc'
//   limit    number  (1~200)                              default 50
//   offset   number  (0~)                                 default 0

const ALLOWED_SORT = new Set(['created_at', 'email', 'name']);

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'members');
  if (isDenied(auth)) return auth;

  const { searchParams } = new URL(req.url);
  const search = (searchParams.get('search') || '').trim();
  const corp   = (searchParams.get('corp')   || '').trim();
  const org    = (searchParams.get('org')    || '').trim();
  const role   = (searchParams.get('role')   || '').trim();
  const sort   = searchParams.get('sort')   || 'created_at';
  const orderQ = searchParams.get('order')  || 'desc';
  const limit  = Math.min(200, Math.max(1, Number(searchParams.get('limit') || 50)));
  const offset = Math.max(0, Number(searchParams.get('offset') || 0));

  // 화이트리스트 검증 (SQL injection 방지)
  if (!ALLOWED_SORT.has(sort)) {
    return NextResponse.json({ error: '허용되지 않은 정렬 컬럼입니다.' }, { status: 400 });
  }
  const order: 'ASC' | 'DESC' = orderQ.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  // role 매핑
  //   'master' → email IN (env masters) — env 기준
  //   'admin'  → users.role = 'admin'
  //   'user'   → users.role = 'user' AND NOT master
  //   ''       → 전체
  const masters = getMasterEmails();
  const masterArr = Array.from(masters);

  try {
    // ── WHERE 구성 (parameterized) ──
    // 동적 SQL 안전성을 위해 sql.query() + $N 사용.
    const where: string[] = [];
    const params: unknown[] = [];
    function add(condition: string, ...vals: unknown[]) {
      vals.forEach(v => params.push(v));
      // $N placeholder 치환
      let p = condition;
      const startIdx = params.length - vals.length;
      vals.forEach((_, i) => { p = p.replace('?', `$${startIdx + i + 1}`); });
      where.push(p);
    }

    if (search) {
      add('(LOWER(email) LIKE LOWER(?) OR LOWER(name) LIKE LOWER(?))', `%${search}%`, `%${search}%`);
    }
    if (corp) add('corporation_name = ?', corp);
    if (org)  add('organization_name = ?', org);

    if (role === 'admin') {
      add('role = ?', 'admin');
    } else if (role === 'user') {
      // master 제외한 일반 회원
      if (masterArr.length > 0) {
        const placeholders = masterArr.map((_, i) => `$${params.length + i + 1}`).join(',');
        params.push(...masterArr);
        where.push(`(role = 'user' AND LOWER(email) NOT IN (${placeholders}))`);
      } else {
        where.push(`role = 'user'`);
      }
    } else if (role === 'master') {
      if (masterArr.length > 0) {
        const placeholders = masterArr.map((_, i) => `$${params.length + i + 1}`).join(',');
        params.push(...masterArr);
        where.push(`LOWER(email) IN (${placeholders})`);
      } else {
        // master 가 env에 없음 → 결과 0
        where.push('1=0');
      }
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    // total
    const totalQ = `SELECT COUNT(*)::int AS n FROM users ${whereSql}`;
    const totalR = await sql.query(totalQ, params);
    const total = totalR[0]?.n ?? 0;

    // rows
    const rowsQ = `
      SELECT id, email, name, corporation_name, organization_name, position, role, created_at
      FROM users
      ${whereSql}
      ORDER BY ${sort} ${order} NULLS LAST, id ASC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const rows = await sql.query(rowsQ, params);

    // facets (드롭다운용 distinct) — 필터 적용 전 전체 기준이 자연스러움
    const [corps, orgs] = await Promise.all([
      sql`SELECT DISTINCT corporation_name AS v FROM users WHERE corporation_name IS NOT NULL AND corporation_name <> '' ORDER BY v`,
      sql`SELECT DISTINCT organization_name AS v FROM users WHERE organization_name IS NOT NULL AND organization_name <> '' ORDER BY v`,
    ]);

    // 감사 로그 (선택)
    try {
      await logAdminAction({
        action: 'members.list',
        detail: { actor: getActorLabel(auth), search, corp, org, role, sort, order, limit, offset, total },
        req,
      });
    } catch { /* 로그 실패는 무시 */ }

    return NextResponse.json({
      total,
      rows: rows.map((r: Record<string, unknown>) => ({
        id: r.id,
        email: r.email,
        nickname: r.name,
        corporationName: r.corporation_name,
        organizationName: r.organization_name,
        position: r.position,
        role: r.role,
        isMaster: masters.has(String(r.email || '').toLowerCase()),
        createdAt: r.created_at,
      })),
      facets: {
        corporations: corps.map((r: Record<string, unknown>) => r.v as string),
        organizations: orgs.map((r: Record<string, unknown>) => r.v as string),
      },
    });
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
