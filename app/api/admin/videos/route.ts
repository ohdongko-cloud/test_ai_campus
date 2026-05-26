import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';
import { requireAdmin } from '../../../../lib/admin-auth';
import { assertCleanFields, BadTextError } from '../../../../lib/text-validation';

// POST /api/admin/videos
// body: { id?, title, level, description?, youtubeUrl, stages?, order_idx? }
export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const id = String(body.id || crypto.randomUUID());
  const title = String(body.title || '').trim();
  const level = String(body.level || '').trim();
  const description = String(body.description || '');
  const youtubeUrl = String(body.youtubeUrl || '').trim();
  const stages = Array.isArray(body.stages) ? body.stages : [];
  const orderIdx = Number.isFinite(body.order) ? Number(body.order) : 0;

  if (!title || !youtubeUrl || !level) {
    return NextResponse.json({ error: 'title/level/youtubeUrl 필수' }, { status: 400 });
  }

  try {
    assertCleanFields({ title, level, description, youtubeUrl }, ['title', 'level', 'description']);
  } catch (e) {
    if (e instanceof BadTextError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }

  try {
    await sql`
      INSERT INTO videos (id, title, level, description, youtube_url, stages, order_idx)
      VALUES (${id}, ${title}, ${level}, ${description}, ${youtubeUrl},
              ${JSON.stringify(stages)}::jsonb, ${orderIdx})`;
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/admin/videos/reorder  body: { ids: string[] }
// 별도 라우트로 분리 (이 파일은 base /admin/videos만)
