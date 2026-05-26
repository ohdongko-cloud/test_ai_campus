import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';
import { requireAdmin } from '../../../../lib/admin-auth';

// POST /api/admin/services
export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const body = await req.json();
  if (!body.serviceName || !body.url) return NextResponse.json({ error: 'serviceName/url 필수' }, { status: 400 });
  try {
    const rows = await sql`
      INSERT INTO shared_services (service_name, description, url, test_account)
      VALUES (${body.serviceName}, ${body.description || ''}, ${body.url}, ${body.testAccount || ''})
      RETURNING id`;
    return NextResponse.json({ ok: true, id: rows[0].id }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
