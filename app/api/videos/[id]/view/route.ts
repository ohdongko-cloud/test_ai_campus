import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../../lib/db';

// POST /api/videos/[id]/view → view_count++
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 });
  try {
    const rows = await sql`
      UPDATE videos SET view_count = view_count + 1
      WHERE id = ${id}
      RETURNING view_count`;
    return NextResponse.json({ view_count: rows[0]?.view_count ?? 0 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
