"use client";

// 관리자 — 레벨 테스트 검증내역.
//   - 사용자가 응시한 레벨 테스트 결과/답변 조회. 권한: 'members'.

import { useEffect, useState, useCallback, Fragment } from 'react';
import { adminFetch, AdminAuthError } from '../lib/admin-client';

interface Row {
  id: string;
  email: string | null;
  level: string;
  answers: Record<string, string>;
  securityFlag: boolean;
  createdAt: string;
}

type LevelFilter = 'all' | '새싹' | '초급' | '중급' | '고급';

const CAP_Q: Record<string, string> = {
  C1: 'AI 사례·PRD 인지', C2: '클로드/코덱스 구현', C3: '배포+DB',
  C4: '로그·봇차단·SMTP·SNS', C5: '앱/AI에이전트 제작', C6: '업무 완전 자동화',
};
const VER_Q: Record<string, string> = {
  V1: 'DB 마이그레이션', V2: '환경변수 세팅', V3: '.env 푸시 가능? (정답:아니오)',
};
// 모든 답변 통일: 예 / 아니오 / 모름
const A_LABEL: Record<string, string> = { yes: '예', no: '아니오', unknown: '모름' };

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  } catch { return iso; }
}

const LEVEL_BADGE: Record<string, { bg: string; fg: string }> = {
  '새싹': { bg: '#E6F6EE', fg: '#1E9E6A' },
  '초급': { bg: '#E6EEF7', fg: '#004A99' },
  '중급': { bg: '#FFF1E6', fg: '#E67835' },
  '고급': { bg: '#F0E6F7', fg: '#6940C9' },
};

export default function AdminLevelTests() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<LevelFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch('/api/admin/level-tests');
      if (!res.ok) throw new Error('목록을 불러오지 못했습니다.');
      setRows(await res.json());
    } catch (e) {
      if (e instanceof AdminAuthError) setError('관리자 세션이 만료되었습니다. 다시 로그인해주세요.');
      else setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = {
    all: rows.length,
    '새싹': rows.filter(r => r.level === '새싹').length,
    '초급': rows.filter(r => r.level === '초급').length,
    '중급': rows.filter(r => r.level === '중급').length,
    '고급': rows.filter(r => r.level === '고급').length,
  };
  const securityCount = rows.filter(r => r.securityFlag).length;
  const filtered = rows.filter(r => filter === 'all' || r.level === filter);

  const TABS: { key: LevelFilter; label: string }[] = [
    { key: 'all', label: '전체' },
    { key: '새싹', label: '새싹' },
    { key: '초급', label: '초급' },
    { key: '중급', label: '중급' },
    { key: '고급', label: '고급' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-base font-semibold text-gray-800">
          레벨 테스트 검증내역 (총 {rows.length}건)
          {securityCount > 0 && (
            <span className="ml-2 text-xs font-medium text-red-600">· 보안 주의 {securityCount}명</span>
          )}
        </h2>
        {loading && <span className="text-xs text-gray-400">불러오는 중...</span>}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 text-sm">{error}</div>
      )}

      {/* 레벨 탭 */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => {
          const on = filter === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                on ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {t.label} <span className={on ? 'text-blue-100' : 'text-gray-400'}>{counts[t.key]}</span>
            </button>
          );
        })}
      </div>

      {/* 목록 */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 640 }}>
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">이메일</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">판정 레벨</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">보안</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">응시일</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">답변</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-sm text-gray-400">검증내역이 없습니다.</td></tr>
              ) : filtered.map(r => {
                const b = LEVEL_BADGE[r.level] || { bg: '#F3F4F6', fg: '#374151' };
                const open = expandedId === r.id;
                return (
                  <Fragment key={r.id}>
                    <tr className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2 text-xs text-gray-800 font-mono">{r.email || '익명'}</td>
                      <td className="px-3 py-2">
                        <span style={{ background: b.bg, color: b.fg, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{r.level}</span>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {r.securityFlag
                          ? <span className="text-red-600 font-semibold">⚠ 주의</span>
                          : <span className="text-gray-300">–</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">{fmtDate(r.createdAt)}</td>
                      <td className="px-3 py-2 text-xs">
                        <button onClick={() => setExpandedId(open ? null : r.id)} className="text-blue-600 hover:underline">
                          {open ? '접기' : '보기'}
                        </button>
                      </td>
                    </tr>
                    {open && (
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <td colSpan={5} className="px-4 py-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1.5 text-xs">
                            {Object.entries(CAP_Q).map(([k, q]) => (
                              <div key={k} className="flex justify-between gap-3">
                                <span className="text-gray-500">{q}</span>
                                <span className="text-gray-800 font-medium whitespace-nowrap">{A_LABEL[r.answers?.[k]] || '–'}</span>
                              </div>
                            ))}
                            {Object.entries(VER_Q).map(([k, q]) => (
                              <div key={k} className="flex justify-between gap-3">
                                <span className="text-gray-500">{q}</span>
                                <span className={`font-medium whitespace-nowrap ${k === 'V3' && r.answers?.[k] === 'yes' ? 'text-red-600' : 'text-gray-800'}`}>
                                  {A_LABEL[r.answers?.[k]] || '–'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
