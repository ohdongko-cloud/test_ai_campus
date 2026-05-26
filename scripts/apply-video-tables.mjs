import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const sql = neon(url);

const statements = [
  `CREATE TABLE IF NOT EXISTS video_stats (
    video_id        TEXT PRIMARY KEY,
    likes_count     INTEGER NOT NULL DEFAULT 0,
    comments_count  INTEGER NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS video_likes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id    TEXT NOT NULL,
    session_id  TEXT NOT NULL,
    liked_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(video_id, session_id)
  )`,
  `CREATE INDEX IF NOT EXISTS video_likes_video_idx ON video_likes (video_id)`,
  `CREATE TABLE IF NOT EXISTS video_comments (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id      TEXT NOT NULL,
    content       TEXT NOT NULL,
    password_hash TEXT,
    is_deleted    BOOLEAN NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS video_comments_video_idx ON video_comments (video_id, created_at)`,
  `CREATE TRIGGER video_stats_updated_at
    BEFORE UPDATE ON video_stats FOR EACH ROW EXECUTE FUNCTION set_updated_at()`,
  `CREATE TRIGGER video_comments_updated_at
    BEFORE UPDATE ON video_comments FOR EACH ROW EXECUTE FUNCTION set_updated_at()`,
];

for (const stmt of statements) {
  const preview = stmt.replace(/\s+/g, ' ').slice(0, 70);
  try {
    await sql.query(stmt);
    console.log('  OK  ', preview);
  } catch (err) {
    const msg = String(err.message || err);
    if (msg.includes('already exists')) {
      console.log('  SKIP', preview);
    } else {
      console.error('  FAIL', preview, '\n        ', msg);
      process.exit(1);
    }
  }
}

const tables = await sql`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema='public' AND table_name LIKE 'video_%'
  ORDER BY table_name`;
console.log('\nvideo_* tables:', tables.map(t => t.table_name).join(', '));
