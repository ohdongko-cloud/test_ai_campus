import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../lib/db';
import { verifySignupToken } from '../../../lib/jwt';
import { hashPassword, isValidSimplePassword, PASSWORD_POLICY_MESSAGE } from '../../../lib/password';
import { setUserSessionCookie } from '../../../lib/session';
import { containsReplacementChar } from '../../../lib/text-validation';
import { checkRateLimit, getClientIp, tooManyRequests } from '../../../lib/ratelimit';
import { logAuth } from '../../../lib/audit';
import { reportError } from '../../../lib/error-report';

// POST /api/users — 신규 계정 생성 (이메일 인증 후 signup_token 필수)
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit('users-signup', ip, 5, '10 m');
  if (!rl.success) return tooManyRequests();

  const body = await req.json().catch(() => ({}));
  const {
    signupToken,
    nickname, corporationName, organizationName, position,
    password, passwordConfirm,
  } = body;

  // 1. signup_token 검증
  if (!signupToken) {
    return NextResponse.json({ error: '이메일 인증이 필요합니다.' }, { status: 401 });
  }
  const tokenPayload = await verifySignupToken(String(signupToken));
  if (!tokenPayload) {
    return NextResponse.json({ error: '인증 세션이 만료되었습니다. 다시 인증해주세요.' }, { status: 401 });
  }
  const email = tokenPayload.email;

  // 2. 필드 검증
  if (!nickname?.trim() || !corporationName?.trim() || !organizationName?.trim() ||
      !position?.trim() || !password || !passwordConfirm) {
    return NextResponse.json({ error: '모든 필드를 입력해주세요.' }, { status: 400 });
  }
  if (password !== passwordConfirm) {
    return NextResponse.json({ error: '비밀번호가 일치하지 않습니다.' }, { status: 400 });
  }
  if (!isValidSimplePassword(password)) {
    return NextResponse.json({ error: PASSWORD_POLICY_MESSAGE }, { status: 400 });
  }
  for (const v of [nickname, corporationName, organizationName, position]) {
    if (containsReplacementChar(String(v))) {
      return NextResponse.json({ error: '지원하지 않는 문자가 포함되어 있습니다.' }, { status: 400 });
    }
  }

  try {
    const existing = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
    if (existing.length > 0) {
      return NextResponse.json({ error: '이미 등록된 이메일입니다.' }, { status: 409 });
    }

    const password_hash = await hashPassword(password);
    const rows = await sql`
      INSERT INTO users (name, corporation_name, organization_name, position, email, password_hash)
      VALUES (
        ${String(nickname).trim()},
        ${String(corporationName).trim()},
        ${String(organizationName).trim()},
        ${String(position).trim()},
        ${email},
        ${password_hash}
      )
      RETURNING id, name AS nickname, corporation_name, organization_name, position, email`;
    const u = rows[0];

    // 가입 직후 자동 로그인 (세션 쿠키 발급) — rememberMe는 기본 false
    await setUserSessionCookie(u.id, u.email, false);
    await logAuth({ type: 'signup_complete', email, success: true, req });

    return NextResponse.json({
      id: u.id, nickname: u.nickname, email: u.email,
      corporationName: u.corporation_name,
      organizationName: u.organization_name,
      position: u.position,
    }, { status: 201 });
  } catch (e) {
    reportError(e, { route: 'users.signup', detail: { email } });
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
