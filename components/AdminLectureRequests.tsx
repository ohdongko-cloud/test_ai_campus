"use client";

// 관리자 — 강의 요청 목록.
//   - 사용자가 제출한 강의 요청을 확인하고 상태(검토중/확인완료)를 변경.
//   - 권한: 'videos' (영상 관리 권한자).

import { useEffect, useState, useCallback } from 'react';
import { LectureRequest } from '../lib/types';
import { adminFetch, AdminAuthError } from '../lib/admin-client';

type FilterStatus = 'all' | 'pending' | 'reviewed';

function formatKstDate(iso: string): string {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return iso;
  }
}

export default function AdminLectureRequests() {
  const [rows, setRows] = useState<LectureRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterStatus>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch('/api/admin/lecture-requests');
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

  const handleStatus = async (id: string, status: 'pending' | 'reviewed') => {
    // optimistic
    setRows(rs => rs.map(r => r.id === id ? { ...r, status } : r));
    try {
      const res = await adminFetch(`/api/admin/lecture-requests/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
    } catch {
      await load(); // 롤백
    }
  };

  const handleDelete = async (id: string) => {
    setRows(rs => rs.filter(r => r.id !== id));
    try {
      const res = await adminFetch(`/api/admin/lecture-requests/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
    } catch {
      await load();
    }
  };

  const filtered = rows.filter(r => filter === 'all' || r.status === filter);
  const pendingCount = rows.filter(r => r.status === 'pending').length;
  const reviewedCount = rows.filter(r => r.status === 'reviewed').length;

  const TABS: { key: FilterStatus; label: string; count: number }[] = [
    { key: 'all', label: '전체', count: rows.length },
    { key: 'pending', label: '검토중', count: pendingCount },
    { key: 'reviewed', label: '확인완료', count: reviewedCount },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-base font-semibold text-gray-800">
          강의 요청 (총 {rows.length}건)
        </h2>
        {loading && <span className="text-xs text-gray-400">불러오는 중...</span>}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 text-sm">{error}</div>
      )}

      {/* 상태 탭 */}
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
              {t.label} <span className={on ? 'text-blue-100' : 'text-gray-400'}>{t.count}</span>
            </button>
          );
        })}
      </div>

      {/* 요청 카드 목록 */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-sm text-gray-400 shadow-sm">
            {filter === 'all' ? '접수된 강의 요청이 없습니다.' : '해당 상태의 요청이 없습니다.'}
          </div>
        ) : (
          filtered.map(r => (
            <div key={r.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  {r.status === 'reviewed' ? (
                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-semibold shrink-0">확인완료</span>
                  ) : (
                    <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-xs font-semibold shrink-0">검토중</span>
                  )}
                  <h3 className="text-sm font-bold text-gray-900 truncate">{r.title}</h3>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">{formatKstDate(r.createdAt)}</span>
              </div>

              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed mb-3">{r.content}</p>

              <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-gray-100">
                <div className="text-xs text-gray-500">
                  {r.requesterName && <span className="font-medium text-gray-700">{r.requesterName}</span>}
                  {r.requesterEmail && <span className="ml-2 font-mono">{r.requesterEmail}</span>}
                  {!r.requesterName && !r.requesterEmail && <span className="text-gray-300">익명 요청</span>}
                </div>
                <div className="flex gap-2">
                  {r.status === 'pending' ? (
                    <button
                      onClick={() => handleStatus(r.id, 'reviewed')}
                      className="text-xs font-semibold px-3 py-1.5 rounded bg-green-600 text-white hover:bg-green-700 transition-colors"
                    >
                      확인완료 처리
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStatus(r.id, 'pending')}
                      className="text-xs font-medium px-3 py-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      검토중으로 되돌리기
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="text-xs font-medium px-3 py-1.5 rounded border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                  >
                    삭제
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
