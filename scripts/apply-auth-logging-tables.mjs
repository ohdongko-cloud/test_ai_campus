// 인증·로그·이메일 인증 테이블 적용 (멱등).
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

const ddl = [
  `CREATE TABLE IF NOT EXISTS auth_logs (
    id          BIGSERIAL PRIMARY KEY,
    type        TEXT NOT NULL,
    email       TEXT,
    ip          TEXT,
    user_agent  TEXT,
    success     BOOLEAN NOT NULL DEFAULT false,
    detail      TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS auth_logs_type_idx ON auth_logs (type, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS auth_logs_email_idx ON auth_logs (email, created_at DESC)`,

  `CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id          BIGSERIAL PRIMARY KEY,
    action      TEXT NOT NULL,
    target_type TEXT,
    target_id   TEXT,
    ip          TEXT,
    detail      JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS admin_audit_logs_action_idx ON admin_audit_logs (action, created_at DESC)`,

  `CREATE TABLE IF NOT EXISTS access_logs (
    id          BIGSERIAL PRIMARY KEY,
    session_id  TEXT,
    user_id     UUID,
    path        TEXT,
    ip          TEXT,
    user_agent  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS access_logs_created_idx ON access_logs (created_at DESC)`,

  `CREATE TABLE IF NOT EXISTS email_verifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       TEXT NOT NULL,
    code_hash   TEXT NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    consumed    BOOLEAN NOT NULL DEFAULT false,
    ip          TEXT,
    attempts    INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS email_verifications_email_idx ON email_verifications (email, created_at DESC)`,
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

// users.employee_id NOT NULL 제약 해제 (이미 NULL 허용이면 무시)
try {
  await sql.query(`ALTER TABLE users ALTER COLUMN employee_id DROP NOT NULL`);
  console.log('\n  OK  ALTER users.employee_id DROP NOT NULL');
} catch (e) {
  const msg = String(e.message || e);
  if (msg.includes('does not exist')) {
    console.log('\n  SKIP users.employee_id column does not exist');
  } else {
    console.log('\n  SKIP ALTER users.employee_id (likely already nullable):', msg);
  }
}

// users.password_hash 길이 확장 (bcrypt는 60자 — 기존 TEXT면 무방)
const tables = await sql`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema='public'
    AND table_name IN ('auth_logs','admin_audit_logs','access_logs','email_verifications')
  ORDER BY table_name`;
console.log('\n✅ tables ready:', tables.map(t => t.table_name).join(', '));
