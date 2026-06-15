import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';
import { getCurrentUser } from '../../../../lib/session';
import { checkRateLimit, getClientIp, tooManyRequests } from '../../../../lib/ratelimit';
import { nextOrResult, type Answer } from '../../../../lib/level-test-engine';

// POST /api/ai-level-test/next
// body: { attemptId: string, answers: [{id, choice}] }
// 다음 문항 또는 최종 결과를 반환(stateless). 종료 시 결과를 DB에 영속(베스트 에포트).
export async function POST(req: NextRequest) {
  // 문항 단위 호출(응시 1회 ~20건). 사내 NAT(다수 인원이 한 IP) 고려:
  // 로그인 사용자는 uid 기준(넉넉히), 비로그인은 IP 기준(느슨하게)으로 제한.
  const session = await getCurrentUser();
  const key = session?.uid ? `uid:${session.uid}` : getClientIp(req);
  const rl = await checkRateLimit('ai-level-next', key, session?.uid ? 300 : 600, '10 m');
  if (!rl.success) return tooManyRequests();

  const body = await req.json().catch(() => ({}));
  const attemptId = String(body?.attemptId || '').slice(0, 64);
  const rawAnswers: Answer[] = Array.isArray(body?.answers)
    ? body.answers.filter((a: unknown) => a && typeof (a as Answer).id === 'string').map((a: Answer) => ({ id: String(a.id), choice: Number(a.choice) }))
    : [];
  if (!attemptId) return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });

  let result;
  try {
    result = nextOrResult(attemptId, rawAnswers);
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }

  // 진행 중: 다음 문항 반환
  if (result.done === false) {
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  }

  // 종료: 로그인 사용자면 결과 영속(실패해도 결과는 반환)
  if (session?.uid) {
    try {
      await sql`
        INSERT INTO ai_level_attempts
          (user_id, email, c1_score, c2_score, c3_score, coding_status, auto_score, level, answers, area_ratio)
        VALUES (${session.uid}, ${session.email ?? null}, ${result.c1}, ${result.c2}, ${result.c3},
                ${result.codingStatus}, ${result.autoScore}, ${result.level},
                ${JSON.stringify(rawAnswers)}::jsonb, ${JSON.stringify(result.areaRatio)}::jsonb)`;
    } catch { /* DB 미가용 시에도 결과는 보여준다 */ }
  }

  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
}
