import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';
import { requireAdmin, isDenied } from '../../../../lib/admin-auth';

// GET /api/admin/level-tests — 레벨 테스트 검증내역 (권한: members)
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
    })));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
