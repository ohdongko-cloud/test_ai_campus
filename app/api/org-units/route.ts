import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../lib/db';
import { checkRateLimit, getClientIp, tooManyRequests } from '../../../lib/ratelimit';
import { reportError } from '../../../lib/error-report';
import { ORG_DIRECTORY_CORP, type OrgUnitsResponse } from '../../../lib/org';

// GET /api/org-units?corp=이랜드리테일
// 가입 폼 부서/직무 드롭다운용 공개 조회. 비PII(조직 분류) · 레이트리밋 · no-store.
export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit('org-units', ip, 60, '1 m');
  if (!rl.success) return tooManyRequests();

  const corp = (req.nextUrl.searchParams.get('corp') || ORG_DIRECTORY_CORP).trim();

  try {
    const rows = await sql`
      SELECT department, position
      FROM org_units
      WHERE corporation_name = ${corp} AND is_active = true
      ORDER BY sort_order ASC, department ASC, position ASC`;

    // 부서별로 직무를 그룹핑 (행 순서 = 정렬 순서 유지)
    const map = new Map<string, string[]>();
    for (const r of rows as { department: string; position: string }[]) {
      const list = map.get(r.department);
      if (list) list.push(r.position);
      else map.set(r.department, [r.position]);
    }
    const departments = Array.from(map.entries()).map(([department, positions]) => ({
      department,
      positions,
    }));

    const payload: OrgUnitsResponse = { corporation: corp, departments };
    return NextResponse.json(payload, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    reportError(e, { route: 'org-units.get', detail: { corp } });
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
