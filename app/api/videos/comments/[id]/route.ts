import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../../lib/db';

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// DELETE /api/videos/comments/[id]  body: { password }
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { password } = await req.json().catch(() => ({}));
  if (!password) return NextResponse.json({ error: '비밀번호가 필요합니다.' }, { status: 400 });

  try {
    const rows = await sql`SELECT video_id, password_hash, is_deleted FROM video_comments WHERE id = ${id}`;
    const row = rows[0];
    if (!row) return NextResponse.json({ error: '댓글을 찾을 수 없습니다.' }, { status: 404 });
    if (row.is_deleted) return NextResponse.json({ ok: true }); // 이미 삭제됨
    if (!row.password_hash) return NextResponse.json({ error: '비밀번호 없이 작성된 댓글은 삭제할 수 없습니다.' }, { status: 403 });

    const inputHash = await sha256(String(password));
    if (inputHash !== row.password_hash) {
      return NextResponse.json({ error: '비밀번호가 일치하지 않습니다.' }, { status: 401 });
    }

    await sql`UPDATE video_comments SET is_deleted = true WHERE id = ${id}`;
    await sql`
      UPDATE video_stats
      SET comments_count = GREATEST(0, comments_count - 1)
      WHERE video_id = ${row.video_id}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
