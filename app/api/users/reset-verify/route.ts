import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';
import { checkRateLimit, getClientIp, tooManyRequests } from '../../../../lib/ratelimit';
import { signResetToken } from '../../../../lib/jwt';
import { logAuth } from '../../../../lib/audit';

const MAX_ATTEMPTS = 5;

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// POST /api/users/reset-verify  body: { email, code }
// 통과 시 reset_token(15분 유효) 반환.
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit('reset-verify', ip, 10, '5 m');
  if (!rl.success) return tooManyRequests();

  const body = await req.json().catch(() => ({}));
  const email = String(body?.email || '').trim().toLowerCase();
  const code  = String(body?.code  || '').trim();
  if (!email || !code) {
    return NextResponse.json({ error: '이메일과 인증 코드를 입력해주세요.' }, { status: 400 });
  }

  // purpose='reset' 인 가장 최근 미사용 verification
  const rows = await sql`
    SELECT id, code_hash, expires_at, consumed, attempts
    FROM email_verifications
    WHERE email = ${email} AND consumed = false AND purpose = 'reset'
    ORDER BY created_at DESC
    LIMIT 1`;
  const v = rows[0];
  if (!v) {
    await logAuth({ type: 'reset_verify_failure', email, success: false, req, detail: 'no-pending' });
    return NextResponse.json({ error: '발급된 코드가 없습니다. 다시 요청해주세요.' }, { status: 404 });
  }

  if (new Date(v.expires_at) < new Date()) {
    await sql`UPDATE email_verifications SET consumed = true WHERE id = ${v.id}`;
    return NextResponse.json({ error: '코드가 만료되었습니다. 다시 요청해주세요.' }, { status: 410 });
  }

  if (v.attempts >= MAX_ATTEMPTS) {
    await sql`UPDATE email_verifications SET consumed = true WHERE id = ${v.id}`;
    return NextResponse.json({ error: '시도 횟수를 초과했습니다. 코드를 다시 요청해주세요.' }, { status: 429 });
  }

  const candidateHash = await sha256(`${email}:${code}`);
  if (candidateHash !== v.code_hash) {
    await sql`UPDATE email_verifications SET attempts = attempts + 1 WHERE id = ${v.id}`;
    await logAuth({ type: 'reset_verify_failure', email, success: false, req, detail: 'mismatch' });
    return NextResponse.json({ error: '인증 코드가 일치하지 않습니다.' }, { status: 401 });
  }

  await sql`UPDATE email_verifications SET consumed = true WHERE id = ${v.id}`;
  const resetToken = await signResetToken(email, 15 * 60);
  await logAuth({ type: 'reset_verify_success', email, success: true, req });
  return NextResponse.json({ ok: true, resetToken });
}
