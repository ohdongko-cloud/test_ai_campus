import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../../lib/db';
import { requireAdmin } from '../../../../../lib/admin-auth';

// PATCH /api/admin/videos/[id]  body: { title?, level?, description?, youtubeUrl?, stages?, order? }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json();

  // 부분 업데이트: 있는 필드만 갱신
  const sets: string[] = [];
  const values: unknown[] = [];
  function add(field: string, val: unknown) {
    sets.push(`${field} = $${values.length + 1}`);
    values.push(val);
  }
  if (typeof body.title === 'string')       add('title', body.title);
  if (typeof body.level === 'string')       add('level', body.level);
  if (typeof body.description === 'string') add('description', body.description);
  if (typeof body.youtubeUrl === 'string')  add('youtube_url', body.youtubeUrl);
  if (Array.isArray(body.stages))           add('stages', JSON.stringify(body.stages));
  if (Number.isFinite(body.order))          add('order_idx', Number(body.order));

  if (sets.length === 0) return NextResponse.json({ ok: true });

  try {
    // sql.query는 $1, $2... 형식의 prepared statement 지원
    const query = `UPDATE videos SET ${sets.join(', ')} WHERE id = $${values.length + 1} RETURNING id`;
    const result = await sql.query(query, [...values, id]);
    if (result.length === 0) return NextResponse.json({ error: '영상을 찾을 수 없습니다.' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE /api/admin/videos/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const { id } = await params;
  try {
    await sql`DELETE FROM videos WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
