import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';
import { requireAdmin, isDenied } from '../../../../lib/admin-auth';

// GET /api/admin/ai-level-matrix?corp=&dept=&position=
// 법인/부서/직무별 사용자 최신 결과 매트릭스(전월·성장률·영역별·정성 포함). 'members' 권한.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'members');
  if (isDenied(auth)) return auth;

  const url = new URL(req.url);
  const corp = (url.searchParams.get('corp') || '').trim();
  const dept = (url.searchParams.get('dept') || '').trim();
  const position = (url.searchParams.get('position') || '').trim();

  try {
    const rows = await sql`
      WITH ranked AS (
        SELECT user_id, level, auto_score, c1_score, c2_score, c3_score, area_ratio,
               coding_status, coding_score, created_at,
               ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) rn
        FROM ai_level_attempts
      )
      SELECT u.id, u.name, u.email, u.created_at AS joined_at,
             u.corporation_name, u.organization_name, u.position,
             l.level, l.auto_score, l.c1_score, l.c2_score, l.c3_score, l.area_ratio,
             l.coding_status, l.coding_score, l.created_at,
             p.auto_score AS prev_score,
             m.goal, m.emoney, m.note
      FROM users u
      JOIN ranked l ON l.user_id = u.id AND l.rn = 1
      LEFT JOIN ranked p ON p.user_id = u.id AND p.rn = 2
      LEFT JOIN ai_level_manual m ON m.user_id = u.id
      WHERE (${corp} = '' OR u.corporation_name = ${corp})
        AND (${dept} = '' OR u.organization_name = ${dept})
        AND (${position} = '' OR u.position = ${position})
      ORDER BY u.corporation_name, u.organization_name, u.position, l.auto_score DESC
      LIMIT 2000`;
    return NextResponse.json({ items: rows }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST /api/admin/ai-level-matrix — 정성 입력 upsert. body: { userId, goal?, emoney?, note? }
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req, 'members');
  if (isDenied(auth)) return auth;
  const body = await req.json().catch(() => ({}));
  const userId = String(body?.userId || '');
  if (!userId) return NextResponse.json({ error: '대상이 없습니다.' }, { status: 400 });
  const goal = (body?.goal == null ? null : String(body.goal).slice(0, 200));
  const emoney = (body?.emoney == null ? null : String(body.emoney).slice(0, 200));
  const note = (body?.note == null ? null : String(body.note).slice(0, 1000));
  const by = auth.email || 'admin';

  try {
    await sql`
      INSERT INTO ai_level_manual (user_id, goal, emoney, note, updated_by, updated_at)
      VALUES (${userId}, ${goal}, ${emoney}, ${note}, ${by}, now())
      ON CONFLICT (user_id) DO UPDATE
        SET goal = EXCLUDED.goal, emoney = EXCLUDED.emoney, note = EXCLUDED.note,
            updated_by = EXCLUDED.updated_by, updated_at = now()`;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
