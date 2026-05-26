import { NextResponse } from 'next/server';
import { sql } from '../../../lib/db';

// GET /api/video-levels
export async function GET() {
  try {
    const rows = await sql`
      SELECT id, name, description, order_idx
      FROM video_levels
      ORDER BY order_idx ASC, name ASC`;
    return NextResponse.json(rows.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
    })));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
