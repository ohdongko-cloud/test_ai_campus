import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';

// GET /api/users/exists?email=xxx
export async function GET(req: NextRequest) {
  const email = new URL(req.url).searchParams.get('email')?.toLowerCase().trim();
  if (!email) return NextResponse.json({ exists: false });

  try {
    const rows = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
    return NextResponse.json({ exists: rows.length > 0 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
