import { NextResponse } from 'next/server';
import { sql } from '../../../lib/db';

// GET /api/services
export async function GET() {
  try {
    const rows = await sql`
      SELECT id, service_name, description, url, test_account, registered_at
      FROM shared_services
      ORDER BY registered_at DESC`;
    return NextResponse.json(rows.map(r => ({
      id: r.id,
      serviceName: r.service_name,
      description: r.description,
      url: r.url,
      testAccount: r.test_account,
      registeredAt: r.registered_at,
    })));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
