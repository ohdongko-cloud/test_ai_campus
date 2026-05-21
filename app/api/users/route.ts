import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../lib/db';

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// POST /api/users  — 신규 계정 생성
export async function POST(req: NextRequest) {
  const { name, corporationName, organizationName, position, email, password } =
    await req.json();

  if (!name?.trim() || !corporationName?.trim() || !organizationName?.trim() ||
      !position?.trim() || !email?.trim() || !password) {
    return NextResponse.json({ error: '모든 필드를 입력해주세요.' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: '비밀번호는 8자 이상이어야 합니다.' }, { status: 400 });
  }

  const emailNorm = email.toLowerCase().trim();
  const password_hash = await sha256(password);

  try {
    const existing = await sql`SELECT id FROM users WHERE email = ${emailNorm} LIMIT 1`;
    if (existing.length > 0) {
      return NextResponse.json({ error: '이미 등록된 이메일입니다.' }, { status: 409 });
    }

    const rows = await sql`
      INSERT INTO users (name, corporation_name, organization_name, position, email, password_hash)
      VALUES (
        ${name.trim()}, ${corporationName.trim()}, ${organizationName.trim()},
        ${position.trim()}, ${emailNorm}, ${password_hash}
      )
      RETURNING id, name, corporation_name, organization_name, position, email`;
    return NextResponse.json(rows[0], { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
