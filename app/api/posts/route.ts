import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '../../../lib/supabase';

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// GET /api/posts?sort=latest|popular&page=1
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sort  = searchParams.get('sort') || 'latest';
  const page  = Math.max(1, Number(searchParams.get('page') || '1'));
  const limit = 20;

  const db = createServiceClient();
  let query = db
    .from('posts')
    .select('id,title,link,views_count,likes_count,comments_count,created_at')
    .eq('is_deleted', false)
    .range((page - 1) * limit, page * limit - 1);

  if (sort === 'popular') {
    query = query.order('likes_count', { ascending: false }).order('views_count', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/posts
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { title, content, password, link } = body;

  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json({ error: '제목과 내용은 필수입니다.' }, { status: 400 });
  }

  const db = createServiceClient();
  const password_hash = password ? await sha256(password) : null;

  const { data, error } = await db
    .from('posts')
    .insert({ title: title.trim(), content: content.trim(), password_hash, link: link || null })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
