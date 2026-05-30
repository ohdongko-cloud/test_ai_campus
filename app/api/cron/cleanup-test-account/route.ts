// 데모용 테스트 계정 자동 정리 cron.
//
// Vercel Cron이 매일 호출. 만료 시각(TEST_ACCOUNT_EXPIRES_AT) 경과 시
// 해당 이메일 회원 row + 관련 데이터(shared_services 등) 삭제.
//
// 인증: Vercel Cron이 자동으로 추가하는 Authorization: Bearer ${CRON_SECRET} 헤더 검증.
// 수동 호출: curl -H "Authorization: Bearer <CRON_SECRET>" https://...vercel.app/api/cron/cleanup-test-account

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';
import { getTestAccountEmail, getTestAccountExpiresAt } from '../../../../lib/test-account';

export async function GET(req: NextRequest) {
  // 인증
  const auth = req.headers.get('authorization') || '';
  const expected = `Bearer ${process.env.CRON_SECRET || ''}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const email = getTestAccountEmail();
  const exp = getTestAccountExpiresAt();
  const now = new Date();

  if (!email) {
    return NextResponse.json({ ok: true, skipped: 'TEST_ACCOUNT_EMAIL not set' });
  }
  if (!exp) {
    return NextResponse.json({ ok: true, skipped: 'TEST_ACCOUNT_EXPIRES_AT not set' });
  }
  if (now < exp) {
    return NextResponse.json({
      ok: true,
      skipped: 'not yet expired',
      expiresAt: exp.toISOString(),
      now: now.toISOString(),
    });
  }

  // 만료됨 — 정리 진행
  try {
    const users = await sql`SELECT id FROM users WHERE email = ${email}`;
    if (users.length === 0) {
      return NextResponse.json({ ok: true, deleted: 0, message: 'no test account exists' });
    }
    const userId = users[0].id;

    // 관련 데이터 정리 (사용자가 등록한 shared_services)
    const services = await sql`DELETE FROM shared_services WHERE user_id = ${userId} RETURNING id`;

    // 세션 쿠키는 만료될 때까지 남지만 user row 삭제로 무효화
    await sql`DELETE FROM users WHERE id = ${userId}`;

    // 인증 시도 로그는 보존 (감사 목적)
    return NextResponse.json({
      ok: true,
      deleted: { users: 1, shared_services: services.length },
      email,
      expiredAt: exp.toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
