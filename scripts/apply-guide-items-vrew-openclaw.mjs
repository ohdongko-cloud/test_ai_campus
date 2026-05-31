// 가이드(필수도구 둘러보기) 신규 아이템 추가 (멱등).
//   - Vrew      → image-video-ai 그룹 (영상 자동 자막 AI)
//   - OpenClaw  → dev-env       그룹 (오픈소스 게임 엔진)
// 주의: CapCut 은 이미 등록되어 있어 추가 대상 아님.
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

const items = [
  {
    id: 'vrew',
    group_id: 'image-video-ai',
    name: 'Vrew',
    description: '영상에서 음성을 자동으로 인식해 자막을 만들어주는 한국 AI 도구. 무음 구간 자동 컷, 자막 디자인, AI 보이스까지 한 번에 처리.',
    cost: '무료 / 유료 플랜',
    url: 'https://vrew.voyagerx.com',
    recommended: true,
  },
  {
    id: 'openclaw',
    group_id: 'dev-env',
    name: 'OpenClaw',
    description: 'Captain Claw (1997) 게임의 오픈소스 리메이크. C++ 기반 2D 플랫포머 엔진을 GitHub 에서 자유롭게 받아 학습·확장 가능.',
    cost: '무료 (오픈소스, MIT 라이선스)',
    url: 'https://github.com/pjasicek/OpenClaw',
    recommended: false,
  },
];

// 각 그룹의 현재 max(order_idx) 이후로 순서 배치
async function nextOrderIdx(group_id) {
  const rows = await sql`SELECT COALESCE(MAX(order_idx), -1) + 1 AS next FROM guide_items WHERE group_id = ${group_id}`;
  return rows[0].next;
}

for (const it of items) {
  // 동일 id 이미 있으면 skip (멱등)
  const exists = await sql`SELECT id FROM guide_items WHERE id = ${it.id} LIMIT 1`;
  if (exists.length > 0) {
    console.log(`  SKIP ${it.id} (이미 존재)`);
    continue;
  }
  const order_idx = await nextOrderIdx(it.group_id);
  await sql`
    INSERT INTO guide_items (id, group_id, name, description, cost, url, recommended, order_idx)
    VALUES (${it.id}, ${it.group_id}, ${it.name}, ${it.description}, ${it.cost}, ${it.url}, ${it.recommended}, ${order_idx})
  `;
  console.log(`  OK   ${it.id} → ${it.group_id} (order ${order_idx})`);
}

const result = await sql`
  SELECT id, group_id, name, recommended, order_idx
  FROM guide_items
  WHERE id IN ('vrew', 'capcut', 'openclaw')
  ORDER BY group_id, order_idx`;
console.log('\n✅ final state:');
console.table(result);
