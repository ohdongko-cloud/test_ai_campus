import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// POST /api/users/login
export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  if (!email?.trim() || !password) {
    return NextResponse.json({ error: '이메일과 비밀번호를 입력해주세요.' }, { status: 400 });
  }

  const emailNorm = email.toLowerCase().trim();
  const hash = await sha256(password);

  try {
    const rows = await sql`
      SELECT id, name, corporation_name, organization_name, position, email
      FROM users
      WHERE email = ${emailNorm} AND password_hash = ${hash}
      LIMIT 1`;

    if (rows.length === 0) {
      return NextResponse.json({ error: '비밀번호가 올바르지 않습니다.' }, { status: 401 });
    }
    return NextResponse.json(rows[0]);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
