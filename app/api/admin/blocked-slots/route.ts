import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';
import { requireAdmin } from '../../../../lib/admin-auth';

// POST /api/admin/blocked-slots  body: BlockedSlot
export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  if (!body.startTime) return NextResponse.json({ error: 'startTime 필수' }, { status: 400 });
  const recurring = !!body.recurring;
  if (recurring && !body.dayOfWeek) return NextResponse.json({ error: 'recurring=true 시 dayOfWeek 필요' }, { status: 400 });
  if (!recurring && !body.date) return NextResponse.json({ error: 'recurring=false 시 date 필요' }, { status: 400 });

  try {
    const rows = await sql`
      INSERT INTO blocked_slots (date, day_of_week, start_time, end_time, reason, recurring)
      VALUES (${body.date || null}, ${body.dayOfWeek ?? null}, ${body.startTime},
              ${body.endTime || null}, ${body.reason || null}, ${recurring})
      RETURNING id`;
    return NextResponse.json({ ok: true, id: rows[0].id }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
