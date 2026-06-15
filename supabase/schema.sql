-- Neon DB 스키마 (PostgreSQL)
-- Neon 대시보드 > SQL Editor 에서 실행하세요.

-- posts
CREATE TABLE IF NOT EXISTS posts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title          TEXT NOT NULL,
  content        TEXT NOT NULL,
  password_hash  TEXT,
  link           TEXT,
  views_count    INTEGER NOT NULL DEFAULT 0,
  likes_count    INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  is_deleted     BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- post_likes
CREATE TABLE IF NOT EXISTS post_likes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  liked_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_id, session_id)
);

-- comments
CREATE TABLE IF NOT EXISTS comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id       UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  password_hash TEXT,
  likes_count   INTEGER NOT NULL DEFAULT 0,
  is_deleted    BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- comment_likes
CREATE TABLE IF NOT EXISTS comment_likes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  liked_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(comment_id, session_id)
);

-- users (회원)
CREATE TABLE IF NOT EXISTS users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  corporation_name  TEXT NOT NULL,
  organization_name TEXT NOT NULL,
  position          TEXT NOT NULL,
  email             TEXT NOT NULL,
  password_hash     TEXT NOT NULL,
  video_level         TEXT DEFAULT NULL,        -- 레벨테스트 선택 레벨 (계정 기준 복원용)
  level_test_done_at  TIMESTAMPTZ DEFAULT NULL, -- 레벨테스트 최초 노출/완료 시각 (1회 노출 판단)
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (email);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER posts_updated_at
  BEFORE UPDATE ON posts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER comments_updated_at
  BEFORE UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 영상 좋아요 / 댓글 (videos 자체는 localStorage 기반이므로 FK 없음)
-- ─────────────────────────────────────────────────────────────

-- video_stats: 영상별 카운트 캐시
CREATE TABLE IF NOT EXISTS video_stats (
  video_id        TEXT PRIMARY KEY,
  likes_count     INTEGER NOT NULL DEFAULT 0,
  comments_count  INTEGER NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER video_stats_updated_at
  BEFORE UPDATE ON video_stats FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- video_likes: 세션당 1회 (UNIQUE 제약)
CREATE TABLE IF NOT EXISTS video_likes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id    TEXT NOT NULL,
  session_id  TEXT NOT NULL,
  liked_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(video_id, session_id)
);

CREATE INDEX IF NOT EXISTS video_likes_video_idx ON video_likes (video_id);

-- video_comments: 비번 기반 익명 댓글 (게시판 패턴)
CREATE TABLE IF NOT EXISTS video_comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id      TEXT NOT NULL,
  content       TEXT NOT NULL,
  password_hash TEXT,
  is_deleted    BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS video_comments_video_idx ON video_comments (video_id, created_at);

CREATE TRIGGER video_comments_updated_at
  BEFORE UPDATE ON video_comments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- org_units: 회원가입 부서/직무 드롭다운용 조직 분류 (부서 → 직무)
-- 법인별 조직도. 초기 시드는 이랜드리테일만(M006). 어드민에서 수정.
-- ─────────────────────────────────────────────────────────────
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
);

CREATE INDEX IF NOT EXISTS org_units_corp_dept_idx ON org_units (corporation_name, department);

CREATE TRIGGER org_units_updated_at
  BEFORE UPDATE ON org_units FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- ai_level_attempts: AI 레벨테스트 결과 이력(append). 1행=1응시 (M007)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_level_attempts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID,
  email          TEXT,
  c1_score       NUMERIC,
  c2_score       NUMERIC,
  c3_score       NUMERIC,
  coding_status  TEXT NOT NULL DEFAULT 'pending',
  coding_score   NUMERIC,
  auto_score     NUMERIC,
  level          INTEGER,
  answers        JSONB,
  area_ratio     JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_level_attempts_user_idx ON ai_level_attempts (user_id, created_at DESC);

-- ai_level_coding: 코딩(질) 산출물 제출 — 관리자 주1회 오프라인 채점 (M008)
CREATE TABLE IF NOT EXISTS ai_level_coding (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID,
  email          TEXT,
  submit_kind    TEXT,
  link_url       TEXT,
  blob_url       TEXT,
  blob_pathname  TEXT,
  filename       TEXT,
  service_desc   TEXT,
  needs_account  BOOLEAN,
  test_account   TEXT,
  status         TEXT NOT NULL DEFAULT 'submitted',
  score          NUMERIC,
  reviewer_note  TEXT,
  reviewed_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_level_coding_user_idx ON ai_level_coding (user_id, created_at DESC);

-- ai_level_manual: 관리자 정성 입력(목표·이머니/큰숫자). 사용자당 1행 (M009)
CREATE TABLE IF NOT EXISTS ai_level_manual (
  user_id     UUID PRIMARY KEY,
  goal        TEXT,
  emoney      TEXT,
  note        TEXT,
  updated_by  TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
