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
 *   M007: ai_level_attempts 테이블 생성 (AI 레벨테스트 결과 이력)
 *   M008: ai_level_coding 테이블 생성 (코딩 산출물 제출·채점)
 *   M009: ai_level_manual 테이블 생성 (관리자 정성 입력 — 목표·이머니)
 *   M010: sso_clients 테이블 생성 (SSO 허브 클라이언트 레지스트리 — PRD §3.2)
 *   M011: sso_nonces 테이블 생성 + 만료 인덱스 (SSO 1회성 nonce 스토어 — PRD §4.3)
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

  // M007: ai_level_attempts — AI 레벨테스트 결과 이력(append). 1행=1응시.
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS ai_level_attempts (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id        UUID,
        email          TEXT,
        c1_score       NUMERIC,                      -- 지식 0~100
        c2_score       NUMERIC,                      -- 행동(양) 0~100
        c3_score       NUMERIC,                      -- EBG 0~100
        coding_status  TEXT NOT NULL DEFAULT 'pending', -- pending|none|scored
        coding_score   NUMERIC,
        auto_score     NUMERIC,                      -- 환산점수 0~100
        level          INTEGER,                      -- 1~10
        answers        JSONB,                        -- [{id,choice}] 응답 원본
        area_ratio     JSONB,                        -- 영역별 0~1
        created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
    await sql`CREATE INDEX IF NOT EXISTS ai_level_attempts_user_idx ON ai_level_attempts (user_id, created_at DESC)`;
    results.push({ id: 'M007', status: 'ok', message: 'ai_level_attempts 테이블 준비 완료' });
  } catch (e) {
    results.push({ id: 'M007', status: 'error', message: String(e) });
  }

  // M008: ai_level_coding — 코딩(질) 산출물 제출. 관리자 주1회 오프라인 채점.
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS ai_level_coding (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id        UUID,
        email          TEXT,
        submit_kind    TEXT,                          -- 'link' | 'file'
        link_url       TEXT,
        blob_url       TEXT,
        blob_pathname  TEXT,
        filename       TEXT,
        service_desc   TEXT,                          -- 어떤 서비스인지
        needs_account  BOOLEAN,                       -- 로그인 필요 여부
        test_account   TEXT,                          -- 테스트 계정(없으면 NULL)
        status         TEXT NOT NULL DEFAULT 'submitted', -- submitted | scored
        score          NUMERIC,
        reviewer_note  TEXT,
        reviewed_at    TIMESTAMPTZ,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
    await sql`CREATE INDEX IF NOT EXISTS ai_level_coding_user_idx ON ai_level_coding (user_id, created_at DESC)`;
    results.push({ id: 'M008', status: 'ok', message: 'ai_level_coding 테이블 준비 완료' });
  } catch (e) {
    results.push({ id: 'M008', status: 'error', message: String(e) });
  }

  // M009: ai_level_manual — 관리자 정성 입력(목표·이머니/큰숫자·메모). 사용자당 1행.
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS ai_level_manual (
        user_id     UUID PRIMARY KEY,
        goal        TEXT,                            -- 목표(레벨/점수 등)
        emoney      TEXT,                            -- 이머니/본인 큰 숫자(정성)
        note        TEXT,
        updated_by  TEXT,
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
    results.push({ id: 'M009', status: 'ok', message: 'ai_level_manual 테이블 준비 완료' });
  } catch (e) {
    results.push({ id: 'M009', status: 'error', message: String(e) });
  }

  // M010: sso_clients — SSO 허브 클라이언트(앱) 레지스트리. PRD §3.2.
  // 허용 redirect_uri 화이트리스트 정확매칭 + post_logout_redirect_uris + enabled 플래그.
  // 시드 없음(스포크 운영 URL 미확정 Q6 — 확정 후 DB 직접 추가).
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS sso_clients (
        app                       TEXT PRIMARY KEY,
        name                      TEXT NOT NULL,
        redirect_uris             TEXT[] NOT NULL,
        post_logout_redirect_uris TEXT[] DEFAULT '{}',
        enabled                   BOOLEAN NOT NULL DEFAULT true,
        created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
    results.push({ id: 'M010', status: 'ok', message: 'sso_clients 테이블 준비 완료' });
  } catch (e) {
    results.push({ id: 'M010', status: 'error', message: String(e) });
  }

  // M011: sso_nonces — SSO 1회성 nonce 스토어. PRD §4.3 / Q7 (Neon 테이블, Upstash 미사용).
  // 만료 정리용 인덱스(expires_at) 포함.
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS sso_nonces (
        nonce       TEXT PRIMARY KEY,
        app         TEXT NOT NULL,
        expires_at  TIMESTAMPTZ NOT NULL,
        consumed    BOOLEAN NOT NULL DEFAULT false,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
    await sql`CREATE INDEX IF NOT EXISTS sso_nonces_expires_at_idx ON sso_nonces (expires_at)`;
    results.push({ id: 'M011', status: 'ok', message: 'sso_nonces 테이블 및 만료 인덱스 준비 완료' });
  } catch (e) {
    results.push({ id: 'M011', status: 'error', message: String(e) });
  }

  const hasError = results.some(r => r.status === 'error');
  return NextResponse.json({ ok: !hasError, results }, { status: hasError ? 500 : 200 });
}
