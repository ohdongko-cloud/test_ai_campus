import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../lib/db';

const PUBLIC_KEYS = new Set([
  'chatroom_url',
  'chatroom_password',
  'chatroom_rules',
  'noa_url',
]);

// GET /api/settings?keys=chatroom_url,noa_url
export async function GET(req: NextRequest) {
  const keysParam = new URL(req.url).searchParams.get('keys') || '';
  const requested = keysParam.split(',').map(s => s.trim()).filter(Boolean);
  const allowed = requested.filter(k => PUBLIC_KEYS.has(k));
  if (allowed.length === 0) return NextResponse.json({});

  try {
    const rows = await sql`
      SELECT key, value FROM app_settings WHERE key = ANY(${allowed}::text[])`;
    const out: Record<string, unknown> = {};
    for (const r of rows) out[r.key] = r.value;
    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
