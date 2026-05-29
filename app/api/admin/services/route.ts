import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';
import { checkAdmin } from '../../../../lib/admin-auth';
import { assertCleanFields, BadTextError } from '../../../../lib/text-validation';

// POST /api/admin/services
export async function POST(req: NextRequest) {
  const denied = await checkAdmin(req, 'services');
  if (denied) return denied;
  const body = await req.json();
  if (!body.serviceName || !body.url) return NextResponse.json({ error: 'serviceName/url 필수' }, { status: 400 });
  try {
    assertCleanFields(body, ['serviceName', 'description', 'testAccount']);
  } catch (e) {
    if (e instanceof BadTextError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
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
