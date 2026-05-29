import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../../lib/db';
import { checkAdmin } from '../../../../../lib/admin-auth';

// PATCH /api/admin/video-levels/[id]  body: { name?, description? }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await checkAdmin(req, 'videos');
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json();
  const newName = typeof body.name === 'string' ? body.name.trim() : undefined;
  const newDesc = typeof body.description === 'string' ? body.description : undefined;

  try {
    const cur = await sql`SELECT name FROM video_levels WHERE id = ${id}`;
    if (cur.length === 0) return NextResponse.json({ error: '레벨을 찾을 수 없습니다.' }, { status: 404 });
    const oldName = cur[0].name;

    if (newName !== undefined && newDesc !== undefined) {
      await sql`UPDATE video_levels SET name = ${newName}, description = ${newDesc} WHERE id = ${id}`;
    } else if (newName !== undefined) {
      await sql`UPDATE video_levels SET name = ${newName} WHERE id = ${id}`;
    } else if (newDesc !== undefined) {
      await sql`UPDATE video_levels SET description = ${newDesc} WHERE id = ${id}`;
    }

    // 이름 변경 시 영상의 level 컬럼도 캐스케이드 갱신
    if (newName && newName !== oldName) {
      await sql`UPDATE videos SET level = ${newName} WHERE level = ${oldName}`;
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = String(e);
    if (msg.includes('unique')) return NextResponse.json({ error: '이미 존재하는 레벨명입니다.' }, { status: 409 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/admin/video-levels/[id]?fallback=<name>
// fallback 레벨로 해당 레벨 영상들을 이동시킨 뒤 삭제
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await checkAdmin(req, 'videos');
  if (denied) return denied;

  const { id } = await params;
  const fallback = new URL(req.url).searchParams.get('fallback') || '기초';

  try {
    const rows = await sql`SELECT name FROM video_levels WHERE id = ${id}`;
    if (rows.length === 0) return NextResponse.json({ ok: true });
    const oldName = rows[0].name;

    const remaining = await sql`SELECT COUNT(*)::int AS c FROM video_levels WHERE id != ${id}`;
    if (remaining[0].c === 0) {
      return NextResponse.json({ error: '레벨은 최소 1개 이상 있어야 합니다.' }, { status: 400 });
    }

    await sql`UPDATE videos SET level = ${fallback} WHERE level = ${oldName}`;
    await sql`DELETE FROM video_levels WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
