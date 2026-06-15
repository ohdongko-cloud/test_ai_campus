import { NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';
import { getCurrentUser } from '../../../../lib/session';

// GET /api/ai-level-test/status
// 현재 사용자가 AI 레벨테스트를 완료했는지 + 최신 결과 요약. (강제 진입 판단용)
// DB 미가용/미완료 시 completed:false → 테스트 노출(과노출이 미노출보다 안전).
export async function GET() {
  const session = await getCurrentUser();
  if (!session?.uid) return NextResponse.json({ completed: false }, { headers: { 'Cache-Control': 'no-store' } });

  try {
    const rows = await sql`
      SELECT level, auto_score, c1_score, c2_score, c3_score, coding_status, created_at
      FROM ai_level_attempts WHERE user_id = ${session.uid}
      ORDER BY created_at DESC LIMIT 1`;
    if (rows.length === 0) return NextResponse.json({ completed: false }, { headers: { 'Cache-Control': 'no-store' } });
    const r = rows[0];
    return NextResponse.json({
      completed: true,
      latest: {
        level: r.level, autoScore: Number(r.auto_score),
        c1: Number(r.c1_score), c2: Number(r.c2_score), c3: Number(r.c3_score),
        codingStatus: r.coding_status, at: r.created_at,
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ completed: false }, { headers: { 'Cache-Control': 'no-store' } });
  }
}
