import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';
import { requireAdmin, isDenied } from '../../../../lib/admin-auth';
import { reportError } from '../../../../lib/error-report';

// GET /api/admin/lecture-requests — 강의 요청 목록 (권한: videos)
// PII(요청자 이름·이메일) 응답 — no-store (§6-7).
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'videos');
  if (isDenied(auth)) return auth;

  try {
    const rows = await sql`
      SELECT id, title, content, requester_name, requester_email, status, created_at, updated_at
      FROM lecture_requests
      ORDER BY created_at DESC`;
    return NextResponse.json(rows.map(r => ({
      id: r.id,
      title: r.title,
      content: r.content,
      requesterName: r.requester_name,
      requesterEmail: r.requester_email,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    reportError(e, { route: 'admin/lecture-requests.get' });
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
