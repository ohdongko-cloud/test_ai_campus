// videos 테이블에 is_required 컬럼 추가 (멱등).
//   - 필수 시청 영상 표시용. 사용자 카드 우상단에 빨간 뱃지로 노출.
//   - 기본값 false → 기존 row 모두 false로 채워짐.
//   - 부분 인덱스: 향후 "필수 시청만 보기" 필터 대비.
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

const stmts = [
  `ALTER TABLE videos ADD COLUMN IF NOT EXISTS is_required BOOLEAN NOT NULL DEFAULT false`,
  `CREATE INDEX IF NOT EXISTS idx_videos_is_required ON videos(is_required) WHERE is_required = true`,
];

for (const s of stmts) {
  const preview = s.replace(/\s+/g, ' ').slice(0, 80);
  try {
    await sql.query(s);
    console.log('  OK  ', preview);
  } catch (e) {
    const msg = String(e.message || e);
    if (msg.includes('already exists') || msg.includes('does not exist')) {
      console.log('  SKIP', preview);
    } else {
      console.error('  FAIL', preview, '\n        ', msg);
      process.exit(1);
    }
  }
}

const cols = await sql`
  SELECT column_name, data_type, column_default, is_nullable
  FROM information_schema.columns
  WHERE table_name = 'videos' AND column_name = 'is_required'`;
console.log('\n✅ videos.is_required:', cols);

const counts = await sql`
  SELECT
    COUNT(*) FILTER (WHERE is_required = true)  AS required_count,
    COUNT(*) FILTER (WHERE is_required = false) AS optional_count
  FROM videos`;
console.log('   row stats:', counts[0]);
