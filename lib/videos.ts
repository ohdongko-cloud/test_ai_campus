import { sql } from './db';
import type { Video } from './types';

// 단일 영상 조회 (서버 전용) — GET /api/videos 목록과 동일 컬럼·폴백을 미러링한다.
// 마이그레이션 전 환경(duration / video_attachments 누락)도 단계적 폴백으로 호환.
// 미존재/오류 시 null 반환(호출부에서 notFound()/404 처리).
export async function getVideoById(id: string): Promise<Video | null> {
  if (!id) return null;
  try {
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
        WHERE v.id = ${id}
        LIMIT 1`;
    } catch {
      try {
        rows = await sql`
          SELECT id, title, level, description, youtube_url, view_count, stages, order_idx, is_required, duration
          FROM videos WHERE id = ${id} LIMIT 1`;
      } catch {
        rows = await sql`
          SELECT id, title, level, description, youtube_url, view_count, stages, order_idx, is_required
          FROM videos WHERE id = ${id} LIMIT 1`;
      }
    }
    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id,
      title: r.title,
      level: r.level,
      description: r.description,
      youtubeUrl: r.youtube_url,
      viewCount: r.view_count,
      stages: r.stages || [],
      order: r.order_idx,
      isRequired: !!r.is_required,
      duration: r.duration || undefined,
      attachmentCount: typeof r.attachment_count === 'number' ? r.attachment_count : 0,
    };
  } catch {
    return null;
  }
}
