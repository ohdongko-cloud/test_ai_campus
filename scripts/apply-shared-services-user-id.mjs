// shared_services 테이블에 user_id 컬럼 추가 (멱등)
// 회원 누구나 공유 가능하도록 권한 변경에 따른 감사 추적용.
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

const stmts = [
  `ALTER TABLE shared_services ADD COLUMN IF NOT EXISTS user_id UUID`,
  `CREATE INDEX IF NOT EXISTS shared_services_user_id_idx ON shared_services (user_id)`,
];

for (const s of stmts) {
  const preview = s.replace(/\s+/g, ' ').slice(0, 70);
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
  SELECT column_name, data_type FROM information_schema.columns
  WHERE table_name = 'shared_services' AND column_name = 'user_id'`;
console.log('\n✅ shared_services.user_id:', cols);
