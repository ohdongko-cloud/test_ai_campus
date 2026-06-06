import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';
import { getCurrentUser } from '../../../../lib/session';
import { checkRateLimit, getClientIp, tooManyRequests } from '../../../../lib/ratelimit';

// POST /api/level-test/seen
// 레벨테스트 팝업이 '노출된 시점'을 계정에 기록한다(최초값 보존).
// 로그인 사용자만 의미가 있으며, 비로그인은 무해하게 통과한다.
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit('level-test-seen', ip, 20, '10 m');
  if (!rl.success) return tooManyRequests();

  const session = await getCurrentUser();
  if (!session) return NextResponse.json({ ok: true });

  try {
    await sql`
      UPDATE users
      SET level_test_done_at = COALESCE(level_test_done_at, now())
      WHERE id = ${session.uid}`;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
