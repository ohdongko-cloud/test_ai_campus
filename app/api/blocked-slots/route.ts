import { NextResponse } from 'next/server';
import { sql } from '../../../lib/db';

// GET /api/blocked-slots (공개)
export async function GET() {
  try {
    const rows = await sql`
      SELECT id, date::text AS date, day_of_week, start_time, end_time, reason, recurring
      FROM blocked_slots`;
    const res = NextResponse.json(rows.map(r => ({
      id: r.id,
      date: r.date || undefined,
      dayOfWeek: r.day_of_week ?? undefined,
      startTime: r.start_time,
      endTime: r.end_time ?? undefined,
      reason: r.reason ?? undefined,
      recurring: r.recurring,
    })));
    res.headers.set('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300');
    return res;
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
