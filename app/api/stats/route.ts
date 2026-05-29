import { NextResponse } from 'next/server';
import { sql } from '../../../lib/db';

/** 이번 주 월요일 날짜(YYYY-MM-DD) 반환 */
function getWeekStart(): string {
  const today = new Date();
  const day = today.getDay(); // 0=일
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);
  return monday.toISOString().slice(0, 10);
}

// GET /api/stats
export async function GET() {
  try {
    const weekStart = getWeekStart(); // 'YYYY-MM-DD'
    const [weekRow] = await sql`
      SELECT COUNT(*)::int AS count
      FROM posts
      WHERE is_deleted = false
        AND created_at::date >= ${weekStart}::date
    `;
    const [newRow] = await sql`
      SELECT COUNT(*)::int AS count
      FROM posts
      WHERE is_deleted = false
        AND created_at > NOW() - INTERVAL '48 hours'
    `;
    const res = NextResponse.json({
      postsThisWeek: weekRow?.count ?? 0,
      postsNew:      newRow?.count  ?? 0,
    });
    res.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return res;
  } catch {
    return NextResponse.json({ postsThisWeek: 0, postsNew: 0 });
  }
}
