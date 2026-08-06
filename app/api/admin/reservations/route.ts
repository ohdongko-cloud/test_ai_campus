import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';
import { checkAdmin } from '../../../../lib/admin-auth';
import { reportError } from '../../../../lib/error-report';

// PII(이름·이메일·전화번호·문의내용) 응답 라우트 — 모든 경로에 no-store (§6-7).
function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

// GET /api/admin/reservations (전체 필드)
export async function GET(req: NextRequest) {
  const denied = await checkAdmin(req, 'meetings');
  if (denied) return denied;
  try {
    const rows = await sql`
      SELECT id, name, role, task_summary, inquiry, email, phone,
             date::text AS date, start_time, end_time, status, registered_at
      FROM reservations
      ORDER BY date DESC, start_time ASC`;
    return noStoreJson(rows.map(r => ({
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
    reportError(e, { route: 'admin/reservations.get' });
    return noStoreJson({ error: '서버 오류가 발생했습니다.' }, 500);
  }
}
