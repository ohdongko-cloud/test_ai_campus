// SSO 관리자 'SSO 현황' 탭 응답 타입. 블루프린트 §4.6 / §6-M2.
// 주의: email 필드는 어떤 인터페이스에도 존재하지 않는다(타입 레벨로 PII 노출을 강제 차단).
// email 단위 조회는 기존 AdminLogs(perm:'logs') 경로로만.

export interface SsoPeriodCounts {
  issues: number;
  uniqueUsers: number;
  denied: number;
}

export interface SsoTier2Info {
  lastReportedAt: string | null;
  selfLogins: number | null;
  activeUsers: number | null;
  staleDays: number | null;
}

export interface SsoAppSummary {
  app: string;
  enabled: boolean;
  today: SsoPeriodCounts;
  last7: SsoPeriodCounts;
  last30: SsoPeriodCounts;
  tier2: SsoTier2Info | null;
}

export interface SsoTrendPoint {
  date: string;
  app: string;
  issues: number;
  denied: number;
}

// email 없음(의도) — 최근 실패 이벤트는 event·app·ip·시각만 노출.
export interface SsoRecentFailure {
  event: string;
  app: string;
  ip: string | null;
  createdAt: string;
}

export interface SsoOverviewResponse {
  ssoEnabled: boolean;
  apps: SsoAppSummary[];
  trend: SsoTrendPoint[];
  recentFailures: SsoRecentFailure[];
  cron: { lastSuccessAt: string | null; staleHours: number | null };
  totals: { events90d: number };
}
