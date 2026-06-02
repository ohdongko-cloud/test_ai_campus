import { NextResponse } from 'next/server';
import { sql } from '../../../lib/db';

// GET /api/videos → 영상 목록 (order_idx 오름차순)
// duration 컬럼은 마이그레이션 전 환경에서도 동작하도록 폴백 처리.
export async function GET() {
  try {
    // duration / attachment_count 모두 누락 환경(마이그레이션 전)도 호환되도록 단계적 폴백.
    let rows: Awaited<ReturnType<typeof sql>>;
    try {
      rows = await sql`
        SELECT v.id, v.title, v.level, v.description, v.youtube_url, v.view_count, v.stages,
               v.order_idx, v.is_required, v.duration,
               COALESCE(att.cnt, 0)::int AS attachment_count
        FROM videos v
        LEFT JOIN (
          SELECT video_id, COUNT(*)::int AS cnt FROM video_attachments GROUP BY video_id
        ) att ON att.video_id = v.id
        ORDER BY v.order_idx ASC, v.created_at ASC`;
    } catch {
      try {
        // video_attachments 테이블 없음 — duration 만 포함
        rows = await sql`
          SELECT id, title, level, description, youtube_url, view_count, stages, order_idx, is_required, duration
          FROM videos
          ORDER BY order_idx ASC, created_at ASC`;
      } catch {
        // duration 도 없음 — 가장 기본 형태
        rows = await sql`
          SELECT id, title, level, description, youtube_url, view_count, stages, order_idx, is_required
          FROM videos
          ORDER BY order_idx ASC, created_at ASC`;
      }
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
      attachmentCount: typeof r.attachment_count === 'number' ? r.attachment_count : 0,
    }));
    const res = NextResponse.json(out);
    res.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return res;
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
