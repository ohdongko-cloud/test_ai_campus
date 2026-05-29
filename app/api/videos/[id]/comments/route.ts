import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../../lib/db';
import { containsReplacementChar } from '../../../../../lib/text-validation';
import { checkRateLimit, getClientIp, tooManyRequests } from '../../../../../lib/ratelimit';

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// (구) in-memory 쿨다운 제거 — Upstash 기반 checkRateLimit 으로 대체.

// GET /api/videos/[id]/comments
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'video id 필요' }, { status: 400 });

  try {
    const rows = await sql`
      SELECT id, video_id, content, is_deleted, created_at, updated_at
      FROM video_comments
      WHERE video_id = ${id}
      ORDER BY created_at DESC`;
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/videos/[id]/comments  body: { content, password?, sessionId? }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'video id 필요' }, { status: 400 });

  const { content, password, sessionId } = await req.json();
  const text = typeof content === 'string' ? content.trim() : '';
  if (!text) return NextResponse.json({ error: '내용은 필수입니다.' }, { status: 400 });
  if (text.length > 1000) return NextResponse.json({ error: '댓글은 1000자 이하로 작성해주세요.' }, { status: 400 });
  if (containsReplacementChar(text)) {
    return NextResponse.json({ error: '지원하지 않는 문자가 포함되어 있습니다. UTF-8 한글로 다시 작성해주세요.' }, { status: 400 });
  }

  const ip = getClientIp(req);
  const rl = await checkRateLimit('video-comment', `${sessionId || 'anon'}:${ip}`, 1, '10 s');
  if (!rl.success) return tooManyRequests('잠시 후 다시 시도해주세요.');

  const password_hash = password ? await sha256(String(password)) : null;
  try {
    await sql`
      INSERT INTO video_comments (video_id, content, password_hash)
      VALUES (${id}, ${text}, ${password_hash})`;
    await sql`
      INSERT INTO video_stats (video_id, comments_count) VALUES (${id}, 1)
      ON CONFLICT (video_id) DO UPDATE
      SET comments_count = video_stats.comments_count + 1`;
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
