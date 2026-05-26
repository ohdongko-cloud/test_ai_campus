import { NextResponse } from 'next/server';
import { sql } from '../../../lib/db';

// GET /api/guide → groups + items 트리
export async function GET() {
  try {
    const groups = await sql`
      SELECT id, name, description, order_idx
      FROM guide_groups
      ORDER BY order_idx ASC, name ASC`;
    const items = await sql`
      SELECT id, group_id, name, description, cost, url, recommended, order_idx
      FROM guide_items
      ORDER BY group_id, order_idx ASC`;

    const grouped: Record<string, typeof items> = {};
    for (const it of items) {
      (grouped[it.group_id] ||= []).push(it);
    }

    return NextResponse.json(groups.map(g => ({
      id: g.id,
      name: g.name,
      description: g.description,
      items: (grouped[g.id] || []).map(it => ({
        id: it.id,
        name: it.name,
        description: it.description,
        cost: it.cost,
        url: it.url,
        recommended: it.recommended,
      })),
    })));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
