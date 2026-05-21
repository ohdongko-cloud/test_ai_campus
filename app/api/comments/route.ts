import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../lib/db';

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// GET /api/comments?postId=xxx
export async function GET(req: NextRequest) {
  const postId = new URL(req.url).searchParams.get('postId');
  if (!postId) return NextResponse.json({ error: 'postId 필요' }, { status: 400 });

  try {
    const rows = await sql`
      SELECT id, post_id, content, likes_count, is_deleted, created_at, updated_at
      FROM comments WHERE post_id = ${postId}
      ORDER BY created_at ASC`;
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/comments
export async function POST(req: NextRequest) {
  const { postId, content, password } = await req.json();
  if (!postId || !content?.trim()) return NextResponse.json({ error: '내용은 필수입니다.' }, { status: 400 });

  const password_hash = password ? await sha256(password) : null;
  try {
    await sql`INSERT INTO comments (post_id, content, password_hash) VALUES (${postId}, ${content.trim()}, ${password_hash})`;
    await sql`UPDATE posts SET comments_count = comments_count + 1 WHERE id = ${postId}`;
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
