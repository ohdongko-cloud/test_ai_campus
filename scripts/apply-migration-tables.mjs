// Phase 0~3 DB 이관용 신규 테이블 생성 + 시드 데이터 삽입
// 멱등(idempotent) — 여러 번 실행해도 안전.
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const sql = neon(url);

const ddl = [
  // videos
  `CREATE TABLE IF NOT EXISTS videos (
    id            TEXT PRIMARY KEY,
    title         TEXT NOT NULL,
    level         TEXT NOT NULL,
    description   TEXT NOT NULL DEFAULT '',
    youtube_url   TEXT NOT NULL,
    view_count    INTEGER NOT NULL DEFAULT 0,
    stages        JSONB NOT NULL DEFAULT '[]'::jsonb,
    order_idx     INTEGER NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS videos_order_idx ON videos (order_idx)`,

  // video_levels
  `CREATE TABLE IF NOT EXISTS video_levels (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL UNIQUE,
    description  TEXT NOT NULL DEFAULT '',
    order_idx    INTEGER NOT NULL DEFAULT 0
  )`,

  // reservations
  `CREATE TABLE IF NOT EXISTS reservations (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT NOT NULL,
    role          TEXT NOT NULL,
    task_summary  TEXT NOT NULL,
    inquiry       TEXT NOT NULL DEFAULT '',
    email         TEXT NOT NULL,
    phone         TEXT NOT NULL DEFAULT '',
    date          DATE NOT NULL,
    start_time    TEXT NOT NULL,
    end_time      TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','confirmed','cancelled')),
    registered_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS reservations_date_idx ON reservations (date)`,

  // blocked_slots
  `CREATE TABLE IF NOT EXISTS blocked_slots (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date        DATE,
    day_of_week INTEGER CHECK (day_of_week BETWEEN 1 AND 5),
    start_time  TEXT NOT NULL,
    end_time    TEXT,
    reason      TEXT,
    recurring   BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  // shared_services
  `CREATE TABLE IF NOT EXISTS shared_services (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name  TEXT NOT NULL,
    description   TEXT NOT NULL DEFAULT '',
    url           TEXT NOT NULL,
    test_account  TEXT NOT NULL DEFAULT '',
    registered_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,

  // guide_groups / guide_items
  `CREATE TABLE IF NOT EXISTS guide_groups (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    order_idx   INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS guide_items (
    id          TEXT PRIMARY KEY,
    group_id    TEXT NOT NULL REFERENCES guide_groups(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    cost        TEXT NOT NULL DEFAULT '',
    url         TEXT NOT NULL DEFAULT '',
    recommended BOOLEAN NOT NULL DEFAULT false,
    order_idx   INTEGER NOT NULL DEFAULT 0
  )`,

  // app_settings: 단일값 config
  `CREATE TABLE IF NOT EXISTS app_settings (
    key        TEXT PRIMARY KEY,
    value      JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
];

// Trigger guards
const triggers = [
  { name: 'videos_updated_at',       table: 'videos' },
  { name: 'app_settings_updated_at', table: 'app_settings' },
];

console.log('Applying DDL...');
for (const stmt of ddl) {
  const preview = stmt.replace(/\s+/g, ' ').slice(0, 70);
  try { await sql.query(stmt); console.log('  OK  ', preview); }
  catch (e) {
    const msg = String(e.message || e);
    if (msg.includes('already exists')) console.log('  SKIP', preview);
    else { console.error('  FAIL', preview, '\n        ', msg); process.exit(1); }
  }
}

console.log('\nApplying triggers...');
for (const t of triggers) {
  try {
    await sql.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = '${t.name}') THEN
          CREATE TRIGGER ${t.name}
            BEFORE UPDATE ON ${t.table}
            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
        END IF;
      END $$;
    `);
    console.log('  OK  ', t.name);
  } catch (e) {
    console.error('  FAIL', t.name, '\n        ', String(e.message || e));
    process.exit(1);
  }
}

// Seed video_levels
console.log('\nSeeding video_levels...');
const levels = [
  { id: 'basic',        name: '기초', desc: '기초 개념과 입문 수준의 강의',   ord: 0 },
  { id: 'intermediate', name: '중급', desc: '실무 활용 수준의 강의',          ord: 1 },
  { id: 'advanced',     name: '고급', desc: '심화 및 고급 기술 강의',         ord: 2 },
  { id: 'applied',      name: '응용', desc: '실제 프로젝트 적용 수준의 강의', ord: 3 },
];
for (const lv of levels) {
  await sql`
    INSERT INTO video_levels (id, name, description, order_idx)
    VALUES (${lv.id}, ${lv.name}, ${lv.desc}, ${lv.ord})
    ON CONFLICT (id) DO NOTHING`;
}
console.log('  ✓', levels.length, 'levels');

// Seed videos (id 1~5 to preserve like/comment FKs)
console.log('\nSeeding videos...');
const yt = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const videos = [
  { id: '1', title: 'AI란 무엇인가 — 기초 개념 정리', level: '기초', desc: 'AI의 기본 개념과 머신러닝, 딥러닝의 차이를 쉽게 설명합니다.', ord: 0 },
  { id: '2', title: 'ChatGPT 업무 활용법',           level: '기초', desc: '실무에서 바로 쓸 수 있는 프롬프트 작성 방법을 소개합니다.',  ord: 1 },
  { id: '3', title: 'AI API 연동 기초 — REST API 이해', level: '중급', desc: 'AI 서비스를 외부 시스템과 연결하는 API 기초를 다룹니다.',   ord: 2 },
  { id: '4', title: '사내 챗봇 만들기 실습',         level: '고급', desc: '실제 사내 데이터를 활용해 간단한 질의응답 챗봇을 구축합니다.', ord: 3 },
  { id: '5', title: 'AI 자동화 파이프라인 설계',     level: '응용', desc: '반복 업무를 AI로 자동화하는 파이프라인 설계 방법을 다룹니다.', ord: 4 },
];
for (const v of videos) {
  await sql`
    INSERT INTO videos (id, title, level, description, youtube_url, view_count, stages, order_idx)
    VALUES (${v.id}, ${v.title}, ${v.level}, ${v.desc}, ${yt}, 0, '[]'::jsonb, ${v.ord})
    ON CONFLICT (id) DO NOTHING`;
}
console.log('  ✓', videos.length, 'videos');

// Seed chatroom_rules / noa_url defaults
console.log('\nSeeding app_settings defaults...');
const defaultRules = `1. 존댓말로 소통해 주세요.
2. AI 관련 질문과 팁만 공유해 주세요.
3. 타인 비방 및 욕설은 금지입니다.
4. 광고·홍보성 게시물은 삭제됩니다.
5. 회사 기밀 정보는 공유하지 마세요.`;
for (const [key, value] of [
  ['chatroom_rules', defaultRules],
  ['chatroom_url',   ''],
  ['chatroom_password', ''],
  ['noa_url', ''],
]) {
  await sql`
    INSERT INTO app_settings (key, value)
    VALUES (${key}, ${JSON.stringify(value)}::jsonb)
    ON CONFLICT (key) DO NOTHING`;
}
console.log('  ✓ chatroom_rules / chatroom_url / chatroom_password / noa_url');

// Summary
const tables = await sql`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema='public'
    AND table_name IN ('videos','video_levels','reservations','blocked_slots','shared_services','guide_groups','guide_items','app_settings')
  ORDER BY table_name`;
console.log('\n✅ tables ready:', tables.map(t => t.table_name).join(', '));
