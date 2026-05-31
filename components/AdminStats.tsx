"use client";

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { getVideos, getReservations, getServices, aggregateClickLog, getClickLogInRange } from '../lib/utils';
import { Video, ClickLog } from '../lib/types';

const PIE_COLORS: Record<string, string> = {
  '기초': '#22C55E', '중급': '#2563EB', '고급': '#F97316', '응용': '#6B7280',
};

const BUTTON_KEYS = ['강의영상', '게시판', '미팅요청', '오픈채팅방', '서비스공유'] as const;
type ButtonKey = typeof BUTTON_KEYS[number];

const BUTTON_LABELS: Record<ButtonKey, string> = {
  강의영상: '강의 영상',
  게시판: '게시판',
  미팅요청: '미팅 요청',
  오픈채팅방: '오픈채팅방',
  서비스공유: '서비스 공유',
};

function today(): string { return new Date().toISOString().slice(0, 10); }
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

type VisitorPeriod = 'today' | '7d' | '30d';

interface OverviewStats {
  totalMembers: number;
  todaySignups: number;
  visitorsToday: number;
  visitors7d: number;
  visitors30d: number;
}

export default function AdminStats() {
  const [copied, setCopied] = useState(false);
  const [videos, setVideos] = useState<Video[]>([]);
  const [reservationCount, setReservationCount] = useState(0);
  const [serviceCount, setServiceCount] = useState(0);
  const [levelData, setLevelData] = useState<{ name: string; value: number }[]>([]);
  // ── 회원/방문자 통계 ──
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [visitorPeriod, setVisitorPeriod] = useState<VisitorPeriod>('today');
  const [overviewError, setOverviewError] = useState<string | null>(null);

  // 날짜 범위 필터
  const [startDate, setStartDate] = useState(daysAgo(29));
  const [endDate, setEndDate] = useState(today());

  // 버튼 타입 필터 (선택된 것만 표시)
  const [selectedButtons, setSelectedButtons] = useState<Set<ButtonKey>>(new Set(BUTTON_KEYS));

  // 필터된 클릭 집계
  const [clickData, setClickData] = useState<{ name: string; value: number }[]>([]);
  const [totalClicks, setTotalClicks] = useState(0);
  const [perDayData, setPerDayData] = useState<{ name: string; value: number }[]>([]);

  const computeClickStats = useCallback((start: string, end: string, buttons: Set<ButtonKey>) => {
    const logs: ClickLog[] = getClickLogInRange(start, end);

    // 버튼별 집계
    const clickMap: Record<string, number> = {};
    BUTTON_KEYS.forEach(k => { clickMap[k] = 0; });
    logs.forEach(log => { if (clickMap[log.button] !== undefined) clickMap[log.button]++; });

    const filtered = BUTTON_KEYS
      .filter(k => buttons.has(k))
      .map(k => ({ name: BUTTON_LABELS[k], value: clickMap[k] }));
    setClickData(filtered);
    setTotalClicks(filtered.reduce((s, c) => s + c.value, 0));

    // 날짜별 집계 (선택된 버튼 기준)
    const dayMap: Record<string, number> = {};
    logs.forEach(log => {
      if (buttons.has(log.button as ButtonKey)) {
        const d = log.timestamp.slice(0, 10);
        dayMap[d] = (dayMap[d] || 0) + 1;
      }
    });
    const sorted = Object.entries(dayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, value]) => ({ name: name.slice(5), value })); // MM-DD
    setPerDayData(sorted);
  }, []);

  const load = useCallback(() => {
    const vids = getVideos();
    const res = getReservations();
    const svc = getServices();

    setVideos(vids);
    setReservationCount(res.length);
    setServiceCount(svc.length);

    const levelMap: Record<string, number> = { '기초': 0, '중급': 0, '고급': 0, '응용': 0 };
    vids.forEach(v => { if (levelMap[v.level] !== undefined) levelMap[v.level]++; });
    setLevelData(Object.entries(levelMap).map(([name, value]) => ({ name, value })));

    computeClickStats(startDate, endDate, selectedButtons);

    // 회원/방문자 통계 (서버 SQL 집계) — 캐시 우회로 항상 최신
    fetch(`/api/admin/stats/overview?_=${Date.now()}`, {
      credentials: 'include', cache: 'no-store',
    })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((d: OverviewStats) => { setOverview(d); setOverviewError(null); })
      .catch(err => {
        if (err === 401 || err === 403) setOverviewError('회원 통계 권한이 없습니다.');
        else setOverviewError('회원 통계를 불러오지 못했습니다.');
        setOverview(null);
      });
  }, [startDate, endDate, selectedButtons, computeClickStats]);

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [load]);

  // 날짜/버튼 필터 변경 시 클릭 통계 재계산
  useEffect(() => {
    computeClickStats(startDate, endDate, selectedButtons);
  }, [startDate, endDate, selectedButtons, computeClickStats]);

  const sortedVideos = [...videos].sort((a, b) => b.viewCount - a.viewCount).slice(0, 10);
  const topVideo = sortedVideos[0];

  const toggleButton = (k: ButtonKey) => {
    setSelectedButtons(prev => {
      const next = new Set(prev);
      if (next.has(k)) { if (next.size > 1) next.delete(k); }
      else next.add(k);
      return next;
    });
  };

  const setQuickRange = (days: number | null) => {
    if (days === null) {
      setStartDate('2020-01-01');
      setEndDate(today());
    } else {
      setStartDate(daysAgo(days - 1));
      setEndDate(today());
    }
  };

  const handleCopyReport = () => {
    const clicks = aggregateClickLog();
    const levelMap: Record<string, number> = { '기초': 0, '중급': 0, '고급': 0, '응용': 0 };
    videos.forEach(v => { if (levelMap[v.level] !== undefined) levelMap[v.level]++; });

    const text = `[이랜드리테일 AI 캠퍼스 운영 현황 보고]
기준일: ${today()}

■ 전체 미팅 예약 건수: ${reservationCount}건
■ 등록 교육 영상 수: ${videos.length}개 (기초 ${levelMap['기초']} / 중급 ${levelMap['중급']} / 고급 ${levelMap['고급']} / 응용 ${levelMap['응용']})
■ 가장 많이 시청된 영상: ${topVideo ? `${topVideo.title} (${topVideo.viewCount}회)` : '없음'}
■ 공유된 AI 서비스 수: ${serviceCount}개
■ 버튼별 클릭 현황 (전체):
  - 강의 영상: ${clicks['강의영상'] || 0}회
  - 게시판: ${clicks['게시판'] || 0}회
  - 미팅 요청: ${clicks['미팅요청'] || 0}회
  - 오픈채팅방: ${clicks['오픈채팅방'] || 0}회
  - 서비스 공유: ${clicks['서비스공유'] || 0}회`;

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  };

  const SUMMARY_CARDS = [
    { label: '전체 미팅 예약', value: reservationCount, unit: '건' },
    { label: '등록 영상 수', value: videos.length, unit: '개' },
    { label: '공유 서비스 수', value: serviceCount, unit: '개' },
    { label: `기간 내 클릭수 (${startDate.slice(5)} ~ ${endDate.slice(5)})`, value: totalClicks, unit: '회' },
  ];

  return (
    <div className="space-y-8">
      {copied && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded p-3 text-sm">
          보고서가 복사되었습니다.
        </div>
      )}

      {/* ── 회원 / 방문자 통계 (신규) ── */}
      {overviewError && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded p-3 text-sm">
          {overviewError}
        </div>
      )}
      {overview && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <p className="text-sm text-gray-500 mb-2">총 가입자</p>
            <p className="text-3xl font-bold text-gray-900">
              {overview.totalMembers}
              <span className="text-base font-normal text-gray-500 ml-1">명</span>
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <p className="text-sm text-gray-500 mb-2">오늘 가입</p>
            <p className="text-3xl font-bold text-gray-900">
              {overview.todaySignups}
              <span className="text-base font-normal text-gray-500 ml-1">명</span>
              <span className="text-xs font-normal text-gray-400 ml-2">(KST)</span>
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-500">방문자 (로그인 기준)</p>
              <div className="flex gap-1">
                {([
                  { k: 'today' as const, label: '오늘' },
                  { k: '7d'    as const, label: '7일'  },
                  { k: '30d'   as const, label: '30일' },
                ]).map(p => {
                  const active = visitorPeriod === p.k;
                  return (
                    <button
                      key={p.k}
                      onClick={() => setVisitorPeriod(p.k)}
                      className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                        active
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {visitorPeriod === 'today' && overview.visitorsToday}
              {visitorPeriod === '7d'    && overview.visitors7d}
              {visitorPeriod === '30d'   && overview.visitors30d}
              <span className="text-base font-normal text-gray-500 ml-1">명</span>
            </p>
          </div>
        </div>
      )}

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 gap-4">
        {SUMMARY_CARDS.map(c => (
          <div key={c.label} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <p className="text-sm text-gray-500 mb-2">{c.label}</p>
            <p className="text-3xl font-bold text-gray-900">
              {c.value}<span className="text-base font-normal text-gray-500 ml-1">{c.unit}</span>
            </p>
          </div>
        ))}
      </div>

      {/* ── 날짜 범위 & 버튼 타입 필터 ── */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm space-y-4">
        <h3 className="text-base font-semibold text-gray-800">클릭 통계 필터</h3>

        {/* 날짜 범위 */}
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">시작일</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">종료일</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none"
            />
          </div>
          <div className="flex gap-1.5">
            {[
              { label: '오늘', days: 1 },
              { label: '7일', days: 7 },
              { label: '30일', days: 30 },
              { label: '전체', days: null },
            ].map(q => (
              <button
                key={q.label}
                onClick={() => setQuickRange(q.days)}
                className="px-3 py-1.5 rounded text-xs font-medium border border-gray-300 bg-white hover:bg-gray-50 transition-colors"
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>

        {/* 버튼 타입 필터 */}
        <div>
          <p className="text-xs text-gray-500 mb-2">표시할 버튼</p>
          <div className="flex flex-wrap gap-2">
            {BUTTON_KEYS.map(k => {
              const on = selectedButtons.has(k);
              return (
                <button
                  key={k}
                  onClick={() => toggleButton(k)}
                  className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${
                    on ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-300'
                  }`}
                >
                  {BUTTON_LABELS[k]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 차트 row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 버튼별 클릭수 */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h3 className="text-base font-semibold text-gray-800 mb-1">버튼별 클릭수</h3>
          <p className="text-xs text-gray-400 mb-4">{startDate} ~ {endDate}</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={clickData} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#2563EB" radius={[4, 4, 0, 0]} label={{ position: 'top', fontSize: 11 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 레벨별 영상 수 파이 차트 */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h3 className="text-base font-semibold text-gray-800 mb-4">레벨별 영상 수</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={levelData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                {levelData.map((entry, i) => (
                  <Cell key={i} fill={PIE_COLORS[entry.name] || '#ccc'} />
                ))}
              </Pie>
              <Legend formatter={(value) => <span style={{ fontSize: 12 }}>{value}</span>} />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 날짜별 클릭 추이 */}
      {perDayData.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h3 className="text-base font-semibold text-gray-800 mb-1">날짜별 클릭 추이</h3>
          <p className="text-xs text-gray-400 mb-4">{startDate} ~ {endDate} (선택된 버튼 합산)</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={perDayData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#6366F1" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 영상별 조회수 순위 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <h3 className="text-base font-semibold text-gray-800 mb-4">영상별 조회수 순위</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50">
                {['순위', '영상 제목', '레벨', '조회수'].map(col => (
                  <th key={col} className="border border-gray-200 px-4 py-2 text-left text-xs text-gray-600 font-semibold">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedVideos.length === 0 ? (
                <tr>
                  <td colSpan={4} className="border border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
                    등록된 영상이 없습니다.
                  </td>
                </tr>
              ) : (
                sortedVideos.map((v, i) => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="border border-gray-200 px-4 py-2 text-sm text-gray-900 font-medium">{i + 1}</td>
                    <td className="border border-gray-200 px-4 py-2 text-sm text-gray-800">{v.title}</td>
                    <td className="border border-gray-200 px-4 py-2 text-xs text-gray-600">{v.level}</td>
                    <td className="border border-gray-200 px-4 py-2 text-sm text-gray-900">{v.viewCount}회</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <button
        onClick={handleCopyReport}
        className="bg-black text-white px-5 py-2 rounded text-sm font-medium hover:bg-gray-800 transition-colors"
      >
        보고서 복사
      </button>
    </div>
  );
}
