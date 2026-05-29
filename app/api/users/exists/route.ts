import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';
import { checkRateLimit, getClientIp, tooManyRequests } from '../../../../lib/ratelimit';

// GET /api/users/exists?email=xxx
// 이메일 enumeration 방지를 위해 강한 IP 레이트리밋 적용.
export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit('users-exists', ip, 10, '1 m');
  if (!rl.success) return tooManyRequests();

  const email = new URL(req.url).searchParams.get('email')?.toLowerCase().trim();
  if (!email) return NextResponse.json({ exists: false });

  try {
    const rows = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
    return NextResponse.json({ exists: rows.length > 0 });
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
