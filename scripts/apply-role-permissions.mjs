// users.role / users.permissions 컬럼 추가.
// 멱등(여러 번 실행해도 안전).
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

const stmts = [
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'`,
  // CHECK 제약은 동적 추가 (이미 존재할 수 있음)
  `DO $$
   BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'users_role_check' AND conrelid = 'users'::regclass
     ) THEN
       ALTER TABLE users ADD CONSTRAINT users_role_check
         CHECK (role IN ('user', 'admin'));
     END IF;
   END $$`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{}'::jsonb`,
  `CREATE INDEX IF NOT EXISTS users_role_idx ON users (role) WHERE role = 'admin'`,
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
  SELECT column_name, data_type, column_default
  FROM information_schema.columns
  WHERE table_name = 'users' AND column_name IN ('role', 'permissions')
  ORDER BY column_name`;
console.log('\n✅ users 변경:');
for (const c of cols) console.log(`  - ${c.column_name} ${c.data_type} default ${c.column_default}`);
