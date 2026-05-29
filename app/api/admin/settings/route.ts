import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';
import { checkAdmin } from '../../../../lib/admin-auth';

const ALLOWED_KEYS = new Set([
  'chatroom_url',
  'chatroom_password',
  'chatroom_rules',
  'noa_url',
]);

// PATCH /api/admin/settings  body: { key, value }
export async function PATCH(req: NextRequest) {
  const denied = await checkAdmin(req, 'chatroom');
  if (denied) return denied;

  const { key, value } = await req.json();
  if (!ALLOWED_KEYS.has(key)) return NextResponse.json({ error: '허용되지 않은 키' }, { status: 400 });

  try {
    await sql`
      INSERT INTO app_settings (key, value)
      VALUES (${key}, ${JSON.stringify(value)}::jsonb)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
