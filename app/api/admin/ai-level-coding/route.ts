import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';
import { requireAdmin, isDenied } from '../../../../lib/admin-auth';
import { recomputeWithCoding } from '../../../../lib/level-test-engine';

// GET /api/admin/ai-level-coding — 코딩 제출물 목록(미채점 우선). 'members' 권한.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'members');
  if (isDenied(auth)) return auth;
  try {
    const rows = await sql`
      SELECT c.id, c.user_id, c.email, c.submit_kind, c.link_url, c.blob_url, c.filename,
             c.service_desc, c.needs_account, c.test_account, c.status, c.score, c.reviewer_note,
             c.reviewed_at, c.created_at,
             u.name, u.organization_name, u.position
      FROM ai_level_coding c
      LEFT JOIN users u ON u.id = c.user_id
      ORDER BY (c.status = 'submitted') DESC, c.created_at DESC
      LIMIT 500`;
    return NextResponse.json({ items: rows }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST /api/admin/ai-level-coding — 코딩 점수 입력 + 해당 사용자 최신 결과 총점 재산출.
// body: { id, score(0~100), note? }
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req, 'members');
  if (isDenied(auth)) return auth;

  const body = await req.json().catch(() => ({}));
  const id = String(body?.id || '');
  const score = Number(body?.score);
  const note = String(body?.note || '').slice(0, 1000) || null;
  if (!id || !Number.isFinite(score) || score < 0 || score > 100) {
    return NextResponse.json({ error: '점수는 0~100 사이여야 합니다.' }, { status: 400 });
  }

  try {
    const crows = await sql`SELECT user_id FROM ai_level_coding WHERE id = ${id} LIMIT 1`;
    if (crows.length === 0) return NextResponse.json({ error: '제출물을 찾을 수 없습니다.' }, { status: 404 });
    const userId = crows[0].user_id;

    await sql`
      UPDATE ai_level_coding
      SET score = ${score}, status = 'scored', reviewer_note = ${note}, reviewed_at = now()
      WHERE id = ${id}`;

    // 해당 사용자 최신 응시 결과에 코딩 반영 → 총점·레벨 재산출
    let recomputed: { autoScore: number; level: number } | null = null;
    if (userId) {
      const arows = await sql`
        SELECT id, c1_score, c2_score, c3_score FROM ai_level_attempts
        WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 1`;
      if (arows.length > 0) {
        const a = arows[0];
        recomputed = recomputeWithCoding(Number(a.c1_score) || 0, Number(a.c2_score) || 0, Number(a.c3_score) || 0, score);
        await sql`
          UPDATE ai_level_attempts
          SET coding_status = 'scored', coding_score = ${score}, auto_score = ${recomputed.autoScore}, level = ${recomputed.level}
          WHERE id = ${a.id}`;
      }
    }
    return NextResponse.json({ ok: true, recomputed });
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
