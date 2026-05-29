import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../lib/db';
import { assertCleanFields, BadTextError } from '../../../lib/text-validation';
import { checkRateLimit, getClientIp, tooManyRequests } from '../../../lib/ratelimit';

// GET /api/reservations
// 사용자 측: PII 제외, 날짜/시간/상태만 반환 (가용성 확인용)
// 이름·이메일·전화 등 PII는 일절 노출하지 않음.
export async function GET() {
  try {
    const rows = await sql`
      SELECT id, date::text AS date, start_time, end_time, status
      FROM reservations
      ORDER BY date DESC, start_time ASC`;
    const res = NextResponse.json(rows.map(r => ({
      id: r.id,
      date: r.date,
      startTime: r.start_time,
      endTime: r.end_time,
      status: r.status,
    })));
    res.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
    return res;
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST /api/reservations (사용자 신청, auth 불필요)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const ip = getClientIp(req);
  const rl = await checkRateLimit('reservation-create', ip, 1, '1 m');
  if (!rl.success) return tooManyRequests();

  const required = ['name', 'role', 'taskSummary', 'email', 'date', 'startTime', 'endTime'];
  for (const k of required) {
    if (!body[k]) return NextResponse.json({ error: `${k} 필수` }, { status: 400 });
  }
  try {
    assertCleanFields(body, ['name', 'role', 'taskSummary', 'inquiry', 'email', 'phone']);
  } catch (e) {
    if (e instanceof BadTextError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
  try {
    const rows = await sql`
      INSERT INTO reservations (name, role, task_summary, inquiry, email, phone, date, start_time, end_time)
      VALUES (${body.name}, ${body.role}, ${body.taskSummary}, ${body.inquiry || ''},
              ${body.email}, ${body.phone || ''}, ${body.date}, ${body.startTime}, ${body.endTime})
      RETURNING id`;
    return NextResponse.json({ ok: true, id: rows[0].id }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
