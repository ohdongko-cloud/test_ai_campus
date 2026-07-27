"use client";

import { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { adminFetch, AdminAuthError } from '../lib/admin-client';
import type { SsoOverviewResponse } from '../lib/sso-overview-types';

// ── 스타일 (기존 admin 컴포넌트 팔레트 그대로 사용 — 신규 디자인 시스템 도입 금지) ──
const card: React.CSSProperties = {
  background: '#fff', border: '1px solid #E5EAF1', borderRadius: 12, padding: 16,
};
const mutedText: React.CSSProperties = { fontSize: 11, color: '#9BA7BC' };
const bannerDormant: React.CSSProperties = {
  background: '#F5F7FA', border: '1px solid #E5EAF1', borderRadius: 10,
  padding: '12px 16px', color: '#3B4A63', fontSize: 13,
};
const bannerError: React.CSSProperties = {
  background: '#FCE6EA', border: '1px solid #FBCBD2', borderRadius: 8,
  padding: 10, color: '#D8364C', fontSize: 13,
};
function badgeStyle(kind: 'success' | 'muted' | 'warning' | 'info'): React.CSSProperties {
  const map: Record<typeof kind, { bg: string; fg: string }> = {
    success: { bg: '#E6F6EE', fg: '#1E9E6A' },
    muted:   { bg: '#F1F4F9', fg: '#6B7A91' },
    warning: { bg: '#FEF3C7', fg: '#92400E' },
    info:    { bg: '#E0F2FE', fg: '#1E3A8A' },
  };
  const c = map[kind];
  return {
    display: 'inline-block', padding: '2px 8px', borderRadius: 999,
    fontSize: 11, fontWeight: 600, background: c.bg, color: c.fg, whiteSpace: 'nowrap',
  };
}

const ISSUE_TOOLTIP = '발급(재인증) 기준 — 스포크 세션 유지 중 재방문은 미집계. 앱 이용량(DAU)이 아님';

function fmtTime(iso: string | null): string {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return iso; }
}

export default function AdminSso() {
  const [data, setData] = useState<SsoOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [authErr, setAuthErr] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    setAuthErr(false);
    try {
      const res = await adminFetch('/api/admin/sso/overview', { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError((json && typeof json === 'object' && 'error' in json ? (json as { error?: string }).error : null) || 'SSO 현황을 불러오지 못했습니다.');
        return;
      }
      setData(json as SsoOverviewResponse);
    } catch (e) {
      if (e instanceof AdminAuthError) setAuthErr(true);
      else setError('서버에 연결할 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 명령형 1회 로드 (콜백을 effect 의존성에 넣지 않음 — 렌더 루프 방지)
  useEffect(() => { load(); }, []);

  // 앱 합산 14일 추이 (날짜별 발급/거부 합계)
  const trendByDate = useMemo(() => {
    const map = new Map<string, { issues: number; denied: number }>();
    for (const t of data?.trend ?? []) {
      const cur = map.get(t.date) || { issues: 0, denied: 0 };
      cur.issues += t.issues;
      cur.denied += t.denied;
      map.set(t.date, cur);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ name: date.slice(5), 발급: v.issues, 거부: v.denied }));
  }, [data]);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40, color: '#9BA7BC', fontSize: 13 }}>로딩 중...</div>;
  }

  if (authErr) {
    return <div style={bannerError}>관리자 세션이 만료되었습니다. 다시 로그인해주세요.</div>;
  }

  if (error) {
    return (
      <div className="space-y-3">
        <div style={bannerError}>{error}</div>
        <button
          onClick={load}
          style={{
            padding: '7px 14px', borderRadius: 8, border: '1.5px solid #E2E8F0',
            background: '#fff', color: '#3B4A63', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (!data) return null;

  const cronStale = data.cron.staleHours !== null && data.cron.staleHours > 48;

  return (
    <div className="space-y-6">
      {!data.ssoEnabled && (
        <div style={bannerDormant}>
          SSO 미활성 상태(env 미설정) — 활성화 시점부터 기록됩니다.
        </div>
      )}

      <div style={{ ...mutedText, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>최근 90일 누적 이벤트: <strong style={{ color: '#3B4A63' }}>{data.totals.events90d.toLocaleString()}</strong>건</span>
      </div>

      {/* ── 앱별 카드 ── */}
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0F1E33', marginBottom: 10 }}>앱별 SSO 발급 현황</h3>
        {data.apps.length === 0 ? (
          <div style={{ ...card, textAlign: 'center', color: '#9BA7BC', fontSize: 13 }}>
            등록된 스포크 앱이 없습니다.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.apps.map(app => (
              <div key={app.app} style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#0F1E33' }}>{app.app}</span>
                    <span style={badgeStyle(app.enabled ? 'success' : 'muted')}>
                      {app.enabled ? '활성' : '비활성'}
                    </span>
                  </div>
                  <span
                    title={ISSUE_TOOLTIP}
                    style={{ ...mutedText, cursor: 'help', borderBottom: '1px dotted #9BA7BC' }}
                  >
                    ⓘ 발급 기준
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {([
                    ['오늘', app.today],
                    ['7일', app.last7],
                    ['30일', app.last30],
                  ] as const).map(([label, counts]) => (
                    <div key={label} style={{ background: '#F5F7FA', borderRadius: 8, padding: '8px 10px' }}>
                      <div style={mutedText}>{label}</div>
                      <div style={{ fontSize: 17, fontWeight: 700, color: '#0F1E33', marginTop: 2 }}>
                        {counts.issues}
                        <span style={{ fontSize: 11, fontWeight: 400, color: '#9BA7BC' }}> 발급</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#6B7A91', marginTop: 2 }}>
                        유니크 {counts.uniqueUsers} · 거부 {counts.denied}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #F0F3F8' }}>
                  {app.tier2 === null ? (
                    <div style={mutedText}>Tier2 미참여</div>
                  ) : (
                    <div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12, color: '#3B4A63' }}>
                        <span>자체 로그인 <strong>{app.tier2.selfLogins ?? '-'}</strong></span>
                        <span>DAU(활성 사용자) <strong>{app.tier2.activeUsers ?? '-'}</strong></span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                        <span style={mutedText}>마지막 동기: {fmtTime(app.tier2.lastReportedAt)}</span>
                        {app.tier2.staleDays !== null && app.tier2.staleDays >= 3 && (
                          <span style={badgeStyle('warning')}>{app.tier2.staleDays}일 지연</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 14일 추이 ── */}
      <div style={card}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0F1E33', marginBottom: 2 }}>14일 추이 (전체 앱 합산)</h3>
        <p style={{ ...mutedText, marginBottom: 12 }}>일자별 SSO 발급/거부 건수</p>
        {trendByDate.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#9BA7BC', fontSize: 13, padding: '24px 0' }}>
            표시할 추이 데이터가 없습니다.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={trendByDate} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend formatter={(value) => <span style={{ fontSize: 12 }}>{value}</span>} />
              <Bar dataKey="발급" fill="#2563EB" radius={[4, 4, 0, 0]} />
              <Bar dataKey="거부" fill="#D8364C" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── 최근 실패 이벤트 ── */}
      <div style={card}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0F1E33', marginBottom: 10 }}>최근 실패 이벤트 (최대 20건)</h3>
        {data.recentFailures.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#9BA7BC', fontSize: 13, padding: '16px 0' }}>
            실패 이벤트가 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F5F7FA' }}>
                  {['시각', '이벤트', '앱', 'IP'].map(h => (
                    <th key={h} style={{ padding: 8, textAlign: 'left', fontWeight: 600, color: '#3B4A63', borderBottom: '1px solid #E5EAF1' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.recentFailures.map((f, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F5F7FA' }}>
                    <td style={{ padding: 8, whiteSpace: 'nowrap', color: '#0F1E33' }}>{fmtTime(f.createdAt)}</td>
                    <td style={{ padding: 8, color: '#3B4A63' }}>{f.event}</td>
                    <td style={{ padding: 8, color: '#3B4A63' }}>{f.app}</td>
                    <td style={{ padding: 8, color: '#6B7A91', fontFamily: 'monospace' }}>{f.ip || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── cron 상태 ── */}
      <div style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#3B4A63' }}>일 배치(cron) 상태</span>
        {data.cron.lastSuccessAt === null ? (
          <span style={badgeStyle('muted')}>cron 미도입(v1.5 예정)</span>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#6B7A91' }}>마지막 성공: {fmtTime(data.cron.lastSuccessAt)}</span>
            {cronStale && <span style={badgeStyle('warning')}>{data.cron.staleHours}시간 경과</span>}
          </div>
        )}
      </div>

      <p style={mutedText}>로깅은 가용성 우선(실패 무시) — 수치는 최소치입니다.</p>
    </div>
  );
}
