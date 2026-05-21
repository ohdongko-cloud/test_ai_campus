import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyComment(id: string, password: string) {
  const rows = await sql`SELECT password_hash, post_id FROM comments WHERE id = ${id}`;
  if (rows.length === 0) return { error: '댓글을 찾을 수 없습니다.', status: 404 as const };
  const c = rows[0];
  if (!c.password_hash) return { error: '비밀번호가 설정되지 않은 댓글입니다.', status: 403 as const };
  if (await sha256(password) !== c.password_hash) return { error: '비밀번호가 올바르지 않습니다.', status: 403 as const };
  return { postId: c.post_id as string };
}

// PATCH /api/comments/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { content, password } = await req.json();
  if (!password) return NextResponse.json({ error: '비밀번호를 입력해주세요.' }, { status: 400 });
  if (!content?.trim()) return NextResponse.json({ error: '내용은 필수입니다.' }, { status: 400 });

  try {
    const result = await verifyComment(id, password);
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
    await sql`UPDATE comments SET content = ${content.trim()} WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE /api/comments/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { password } = await req.json();
  if (!password) return NextResponse.json({ error: '비밀번호를 입력해주세요.' }, { status: 400 });

  try {
    const result = await verifyComment(id, password);
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
    await sql`UPDATE comments SET is_deleted = true WHERE id = ${id}`;
    await sql`UPDATE posts SET comments_count = GREATEST(0, comments_count - 1) WHERE id = ${result.postId}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
