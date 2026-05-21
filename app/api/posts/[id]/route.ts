import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// GET /api/posts/[id] — 상세 조회 + 조회수 증가(쿠키로 24h 중복 방지)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const rows = await sql`SELECT * FROM posts WHERE id = ${id} AND is_deleted = false`;
    if (rows.length === 0) return NextResponse.json({ error: '게시글을 찾을 수 없습니다.' }, { status: 404 });

    const post = rows[0];
    const res = NextResponse.json(post);

    if (!req.cookies.get(`viewed_${id}`)) {
      await sql`UPDATE posts SET views_count = views_count + 1 WHERE id = ${id}`;
      res.cookies.set(`viewed_${id}`, '1', { maxAge: 60 * 60 * 24, httpOnly: true, path: '/' });
    }
    return res;
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// PATCH /api/posts/[id] — 수정 (비밀번호 검증)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { title, content, link, password } = await req.json();

  if (!password) return NextResponse.json({ error: '비밀번호를 입력해주세요.' }, { status: 400 });
  if (!title?.trim() || !content?.trim()) return NextResponse.json({ error: '제목과 내용은 필수입니다.' }, { status: 400 });

  try {
    const rows = await sql`SELECT password_hash FROM posts WHERE id = ${id}`;
    if (rows.length === 0) return NextResponse.json({ error: '게시글을 찾을 수 없습니다.' }, { status: 404 });

    const post = rows[0];
    if (!post.password_hash) return NextResponse.json({ error: '비밀번호가 설정되지 않은 게시글입니다.' }, { status: 403 });
    if (await sha256(password) !== post.password_hash) return NextResponse.json({ error: '비밀번호가 올바르지 않습니다.' }, { status: 403 });

    await sql`UPDATE posts SET title = ${title.trim()}, content = ${content.trim()}, link = ${link || null} WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE /api/posts/[id] — 소프트 삭제 (비밀번호 검증)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { password } = await req.json();

  if (!password) return NextResponse.json({ error: '비밀번호를 입력해주세요.' }, { status: 400 });

  try {
    const rows = await sql`SELECT password_hash FROM posts WHERE id = ${id}`;
    if (rows.length === 0) return NextResponse.json({ error: '게시글을 찾을 수 없습니다.' }, { status: 404 });

    const post = rows[0];
    if (!post.password_hash) return NextResponse.json({ error: '비밀번호가 설정되지 않은 게시글입니다.' }, { status: 403 });
    if (await sha256(password) !== post.password_hash) return NextResponse.json({ error: '비밀번호가 올바르지 않습니다.' }, { status: 403 });

    await sql`UPDATE posts SET is_deleted = true WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
