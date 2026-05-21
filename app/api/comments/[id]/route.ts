import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '../../../../lib/supabase';

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(db: ReturnType<typeof import('../../../../lib/supabase').createServiceClient>, id: string, password: string) {
  const { data } = await db.from('comments').select('password_hash,post_id').eq('id', id).single();
  if (!data) return { error: '댓글을 찾을 수 없습니다.', status: 404 };
  if (!data.password_hash) return { error: '비밀번호가 설정되지 않은 댓글입니다.', status: 403 };
  const hash = await sha256(password);
  if (hash !== data.password_hash) return { error: '비밀번호가 올바르지 않습니다.', status: 403 };
  return { postId: data.post_id };
}

// PATCH /api/comments/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { content, password } = await req.json();
  if (!password) return NextResponse.json({ error: '비밀번호를 입력해주세요.' }, { status: 400 });
  if (!content?.trim()) return NextResponse.json({ error: '내용은 필수입니다.' }, { status: 400 });

  const db = createServiceClient();
  const result = await verifyPassword(db, id, password);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });

  const { error } = await db.from('comments').update({ content: content.trim() }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/comments/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { password } = await req.json();
  if (!password) return NextResponse.json({ error: '비밀번호를 입력해주세요.' }, { status: 400 });

  const db = createServiceClient();
  const result = await verifyPassword(db, id, password);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });

  await db.from('comments').update({ is_deleted: true }).eq('id', id);

  // comments_count 감소
  const { data: post } = await db.from('posts').select('comments_count').eq('id', result.postId).single();
  if (post) await db.from('posts').update({ comments_count: Math.max(0, post.comments_count - 1) }).eq('id', result.postId);

  return NextResponse.json({ ok: true });
}
