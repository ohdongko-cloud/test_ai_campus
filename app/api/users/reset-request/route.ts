import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';
import { checkRateLimit, getClientIp, tooManyRequests } from '../../../../lib/ratelimit';
import { sendPasswordResetEmail } from '../../../../lib/email';
import { logAuth } from '../../../../lib/audit';

const CODE_TTL_MIN = 10;

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// POST /api/users/reset-request  body: { email }
// 비밀번호 재설정 OTP 발급 + 메일 발송.
// enumeration 방지: 가입 안 된 이메일이어도 200 반환 (메일은 발송 X).
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  const body = await req.json().catch(() => ({}));
  const email = String(body?.email || '').trim().toLowerCase();
  if (!email) return NextResponse.json({ error: '이메일을 입력해주세요.' }, { status: 400 });

  // 레이트리밋 (IP + 이메일)
  const rlIp = await checkRateLimit('reset-req-ip', ip, 5, '10 m');
  if (!rlIp.success) return tooManyRequests();
  const rlEmail = await checkRateLimit('reset-req-email', email, 3, '10 m');
  if (!rlEmail.success) return tooManyRequests();

  // 회원 존재 확인 — 없으면 enumeration 방지 위해 동일 응답, 메일 미발송
  const existing = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
  if (existing.length === 0) {
    await logAuth({ type: 'reset_request', email, success: false, req, detail: 'non-member' });
    return NextResponse.json({ ok: true, ttlMinutes: CODE_TTL_MIN });
  }

  const code = String(Math.floor(100_000 + Math.random() * 900_000));
  const code_hash = await sha256(`${email}:${code}`);
  const expires_at = new Date(Date.now() + CODE_TTL_MIN * 60_000).toISOString();

  await sql`
    INSERT INTO email_verifications (email, code_hash, expires_at, ip, purpose)
    VALUES (${email}, ${code_hash}, ${expires_at}, ${ip}, 'reset')`;

  const send = await sendPasswordResetEmail(email, code);
  if (!send.ok) {
    await logAuth({ type: 'reset_request', email, success: false, req, detail: `email-send-failed: ${(send.error || '').slice(0, 200)}` });
    return NextResponse.json({ error: '인증 메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요.' }, { status: 500 });
  }

  await logAuth({ type: 'reset_request', email, success: true, req });
  return NextResponse.json({ ok: true, ttlMinutes: CODE_TTL_MIN });
}
