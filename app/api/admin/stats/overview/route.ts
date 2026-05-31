import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../../lib/db';
import { checkAdmin } from '../../../../../lib/admin-auth';

// GET /api/admin/stats/overview
// 가입자/방문자 통계 (KST 기준).
//   - totalMembers  : 전체 회원 수
//   - todaySignups  : 오늘(KST) 가입자 수
//   - visitorsToday : 오늘(KST) 로그인 성공한 unique email
//   - visitors7d    : 최근 7일 rolling unique email
//   - visitors30d   : 최근 30일 rolling unique email
//
// 권한: 'members' (master/legacy 자동 통과).
export async function GET(req: NextRequest) {
  const denied = await checkAdmin(req, 'members');
  if (denied) return denied;

  try {
    const [memCount, todayCount, vToday, v7, v30] = await Promise.all([
      sql`SELECT COUNT(*)::int AS n FROM users`,
      sql`SELECT COUNT(*)::int AS n FROM users
          WHERE created_at AT TIME ZONE 'Asia/Seoul'
            >= date_trunc('day', NOW() AT TIME ZONE 'Asia/Seoul')`,
      sql`SELECT COUNT(DISTINCT email)::int AS n FROM auth_logs
          WHERE type = 'login_success'
            AND created_at AT TIME ZONE 'Asia/Seoul'
              >= date_trunc('day', NOW() AT TIME ZONE 'Asia/Seoul')`,
      sql`SELECT COUNT(DISTINCT email)::int AS n FROM auth_logs
          WHERE type = 'login_success'
            AND created_at >= NOW() - INTERVAL '7 days'`,
      sql`SELECT COUNT(DISTINCT email)::int AS n FROM auth_logs
          WHERE type = 'login_success'
            AND created_at >= NOW() - INTERVAL '30 days'`,
    ]);

    return NextResponse.json({
      totalMembers:   memCount[0]?.n ?? 0,
      todaySignups:   todayCount[0]?.n ?? 0,
      visitorsToday:  vToday[0]?.n ?? 0,
      visitors7d:     v7[0]?.n ?? 0,
      visitors30d:    v30[0]?.n ?? 0,
    });
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
