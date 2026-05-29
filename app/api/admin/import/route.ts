import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';
import { checkAdmin } from '../../../../lib/admin-auth';
import { containsReplacementChar } from '../../../../lib/text-validation';

interface Stage { id: string; title: string; description: string }
interface VideoPayload { id: string; title: string; level: string; description?: string; youtubeUrl: string; stages?: Stage[]; order?: number; viewCount?: number }
interface LevelPayload { id: string; name: string; description?: string; order_idx?: number }
interface ServicePayload { serviceName: string; description?: string; url: string; testAccount?: string }
interface GuideItem { id: string; name: string; description?: string; cost?: string; url?: string; recommended?: boolean }
interface GuideGroup { id: string; name: string; description?: string; items: GuideItem[] }
interface Settings { chatroom_url?: string; chatroom_password?: string; chatroom_rules?: string; noa_url?: string }
interface Reservation { id?: string; name: string; role: string; taskSummary: string; inquiry?: string; email: string; phone?: string; date: string; startTime: string; endTime: string; status?: string }
interface BlockedSlot { id?: string; date?: string; dayOfWeek?: number; startTime: string; endTime?: string; reason?: string; recurring: boolean }

interface ImportPayload {
  videoLevels?: LevelPayload[];
  videos?: VideoPayload[];
  services?: ServicePayload[];
  guideGroups?: GuideGroup[];
  settings?: Settings;
  reservations?: Reservation[];
  blockedSlots?: BlockedSlot[];
}

/** 텍스트 필드 손상 여부 검사 — true면 거부 */
function hasBrokenText(p: ImportPayload): string | null {
  const check = (s: unknown, label: string) => typeof s === 'string' && containsReplacementChar(s) ? label : null;
  for (const v of p.videos || []) {
    if (check(v.title, 'video.title')) return 'video.title';
    if (check(v.description, 'video.description')) return 'video.description';
  }
  for (const lv of p.videoLevels || []) {
    if (check(lv.name, 'level.name')) return 'level.name';
    if (check(lv.description, 'level.description')) return 'level.description';
  }
  for (const s of p.services || []) {
    if (check(s.serviceName, 'service.name')) return 'service.name';
    if (check(s.description, 'service.description')) return 'service.description';
  }
  for (const g of p.guideGroups || []) {
    if (check(g.name, 'guide.group.name')) return 'guide.group.name';
    if (check(g.description, 'guide.group.description')) return 'guide.group.description';
    for (const it of g.items || []) {
      if (check(it.name, 'guide.item.name')) return 'guide.item.name';
      if (check(it.description, 'guide.item.description')) return 'guide.item.description';
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  const denied = await checkAdmin(req, 'import');
  if (denied) return denied;

  const payload = await req.json() as ImportPayload;
  const broken = hasBrokenText(payload);
  if (broken) {
    return NextResponse.json({ ok: false, error: `손상된 텍스트(${broken})가 발견되어 임포트를 거부합니다. localStorage를 확인하세요.` }, { status: 400 });
  }

  const summary = {
    videoLevels: 0, videos: 0, services: 0,
    guideGroups: 0, guideItems: 0,
    settings: 0, reservations: 0, blockedSlots: 0,
  };
  const completed: string[] = [];

  try {
    // 1. video_levels — UPSERT by id
    for (const lv of payload.videoLevels || []) {
      if (!lv.id || !lv.name) continue;
      await sql`
        INSERT INTO video_levels (id, name, description, order_idx)
        VALUES (${lv.id}, ${lv.name}, ${lv.description || ''}, ${lv.order_idx ?? 0})
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          order_idx = EXCLUDED.order_idx`;
      summary.videoLevels++;
    }
    completed.push('videoLevels');

    // 2. videos — UPSERT by id
    const vids = payload.videos || [];
    for (let i = 0; i < vids.length; i++) {
      const v = vids[i];
      if (!v.id || !v.title || !v.youtubeUrl) continue;
      const stagesJson = JSON.stringify(Array.isArray(v.stages) ? v.stages : []);
      await sql`
        INSERT INTO videos (id, title, level, description, youtube_url, view_count, stages, order_idx)
        VALUES (${v.id}, ${v.title}, ${v.level || '기초'}, ${v.description || ''},
                ${v.youtubeUrl}, ${v.viewCount ?? 0}, ${stagesJson}::jsonb, ${v.order ?? i})
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          level = EXCLUDED.level,
          description = EXCLUDED.description,
          youtube_url = EXCLUDED.youtube_url,
          stages = EXCLUDED.stages,
          order_idx = EXCLUDED.order_idx`;
      summary.videos++;
    }
    completed.push('videos');

    // 3. shared_services — INSERT (id 자동)
    for (const s of payload.services || []) {
      if (!s.serviceName || !s.url) continue;
      await sql`
        INSERT INTO shared_services (service_name, description, url, test_account)
        VALUES (${s.serviceName}, ${s.description || ''}, ${s.url}, ${s.testAccount || ''})`;
      summary.services++;
    }
    completed.push('services');

    // 4. guide — 전체 교체 (groups + items 모두 삭제 후 새로 INSERT)
    if (Array.isArray(payload.guideGroups) && payload.guideGroups.length > 0) {
      await sql`DELETE FROM guide_items`;
      await sql`DELETE FROM guide_groups`;
      for (let gi = 0; gi < payload.guideGroups.length; gi++) {
        const g = payload.guideGroups[gi];
        if (!g.id || !g.name) continue;
        await sql`
          INSERT INTO guide_groups (id, name, description, order_idx)
          VALUES (${g.id}, ${g.name}, ${g.description || ''}, ${gi})`;
        summary.guideGroups++;
        for (let ii = 0; ii < (g.items || []).length; ii++) {
          const it = g.items[ii];
          if (!it.id || !it.name) continue;
          await sql`
            INSERT INTO guide_items (id, group_id, name, description, cost, url, recommended, order_idx)
            VALUES (${it.id}, ${g.id}, ${it.name}, ${it.description || ''},
                    ${it.cost || ''}, ${it.url || ''}, ${!!it.recommended}, ${ii})`;
          summary.guideItems++;
        }
      }
    }
    completed.push('guide');

    // 5. app_settings — UPSERT per key
    const settings = payload.settings || {};
    const settingKeys: (keyof Settings)[] = ['chatroom_url', 'chatroom_password', 'chatroom_rules', 'noa_url'];
    for (const k of settingKeys) {
      const v = settings[k];
      if (typeof v !== 'string') continue;
      await sql`
        INSERT INTO app_settings (key, value)
        VALUES (${k}, ${JSON.stringify(v)}::jsonb)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
      summary.settings++;
    }
    completed.push('settings');

    // 6. reservations — INSERT (id는 새 UUID로, 일반적으로 빈 배열)
    for (const r of payload.reservations || []) {
      if (!r.name || !r.date || !r.startTime || !r.endTime || !r.email) continue;
      await sql`
        INSERT INTO reservations (name, role, task_summary, inquiry, email, phone, date, start_time, end_time, status)
        VALUES (${r.name}, ${r.role || ''}, ${r.taskSummary || ''}, ${r.inquiry || ''},
                ${r.email}, ${r.phone || ''}, ${r.date}, ${r.startTime}, ${r.endTime},
                ${r.status || 'pending'})`;
      summary.reservations++;
    }
    completed.push('reservations');

    // 7. blocked_slots — INSERT
    for (const b of payload.blockedSlots || []) {
      if (!b.startTime) continue;
      await sql`
        INSERT INTO blocked_slots (date, day_of_week, start_time, end_time, reason, recurring)
        VALUES (${b.date || null}, ${b.dayOfWeek ?? null}, ${b.startTime},
                ${b.endTime || null}, ${b.reason || null}, ${!!b.recurring})`;
      summary.blockedSlots++;
    }
    completed.push('blockedSlots');

    return NextResponse.json({ ok: true, summary, completed });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      completed,
      failedAt: completed.length === 0 ? 'init' : 'after:' + completed[completed.length - 1],
      summary,
      error: String(e),
    }, { status: 500 });
  }
}
