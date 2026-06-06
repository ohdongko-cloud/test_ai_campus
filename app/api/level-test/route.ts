import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../lib/db';
import { getCurrentUser } from '../../../lib/session';
import { checkRateLimit, getClientIp, tooManyRequests } from '../../../lib/ratelimit';

const VALID_LEVELS = ['새싹', '초급', '중급', '고급'];

// POST /api/level-test  body: { level, answers, securityFlag }
// 레벨 테스트 결과 기록. 로그인 사용자면 email 함께 저장.
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit('level-test', ip, 10, '10 m');
  if (!rl.success) return tooManyRequests();

  const body = await req.json().catch(() => ({}));
  const level = String(body?.level || '');
  if (!VALID_LEVELS.includes(level)) {
    return NextResponse.json({ error: '잘못된 레벨 값입니다.' }, { status: 400 });
  }
  const answers = body?.answers ?? {};
  const securityFlag = !!body?.securityFlag;

  const session = await getCurrentUser();
  const email = session?.email ?? null;

  try {
    await sql`
      INSERT INTO level_tests (email, level, answers, security_flag)
      VALUES (${email}, ${level}, ${JSON.stringify(answers)}::jsonb, ${securityFlag})`;
    // 로그인 사용자면 계정에 선택 레벨 + 완료시각 저장(최초값 보존)
    if (session?.uid) {
      await sql`
        UPDATE users
        SET video_level = ${level},
            level_test_done_at = COALESCE(level_test_done_at, now())
        WHERE id = ${session.uid}`;
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
