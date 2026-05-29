import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';
import { checkRateLimit, getClientIp, tooManyRequests } from '../../../../lib/ratelimit';
import { sendVerificationEmail } from '../../../../lib/email';
import { logAuth } from '../../../../lib/audit';
import { reportError } from '../../../../lib/error-report';
import { isAllowedSignupEmail, DOMAIN_REJECT_MESSAGE } from '../../../../lib/email-allowlist';

const CODE_TTL_MIN = 10;

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// POST /api/users/signup-request  body: { email }
// 6자리 OTP 발급 + 이메일 발송. 이미 가입된 이메일이어도 200 반환 (enumeration 방지).
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  // IP 단위 강한 제한
  const rlIp = await checkRateLimit('signup-req-ip', ip, 5, '10 m');
  if (!rlIp.success) return tooManyRequests();

  const body = await req.json().catch(() => ({}));
  const email = String(body?.email || '').trim().toLowerCase();
  if (!isAllowedSignupEmail(email)) {
    return NextResponse.json({ error: DOMAIN_REJECT_MESSAGE }, { status: 400 });
  }

  // 이메일 단위 제한
  const rlEmail = await checkRateLimit('signup-req-email', email, 3, '10 m');
  if (!rlEmail.success) return tooManyRequests();

  // 이미 가입된 이메일이면 — enumeration 방지 위해 200 + alreadyMember 반환, 메일은 발송 X
  const existing = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
  if (existing.length > 0) {
    await logAuth({ type: 'signup_request', email, success: false, req, detail: 'already-member' });
    return NextResponse.json({ ok: true, alreadyMember: true });
  }

  // 6자리 OTP
  const code = String(Math.floor(100_000 + Math.random() * 900_000));
  const code_hash = await sha256(`${email}:${code}`);
  const expires_at = new Date(Date.now() + CODE_TTL_MIN * 60_000).toISOString();

  await sql`
    INSERT INTO email_verifications (email, code_hash, expires_at, ip)
    VALUES (${email}, ${code_hash}, ${expires_at}, ${ip})`;

  const send = await sendVerificationEmail(email, code);
  if (!send.ok) {
    // Vercel Functions 로그 + Sentry 모두에 자세한 정보 남기기
    console.error('[signup-request] email send failed', {
      to: email,
      error: send.error,
      from: process.env.EMAIL_FROM,
      hasApiKey: !!process.env.RESEND_API_KEY,
    });
    reportError(new Error(`Resend send failed: ${send.error || 'unknown'}`), {
      route: 'users/signup-request',
      detail: { to: email, from: process.env.EMAIL_FROM, error: send.error },
    });
    await logAuth({
      type: 'signup_request', email, success: false, req,
      detail: `email-send-failed: ${(send.error || '').slice(0, 200)}`,
    });
    return NextResponse.json({
      error: '인증 메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요.',
      // 운영자 디버그 힌트 — 어드민 로그에서 확인 가능
    }, { status: 500 });
  }

  await logAuth({ type: 'signup_request', email, success: true, req });
  return NextResponse.json({ ok: true, ttlMinutes: CODE_TTL_MIN });
}
