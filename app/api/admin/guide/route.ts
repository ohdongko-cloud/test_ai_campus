import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';
import { requireAdmin } from '../../../../lib/admin-auth';

// PUT /api/admin/guide  body: GuideGroup[]
// 단순한 전체 교체 방식 — 가이드 트리는 작아서 일괄 교체가 안전.
export async function PUT(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const groups = await req.json();
  if (!Array.isArray(groups)) return NextResponse.json({ error: 'groups 배열 필요' }, { status: 400 });

  try {
    // 트랜잭션처럼 동작하도록 순차 실행
    await sql`DELETE FROM guide_items`;
    await sql`DELETE FROM guide_groups`;

    for (let gi = 0; gi < groups.length; gi++) {
      const g = groups[gi];
      await sql`
        INSERT INTO guide_groups (id, name, description, order_idx)
        VALUES (${g.id}, ${g.name}, ${g.description || ''}, ${gi})`;
      if (Array.isArray(g.items)) {
        for (let ii = 0; ii < g.items.length; ii++) {
          const it = g.items[ii];
          await sql`
            INSERT INTO guide_items (id, group_id, name, description, cost, url, recommended, order_idx)
            VALUES (${it.id}, ${g.id}, ${it.name}, ${it.description || ''},
                    ${it.cost || ''}, ${it.url || ''}, ${!!it.recommended}, ${ii})`;
        }
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
