import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '../../../../lib/supabase';

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// GET /api/posts/[id]  — 상세 조회 + 조회수 증가(쿠키로 24h 중복 방지)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = createServiceClient();

  const { data: post, error } = await db
    .from('posts')
    .select('*')
    .eq('id', id)
    .eq('is_deleted', false)
    .single();

  if (error || !post) return NextResponse.json({ error: '게시글을 찾을 수 없습니다.' }, { status: 404 });

  const cookieKey = `viewed_${id}`;
  const alreadyViewed = req.cookies.get(cookieKey);

  const res = NextResponse.json(post);

  if (!alreadyViewed) {
    await db.from('posts').update({ views_count: post.views_count + 1 }).eq('id', id);
    res.cookies.set(cookieKey, '1', { maxAge: 60 * 60 * 24, httpOnly: true, path: '/' });
  }

  return res;
}

// PATCH /api/posts/[id]  — 수정 (비밀번호 검증)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { title, content, link, password } = await req.json();

  if (!password) return NextResponse.json({ error: '비밀번호를 입력해주세요.' }, { status: 400 });
  if (!title?.trim() || !content?.trim()) return NextResponse.json({ error: '제목과 내용은 필수입니다.' }, { status: 400 });

  const db = createServiceClient();
  const { data: post } = await db.from('posts').select('password_hash').eq('id', id).single();

  if (!post) return NextResponse.json({ error: '게시글을 찾을 수 없습니다.' }, { status: 404 });
  if (!post.password_hash) return NextResponse.json({ error: '비밀번호가 설정되지 않은 게시글입니다.' }, { status: 403 });

  const hash = await sha256(password);
  if (hash !== post.password_hash) return NextResponse.json({ error: '비밀번호가 올바르지 않습니다.' }, { status: 403 });

  const { error } = await db.from('posts').update({ title: title.trim(), content: content.trim(), link: link || null }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/posts/[id]  — 소프트 삭제 (비밀번호 검증)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { password } = await req.json();

  if (!password) return NextResponse.json({ error: '비밀번호를 입력해주세요.' }, { status: 400 });

  const db = createServiceClient();
  const { data: post } = await db.from('posts').select('password_hash').eq('id', id).single();

  if (!post) return NextResponse.json({ error: '게시글을 찾을 수 없습니다.' }, { status: 404 });
  if (!post.password_hash) return NextResponse.json({ error: '비밀번호가 설정되지 않은 게시글입니다.' }, { status: 403 });

  const hash = await sha256(password);
  if (hash !== post.password_hash) return NextResponse.json({ error: '비밀번호가 올바르지 않습니다.' }, { status: 403 });

  const { error } = await db.from('posts').update({ is_deleted: true }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
