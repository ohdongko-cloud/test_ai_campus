import { NextResponse } from 'next/server';
import { sql } from '../../../lib/db';

// GET /api/videos → 영상 목록 (order_idx 오름차순)
// duration 컬럼은 마이그레이션 전 환경에서도 동작하도록 폴백 처리.
export async function GET() {
  try {
    // duration 컬럼이 존재하면 포함, 없으면(마이그레이션 전) null 로 폴백
    let rows: Awaited<ReturnType<typeof sql>>;
    try {
      rows = await sql`
        SELECT id, title, level, description, youtube_url, view_count, stages, order_idx, is_required, duration
        FROM videos
        ORDER BY order_idx ASC, created_at ASC`;
    } catch {
      // duration 컬럼 없음 — 마이그레이션 미실행 환경
      rows = await sql`
        SELECT id, title, level, description, youtube_url, view_count, stages, order_idx, is_required
        FROM videos
        ORDER BY order_idx ASC, created_at ASC`;
    }
    const out = rows.map(r => ({
      id: r.id,
      title: r.title,
      level: r.level,
      description: r.description,
      youtubeUrl: r.youtube_url,
      viewCount: r.view_count,
      stages: r.stages || [],
      order: r.order_idx,
      isRequired: !!r.is_required,
      duration: r.duration || null,
    }));
    const res = NextResponse.json(out);
    res.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return res;
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
