import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '../../../lib/supabase';

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// GET /api/comments?postId=xxx
export async function GET(req: NextRequest) {
  const postId = new URL(req.url).searchParams.get('postId');
  if (!postId) return NextResponse.json({ error: 'postId 필요' }, { status: 400 });

  const db = createServiceClient();
  const { data, error } = await db
    .from('comments')
    .select('id,post_id,content,likes_count,is_deleted,created_at,updated_at')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/comments
export async function POST(req: NextRequest) {
  const { postId, content, password } = await req.json();
  if (!postId || !content?.trim()) return NextResponse.json({ error: '내용은 필수입니다.' }, { status: 400 });

  const db = createServiceClient();
  const password_hash = password ? await sha256(password) : null;

  const { error: insertError } = await db
    .from('comments')
    .insert({ post_id: postId, content: content.trim(), password_hash });

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  // comments_count 증가
  const { data: post } = await db.from('posts').select('comments_count').eq('id', postId).single();
  if (post) await db.from('posts').update({ comments_count: post.comments_count + 1 }).eq('id', postId);

  return NextResponse.json({ ok: true }, { status: 201 });
}
