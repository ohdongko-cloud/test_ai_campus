// 손상된 텍스트(U+FFFD 등) 데이터가 어느 테이블에 있는지 스캔
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);

const FFFD = '�';
const pat = `%${FFFD}%`;

async function scan(label, query) {
  try {
    const rows = await query;
    console.log(`\n=== ${label}: ${rows.length} rows ===`);
    for (const r of rows) console.log('  ', JSON.stringify(r));
  } catch (e) {
    console.error(label, 'ERROR:', String(e.message || e));
  }
}

await scan('video_comments', sql`SELECT id, content FROM video_comments WHERE content LIKE ${pat}`);
await scan('videos.title',   sql`SELECT id, title FROM videos WHERE title LIKE ${pat}`);
await scan('videos.description', sql`SELECT id, description FROM videos WHERE description LIKE ${pat}`);
await scan('reservations', sql`SELECT id, name, task_summary FROM reservations WHERE name LIKE ${pat} OR task_summary LIKE ${pat} OR inquiry LIKE ${pat}`);
await scan('shared_services', sql`SELECT id, service_name FROM shared_services WHERE service_name LIKE ${pat} OR description LIKE ${pat}`);
await scan('posts',    sql`SELECT id, title FROM posts WHERE title LIKE ${pat} OR content LIKE ${pat}`);
await scan('comments', sql`SELECT id FROM comments WHERE content LIKE ${pat}`);
await scan('guide_groups', sql`SELECT id, name FROM guide_groups WHERE name LIKE ${pat} OR description LIKE ${pat}`);
await scan('guide_items',  sql`SELECT id, name FROM guide_items WHERE name LIKE ${pat} OR description LIKE ${pat}`);
