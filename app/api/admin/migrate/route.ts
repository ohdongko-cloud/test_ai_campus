import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';
import { requireMaster } from '../../../../lib/admin-auth';

/**
 * POST /api/admin/migrate
 * 멱등 마이그레이션 실행 — 마스터 어드민 전용.
 * 현재 포함된 마이그레이션:
 *   M001: videos.duration TEXT 컬럼 추가
 *   M002: lecture_requests 테이블 생성 (강의 요청)
 */
export async function POST(req: NextRequest) {
  const authCheck = await requireMaster(req);
  if (authCheck instanceof NextResponse) return authCheck;

  const results: { id: string; status: 'ok' | 'skip' | 'error'; message: string }[] = [];

  // M001: videos.duration
  try {
    await sql`ALTER TABLE videos ADD COLUMN IF NOT EXISTS duration TEXT DEFAULT NULL`;
    results.push({ id: 'M001', status: 'ok', message: 'videos.duration 컬럼 추가 완료' });
  } catch (e) {
    const msg = String(e);
    if (msg.includes('already exists')) {
      results.push({ id: 'M001', status: 'skip', message: '이미 존재하는 컬럼' });
    } else {
      results.push({ id: 'M001', status: 'error', message: msg });
    }
  }

  // M002: lecture_requests 테이블 (강의 요청)
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS lecture_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        requester_name TEXT,
        requester_email TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
    results.push({ id: 'M002', status: 'ok', message: 'lecture_requests 테이블 생성 완료' });
  } catch (e) {
    results.push({ id: 'M002', status: 'error', message: String(e) });
  }

  // M003: email_verifications.purpose 컬럼 (signup / reset 구분)
  try {
    await sql`ALTER TABLE email_verifications ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'signup'`;
    results.push({ id: 'M003', status: 'ok', message: 'email_verifications.purpose 컬럼 추가 완료' });
  } catch (e) {
    const msg = String(e);
    if (msg.includes('already exists')) {
      results.push({ id: 'M003', status: 'skip', message: '이미 존재하는 컬럼' });
    } else {
      results.push({ id: 'M003', status: 'error', message: msg });
    }
  }

  const hasError = results.some(r => r.status === 'error');
  return NextResponse.json({ ok: !hasError, results }, { status: hasError ? 500 : 200 });
}
