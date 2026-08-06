import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';
import { requireAdmin, isDenied } from '../../../../lib/admin-auth';
import { reportError } from '../../../../lib/error-report';

// GET /api/admin/level-tests — 레벨 테스트 검증내역 (권한: members)
// PII(이메일) 응답 — no-store (§6-7).
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'members');
  if (isDenied(auth)) return auth;

  try {
    const rows = await sql`
      SELECT id, email, level, answers, security_flag, created_at
      FROM level_tests
      ORDER BY created_at DESC
      LIMIT 1000`;
    return NextResponse.json(rows.map(r => ({
      id: r.id,
      email: r.email,
      level: r.level,
      answers: r.answers,
      securityFlag: r.security_flag,
      createdAt: r.created_at,
    })), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    reportError(e, { route: 'admin/level-tests.get' });
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
