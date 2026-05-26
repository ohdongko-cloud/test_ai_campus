import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';
import { requireAdmin } from '../../../../lib/admin-auth';

// GET /api/admin/reservations (전체 필드)
export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    const rows = await sql`
      SELECT id, name, role, task_summary, inquiry, email, phone,
             date::text AS date, start_time, end_time, status, registered_at
      FROM reservations
      ORDER BY date DESC, start_time ASC`;
    return NextResponse.json(rows.map(r => ({
      id: r.id,
      name: r.name,
      role: r.role,
      taskSummary: r.task_summary,
      inquiry: r.inquiry,
      email: r.email,
      phone: r.phone,
      date: r.date,
      startTime: r.start_time,
      endTime: r.end_time,
      status: r.status,
      registeredAt: r.registered_at,
    })));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
