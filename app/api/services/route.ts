import { NextResponse } from 'next/server';
import { sql } from '../../../lib/db';

// GET /api/services
export async function GET() {
  try {
    const rows = await sql`
      SELECT id, service_name, description, url, test_account, registered_at
      FROM shared_services
      ORDER BY registered_at DESC`;
    const res = NextResponse.json(rows.map(r => ({
      id: r.id,
      serviceName: r.service_name,
      description: r.description,
      url: r.url,
      testAccount: r.test_account,
      registeredAt: r.registered_at,
    })));
    res.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return res;
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
