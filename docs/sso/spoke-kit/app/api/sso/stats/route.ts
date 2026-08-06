// === ELAND SSO SPOKE KIT v2.0.0 (contract v2) — DO NOT EDIT ===
// 원본: retail_ai_campus repo docs/sso/spoke-kit/ — 수정은 허브 레포에서만. 스포크는 복사만.
// 유일한 수정 허용: import 경로 별칭(@/*)이 없는 레포의 import 줄.
// 앱별 커스터마이징은 lib/sso-adapter.ts 에서만.
//
// GET /api/sso/stats?days=1~31 — 일별 통계 제공 (Tier 2, 계약 v2 §9, 선택 참여).
// 인증: 허브가 서명한 RS256 요청 토큰(Bearer) — 코어 verifyStatsRequest가
// scope==='stats:read' && sub==='sso-hub'까지 확인한다. JWKS를 재사용하므로
// 이 라우트 전용 정적 시크릿은 0개다(허브 설계도 §6-B2 확정 — SSO_STATS_SECRET류 폐기).
//
// ⚠ 허브 사실(2026-08-06, retail_ai_campus 코드 확인 — hubFacts): 허브에는 아직
// scope='stats:read'·sub='sso-hub'로 RS256 요청 토큰을 실제로 발급하는 코드가 없다
// (app/api/cron/ 디렉터리에는 cleanup-test-account만 존재하고, 'stats:read'·'sso-hub'
// 문자열이 어떤 발급 코드에도 등장하지 않는다). 즉 v1.5 cron(`/api/cron/sso-daily`) 도입
// 전까지 이 라우트는 정상 호출을 받지 않는다 — 미착수는 의도적 보류다. 그와 무관하게
// verifyStatsRequest는 항상 검증을 수행하므로(어떤 Bearer가 오든 fail-closed 401) 이
// 라우트 자체의 안전성에는 영향이 없다. 이 사실이 갱신되면(cron 착수) 이 주석도 갱신한다.
//
// 응답은 **집계값만** 포함한다 — email 등 PII는 절대 반환하지 않는다(허브 설계 원칙:
// PII는 원 소유 서비스 밖으로 나가지 않는다). adapter.getDailyStats 미구현이면 404로
// 존재 자체를 숨긴다(opt-in — 참여하지 않는 스포크의 엔드포인트 유무를 외부에 알리지 않음).
// 이 라우트는 허브 cron이 하루 1회 호출하는 저빈도 엔드포인트라 별도 IP 레이트리밋을
// 두지 않는다(fail-closed RS256 검증이 1차 방어선).
import { NextRequest, NextResponse } from 'next/server';
import {
  verifyStatsRequest,
  getSsoConfig,
  SSO_KIT_VERSION,
  SSO_CONTRACT_VERSION,
  type SsoDailyStat,
} from '@/lib/sso-spoke';
import { ssoAdapter } from '@/lib/sso-adapter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function noStore(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    return noStore({ error: 'unauthorized' }, 401);
  }
  const token = m[1].trim();

  try {
    await verifyStatsRequest(token);
  } catch {
    // 서명/iss/aud 불일치·만료·scope 또는 sub 불일치 등 원인 불문 401 —
    // 계약 §2.1과 동일한 "모든 실패=동일 대응" 원칙(재시도하지 않는다).
    // 이 라우트는 허브 cron 전용이라 스포크 쪽에서 별도 폴백을 둘 필요가 없다.
    return noStore({ error: 'unauthorized' }, 401);
  }

  // opt-in: 어댑터가 getDailyStats를 구현하지 않았으면 존재 자체를 숨긴다.
  if (typeof ssoAdapter.getDailyStats !== 'function') {
    return noStore({ error: 'not found' }, 404);
  }

  const url = new URL(req.url);
  const daysParam = url.searchParams.get('days');
  let days = 7;
  if (daysParam !== null) {
    const parsed = Number(daysParam);
    days = Number.isFinite(parsed) ? Math.min(31, Math.max(1, Math.trunc(parsed))) : 7;
  }

  let stats: SsoDailyStat[];
  try {
    stats = await ssoAdapter.getDailyStats(days);
  } catch {
    return noStore({ error: '서버 오류가 발생했습니다.' }, 500);
  }

  const cfg = getSsoConfig();
  return noStore(
    {
      app: cfg.appId,
      kitVersion: SSO_KIT_VERSION,
      contractVersion: SSO_CONTRACT_VERSION,
      statsImplemented: true,
      days,
      stats,
    },
    200,
  );
}
