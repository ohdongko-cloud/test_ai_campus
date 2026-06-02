// video_attachments 테이블 추가 (멱등).
// 영상별 첨부파일 메타데이터. 실제 파일은 Vercel Blob 에 저장됨.
// 영상 삭제 시 cascade 로 첨부파일 row 도 자동 삭제 (Blob 파일은 코드에서 별도 정리).
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

const stmts = [
  `CREATE TABLE IF NOT EXISTS video_attachments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id        TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    filename        TEXT NOT NULL,
    blob_pathname   TEXT NOT NULL UNIQUE,
    blob_url        TEXT NOT NULL,
    size_bytes      BIGINT NOT NULL,
    mime_type       TEXT NOT NULL,
    uploaded_by     UUID REFERENCES users(id) ON DELETE SET NULL,
    download_count  INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_video_attachments_video ON video_attachments(video_id)`,
];

for (const s of stmts) {
  const preview = s.replace(/\s+/g, ' ').slice(0, 90);
  try {
    await sql.query(s);
    console.log('  OK  ', preview);
  } catch (e) {
    const msg = String(e.message || e);
    if (msg.includes('already exists')) {
      console.log('  SKIP', preview);
    } else {
      console.error('  FAIL', preview, '\n        ', msg);
      process.exit(1);
    }
  }
}

const cols = await sql`
  SELECT column_name, data_type FROM information_schema.columns
  WHERE table_name = 'video_attachments' ORDER BY ordinal_position`;
console.log('\n✅ video_attachments columns:');
console.table(cols);

const cnt = await sql`SELECT COUNT(*)::int AS n FROM video_attachments`;
console.log('   현재 row 수:', cnt[0].n);
