// GET /api/admin/sso/overview — 관리자 'SSO 현황' 탭 데이터. 블루프린트 §4.6.
// requireMaster(v1 masterOnly, §4.6). PII 없음(email 필드가 없는 타입으로 강제, §4.4/§6-M2).
import { NextRequest, NextResponse, after } from 'next/server';
import { sql } from '../../../../../lib/db';
import { requireMaster, isDenied } from '../../../../../lib/admin-auth';
import { reportError } from '../../../../../lib/error-report';
import type {
  SsoOverviewResponse,
  SsoAppSummary,
  SsoPeriodCounts,
  SsoTier2Info,
  SsoTrendPoint,
  SsoRecentFailure,
} from '../../../../../lib/sso-overview-types';

export const dynamic = 'force-dynamic';

// "거부" = 인증 거부 3종 + 레이트리밋(요청이 차단됐다는 점에서 동일 범주로 취급).
const DENIED_EVENTS = ['deny_unknown_app', 'deny_redirect_mismatch', 'deny_state_missing', 'rate_limited'];
// 최근 실패 이벤트 목록에도 동일 범주 + 예약형 login_required(현재 미기록이지만 향후 대비 포함).
const FAILURE_EVENTS = [...DENIED_EVENTS, 'login_required'];

const EMPTY_PERIOD: SsoPeriodCounts = { issues: 0, uniqueUsers: 0, denied: 0 };

function noStore(body: SsoOverviewResponse, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

function toIso(v: unknown): string | null {
  if (!v) return null;
  const d = new Date(v as string);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

interface PeriodRow { app: string; issues: number; unique_users: number; denied: number }

function toPeriodMap(rows: PeriodRow[]): Map<string, SsoPeriodCounts> {
  const map = new Map<string, SsoPeriodCounts>();
  for (const r of rows) {
    map.set(String(r.app), {
      issues: Number(r.issues) || 0,
      uniqueUsers: Number(r.unique_users) || 0,
      denied: Number(r.denied) || 0,
    });
  }
  return map;
}

export async function GET(req: NextRequest) {
  const auth = await requireMaster(req);
  if (isDenied(auth)) return auth;

  // 휴면 배포 판정(env 존재 여부) — SSO_ISSUER는 폴백이 있어 제외.
  const ssoEnabled = !!(
    process.env.SSO_PRIVATE_KEY && process.env.SSO_PUBLIC_KEY && process.env.SSO_KID
  );

  try {
    // M013(sso_events/sso_daily_stats) 미적용 환경 graceful degrade — 마이그레이션 전에도 탭이 깨지지 않도록.
    const tableCheck = await sql`SELECT to_regclass('public.sso_events') AS reg`;
    if (!tableCheck[0]?.reg) {
      return noStore({
        ssoEnabled,
        apps: [],
        trend: [],
        recentFailures: [],
        cron: { lastSuccessAt: null, staleHours: null },
        totals: { events90d: 0 },
      });
    }

    const [
      clientRows,
      todayRows,
      last7Rows,
      last30Rows,
      trendRows,
      failureRows,
      tier2Rows,
      totalRows,
    ] = await Promise.all([
      sql`SELECT app, enabled, stats_url FROM sso_clients ORDER BY app`,
      sql`
        SELECT app,
          COUNT(*) FILTER (WHERE event = 'issue')::int AS issues,
          COUNT(DISTINCT email) FILTER (WHERE event = 'issue')::int AS unique_users,
          COUNT(*) FILTER (WHERE event = ANY(${DENIED_EVENTS}::text[]))::int AS denied
        FROM sso_events
        WHERE created_at AT TIME ZONE 'Asia/Seoul'
          >= date_trunc('day', NOW() AT TIME ZONE 'Asia/Seoul')
        GROUP BY app`,
      sql`
        SELECT app,
          COUNT(*) FILTER (WHERE event = 'issue')::int AS issues,
          COUNT(DISTINCT email) FILTER (WHERE event = 'issue')::int AS unique_users,
          COUNT(*) FILTER (WHERE event = ANY(${DENIED_EVENTS}::text[]))::int AS denied
        FROM sso_events
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY app`,
      sql`
        SELECT app,
          COUNT(*) FILTER (WHERE event = 'issue')::int AS issues,
          COUNT(DISTINCT email) FILTER (WHERE event = 'issue')::int AS unique_users,
          COUNT(*) FILTER (WHERE event = ANY(${DENIED_EVENTS}::text[]))::int AS denied
        FROM sso_events
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY app`,
      sql`
        SELECT to_char(created_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS date, app,
          COUNT(*) FILTER (WHERE event = 'issue')::int AS issues,
          COUNT(*) FILTER (WHERE event = ANY(${DENIED_EVENTS}::text[]))::int AS denied
        FROM sso_events
        WHERE created_at >= NOW() - INTERVAL '14 days'
        GROUP BY date, app
        ORDER BY date ASC`,
      sql`
        SELECT event, app, ip, created_at
        FROM sso_events
        WHERE event = ANY(${FAILURE_EVENTS}::text[])
        ORDER BY created_at DESC
        LIMIT 20`,
      sql`
        SELECT DISTINCT ON (app) app, reported_at, self_logins, active_users
        FROM sso_daily_stats
        WHERE source = 'spoke'
        ORDER BY app, stat_date DESC`,
      sql`
        SELECT COUNT(*)::int AS n FROM sso_events
        WHERE created_at >= NOW() - INTERVAL '90 days'`,
    ]);

    const todayMap = toPeriodMap(todayRows as PeriodRow[]);
    const last7Map = toPeriodMap(last7Rows as PeriodRow[]);
    const last30Map = toPeriodMap(last30Rows as PeriodRow[]);

    const tier2Map = new Map<string, { reported_at: unknown; self_logins: number | null; active_users: number | null }>();
    for (const r of tier2Rows as Array<{ app: string; reported_at: unknown; self_logins: number | null; active_users: number | null }>) {
      tier2Map.set(String(r.app), r);
    }

    // apps는 sso_clients 등록 앱 기준(§4.6 카드 목적 — 리다이렉트 URI·enabled·Tier2 설정을 가진 "관리 대상").
    // 미등록 app 문자열(공격 시도 등)로 카드를 스팸하지 않기 위해 등록 앱만 카드화하고,
    // 그 가시성은 recentFailures(등록 여부 무관 전체)로 별도 보장한다 — 판단 근거는 PR 설명 참조.
    const apps: SsoAppSummary[] = (clientRows as Array<{ app: string; enabled: boolean; stats_url: string | null }>).map((c) => {
      const app = String(c.app);
      let tier2: SsoTier2Info | null = null;
      if (c.stats_url) {
        const t2 = tier2Map.get(app);
        const lastReportedAt = toIso(t2?.reported_at);
        const staleDays = lastReportedAt
          ? Math.floor((Date.now() - new Date(lastReportedAt).getTime()) / 86_400_000)
          : null;
        tier2 = {
          lastReportedAt,
          selfLogins: t2?.self_logins ?? null,
          activeUsers: t2?.active_users ?? null,
          staleDays,
        };
      }
      return {
        app,
        enabled: c.enabled !== false,
        today: todayMap.get(app) ?? EMPTY_PERIOD,
        last7: last7Map.get(app) ?? EMPTY_PERIOD,
        last30: last30Map.get(app) ?? EMPTY_PERIOD,
        tier2,
      };
    });

    const trend: SsoTrendPoint[] = (trendRows as Array<{ date: string; app: string; issues: number; denied: number }>).map((r) => ({
      date: String(r.date),
      app: String(r.app),
      issues: Number(r.issues) || 0,
      denied: Number(r.denied) || 0,
    }));

    const recentFailures: SsoRecentFailure[] = (failureRows as Array<{ event: string; app: string; ip: string | null; created_at: unknown }>).map((r) => ({
      event: String(r.event),
      app: String(r.app),
      ip: r.ip ?? null,
      createdAt: toIso(r.created_at) ?? new Date(0).toISOString(),
    }));

    const events90d = Number((totalRows as Array<{ n: number }>)[0]?.n) || 0;

    // §4.5 lazy 보존 정리: v1은 cron 미도입이라 overview 로드 시 90일 초과 sso_events를 best-effort로 정리.
    // 응답을 지연시키지 않도록 next/server의 after()로 응답 전송 후 실행(§4.5 — 실패는 삼킴, 멱등 DELETE라
    // 도중에 함수가 종료돼도 다음 방문에서 이어서 정리되므로 안전). 근거는 PR 설명 참조.
    after(async () => {
      try {
        await sql`DELETE FROM sso_events WHERE created_at < NOW() - INTERVAL '90 days'`;
      } catch (e) {
        reportError(e, { route: 'admin/sso/overview.lazyCleanup' });
      }
    });

    return noStore({
      ssoEnabled,
      apps,
      trend,
      recentFailures,
      cron: { lastSuccessAt: null, staleHours: null }, // v1은 cron 미도입(§4.3) — null 허용.
      totals: { events90d },
    });
  } catch (e) {
    reportError(e, { route: 'admin/sso/overview' });
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
