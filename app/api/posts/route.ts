import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../lib/db';
import { containsReplacementChar } from '../../../lib/text-validation';

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// GET /api/posts?sort=latest|popular&page=1
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sort   = searchParams.get('sort') || 'latest';
  const page   = Math.max(1, Number(searchParams.get('page') || '1'));
  const limit  = 20;
  const offset = (page - 1) * limit;

  try {
    const rows = sort === 'popular'
      ? await sql`
          SELECT id, title, link, views_count, likes_count, comments_count, created_at
          FROM posts WHERE is_deleted = false
          ORDER BY likes_count DESC, views_count DESC
          LIMIT ${limit} OFFSET ${offset}`
      : await sql`
          SELECT id, title, link, views_count, likes_count, comments_count, created_at
          FROM posts WHERE is_deleted = false
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}`;
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/posts
export async function POST(req: NextRequest) {
  const { title, content, password, link } = await req.json();
  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json({ error: '제목과 내용은 필수입니다.' }, { status: 400 });
  }
  if (containsReplacementChar(title) || containsReplacementChar(content)) {
    return NextResponse.json({ error: '지원하지 않는 문자가 포함되어 있습니다.' }, { status: 400 });
  }

  const password_hash = password ? await sha256(password) : null;
  try {
    const rows = await sql`
      INSERT INTO posts (title, content, password_hash, link)
      VALUES (${title.trim()}, ${content.trim()}, ${password_hash}, ${link || null})
      RETURNING id`;
    return NextResponse.json(rows[0], { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
