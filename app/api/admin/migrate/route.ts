import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';
import { requireMaster } from '../../../../lib/admin-auth';
import { flattenOrgSeed, ORG_SEED_CORP } from '../../../../lib/org-seed';

/**
 * POST /api/admin/migrate
 * 멱등 마이그레이션 실행 — 마스터 어드민 전용.
 * 현재 포함된 마이그레이션:
 *   M001: videos.duration TEXT 컬럼 추가
 *   M002: lecture_requests 테이블 생성 (강의 요청)
 *   M003: email_verifications.purpose 컬럼 추가
 *   M004: level_tests 테이블 생성 (레벨 테스트 검증내역)
 *   M005: users.video_level / users.level_test_done_at 컬럼 추가
 *   M006: org_units 테이블 생성 + 이랜드리테일 조직도 시드 (부서/직무 드롭다운)
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

  // M004: level_tests 테이블 (레벨 테스트 검증내역)
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS level_tests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT,
        level TEXT NOT NULL,
        answers JSONB NOT NULL,
        security_flag BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
    results.push({ id: 'M004', status: 'ok', message: 'level_tests 테이블 생성 완료' });
  } catch (e) {
    results.push({ id: 'M004', status: 'error', message: String(e) });
  }

  // M005: users.video_level / users.level_test_done_at (레벨테스트 계정 기준 1회 노출)
  try {
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS video_level TEXT DEFAULT NULL`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS level_test_done_at TIMESTAMPTZ DEFAULT NULL`;
    results.push({ id: 'M005', status: 'ok', message: 'users.video_level / level_test_done_at 컬럼 추가 완료' });
  } catch (e) {
    const msg = String(e);
    if (msg.includes('already exists')) {
      results.push({ id: 'M005', status: 'skip', message: '이미 존재하는 컬럼' });
    } else {
      results.push({ id: 'M005', status: 'error', message: msg });
    }
  }

  // M006: org_units 테이블 + 이랜드리테일 조직도 시드 (부서 → 직무)
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS org_units (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        corporation_name  TEXT NOT NULL DEFAULT '이랜드리테일',
        department        TEXT NOT NULL,
        position          TEXT NOT NULL,
        sort_order        INTEGER NOT NULL DEFAULT 0,
        is_active         BOOLEAN NOT NULL DEFAULT true,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (corporation_name, department, position)
      )`;
    await sql`CREATE INDEX IF NOT EXISTS org_units_corp_dept_idx ON org_units (corporation_name, department)`;

    // 멱등 시드: 평면 행을 JSON으로 전달 → ON CONFLICT DO NOTHING.
    // sort_order는 시드 배열 순서(부서/직무 입력 순서)를 보존한다.
    const rows = flattenOrgSeed().map((r, i) => ({ ...r, sort_order: i }));
    const seeded = await sql`
      INSERT INTO org_units (corporation_name, department, position, sort_order)
      SELECT ${ORG_SEED_CORP}, x.department, x.position, x.sort_order
      FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb)
        AS x(department text, position text, sort_order int)
      ON CONFLICT (corporation_name, department, position) DO NOTHING
      RETURNING id`;
    results.push({
      id: 'M006',
      status: 'ok',
      message: `org_units 준비 완료 (시드 ${rows.length}행 중 신규 ${seeded.length}행 적재)`,
    });
  } catch (e) {
    results.push({ id: 'M006', status: 'error', message: String(e) });
  }

  const hasError = results.some(r => r.status === 'error');
  return NextResponse.json({ ok: !hasError, results }, { status: hasError ? 500 : 200 });
}
