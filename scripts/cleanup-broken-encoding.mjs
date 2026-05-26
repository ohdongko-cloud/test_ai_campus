// 인코딩 손상(U+FFFD) 데이터 정리.
//   - video_comments: 행 삭제 + video_stats.comments_count 감소
//   - posts: soft delete (is_deleted=true)
//   - comments(게시판): soft delete
//   - 그 외 테이블(videos/reservations/services 등)은 발견 시 로그만 남김
//     (운영자 수동 처리).
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);
const FFFD = '�';
const PAT = `%${FFFD}%`;

let totalCleaned = 0;
let manualReview = 0;

// ── video_comments: 삭제 + 카운트 감소
const vcRows = await sql`SELECT id, video_id, content FROM video_comments WHERE content LIKE ${PAT}`;
console.log(`\nvideo_comments: ${vcRows.length} broken rows`);
for (const r of vcRows) {
  console.log('  DELETE id=' + r.id, '| video_id=' + r.video_id, '| content=' + JSON.stringify(r.content));
  await sql`DELETE FROM video_comments WHERE id = ${r.id}`;
  await sql`
    UPDATE video_stats SET comments_count = GREATEST(0, comments_count - 1)
    WHERE video_id = ${r.video_id}`;
  totalCleaned++;
}

// ── posts: soft delete
const pRows = await sql`SELECT id, title FROM posts WHERE (title LIKE ${PAT} OR content LIKE ${PAT}) AND is_deleted = false`;
console.log(`\nposts: ${pRows.length} broken rows`);
for (const r of pRows) {
  console.log('  SOFT-DELETE id=' + r.id, '| title=' + JSON.stringify(r.title));
  await sql`UPDATE posts SET is_deleted = true WHERE id = ${r.id}`;
  totalCleaned++;
}

// ── comments(게시판): soft delete + posts.comments_count 감소
const cRows = await sql`SELECT id, post_id FROM comments WHERE content LIKE ${PAT} AND is_deleted = false`;
console.log(`\ncomments(게시판): ${cRows.length} broken rows`);
for (const r of cRows) {
  console.log('  SOFT-DELETE id=' + r.id);
  await sql`UPDATE comments SET is_deleted = true WHERE id = ${r.id}`;
  await sql`UPDATE posts SET comments_count = GREATEST(0, comments_count - 1) WHERE id = ${r.post_id}`;
  totalCleaned++;
}

// ── 발견만 보고하는 테이블들 (수동 처리 권장)
async function reportOnly(label, query) {
  const rows = await query;
  if (rows.length > 0) {
    console.log(`\n${label}: ${rows.length} broken rows — MANUAL REVIEW`);
    for (const r of rows) console.log('  ', JSON.stringify(r));
    manualReview += rows.length;
  }
}
await reportOnly('videos',          sql`SELECT id, title, description FROM videos WHERE title LIKE ${PAT} OR description LIKE ${PAT}`);
await reportOnly('reservations',    sql`SELECT id, name, task_summary FROM reservations WHERE name LIKE ${PAT} OR task_summary LIKE ${PAT} OR inquiry LIKE ${PAT}`);
await reportOnly('shared_services', sql`SELECT id, service_name FROM shared_services WHERE service_name LIKE ${PAT} OR description LIKE ${PAT}`);
await reportOnly('guide_groups',    sql`SELECT id, name FROM guide_groups WHERE name LIKE ${PAT} OR description LIKE ${PAT}`);
await reportOnly('guide_items',     sql`SELECT id, name FROM guide_items WHERE name LIKE ${PAT} OR description LIKE ${PAT}`);

console.log(`\n✅ done. auto-cleaned: ${totalCleaned}, manual review needed: ${manualReview}`);
