import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';
import { checkAdmin } from '../../../../lib/admin-auth';
import { assertCleanFields, BadTextError } from '../../../../lib/text-validation';

// POST /api/admin/videos
// body: { id?, title, level, description?, youtubeUrl, stages?, order_idx? }
export async function POST(req: NextRequest) {
  const denied = await checkAdmin(req, 'videos');
  if (denied) return denied;

  const body = await req.json();
  const id = String(body.id || crypto.randomUUID());
  const title = String(body.title || '').trim();
  const level = String(body.level || '').trim();
  const description = String(body.description || '');
  const youtubeUrl = String(body.youtubeUrl || '').trim();
  const stages = Array.isArray(body.stages) ? body.stages : [];
  // 필수 시청 플래그: boolean만 허용, 누락 시 false
  const isRequired = typeof body.isRequired === 'boolean' ? body.isRequired : false;

  if (!title || !youtubeUrl || !level) {
    return NextResponse.json({ error: 'title/level/youtubeUrl 필수' }, { status: 400 });
  }

  try {
    assertCleanFields({ title, level, description, youtubeUrl }, ['title', 'level', 'description']);
  } catch (e) {
    if (e instanceof BadTextError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }

  // 신규 영상은 항상 목록 최상단으로 — 현재 MIN(order_idx) - 1 자동 부여.
  // 클라이언트가 명시적으로 order 를 보냈으면 그 값을 우선 사용 (임포트/마이그레이션 호환).
  let orderIdx: number;
  if (Number.isFinite(body.order)) {
    orderIdx = Number(body.order);
  } else {
    const minRow = await sql`SELECT COALESCE(MIN(order_idx), 0)::int AS m FROM videos`;
    orderIdx = (minRow[0]?.m ?? 0) - 1;
  }

  try {
    await sql`
      INSERT INTO videos (id, title, level, description, youtube_url, stages, order_idx, is_required)
      VALUES (${id}, ${title}, ${level}, ${description}, ${youtubeUrl},
              ${JSON.stringify(stages)}::jsonb, ${orderIdx}, ${isRequired})`;
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/admin/videos/reorder  body: { ids: string[] }
// 별도 라우트로 분리 (이 파일은 base /admin/videos만)
