import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';
import { config } from 'node:process';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const sql = neon(url);
const schema = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');

// Split on semicolons that end a statement, but keep $$...$$ function bodies intact.
function splitStatements(src) {
  const out = [];
  let buf = '';
  let inDollar = false;
  const lines = src.split(/\r?\n/);
  for (const line of lines) {
    if (line.includes('$$')) {
      const count = (line.match(/\$\$/g) || []).length;
      for (let i = 0; i < count; i++) inDollar = !inDollar;
    }
    buf += line + '\n';
    if (!inDollar && /;\s*(--.*)?$/.test(line.trim())) {
      const stmt = buf.trim();
      if (stmt && !stmt.startsWith('--')) out.push(stmt);
      buf = '';
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

const statements = splitStatements(schema);
console.log(`Applying ${statements.length} statements...`);

for (const stmt of statements) {
  const preview = stmt.replace(/\s+/g, ' ').slice(0, 80);
  try {
    await sql.query(stmt);
    console.log('  OK  ', preview);
  } catch (err) {
    const msg = String(err.message || err);
    if (msg.includes('already exists')) {
      console.log('  SKIP', preview, '(already exists)');
    } else {
      console.error('  FAIL', preview);
      console.error('       ', msg);
      process.exit(1);
    }
  }
}

console.log('\nSchema applied. Verifying tables...');
const tables = await sql`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema='public' ORDER BY table_name
`;
console.log(tables.map(t => '  - ' + t.table_name).join('\n'));
