"use client";

// 관리자 — 회원 목록 표.
//   - 검색 (이메일/닉네임 부분일치)
//   - 필터: 법인 / 조직 / 역할 (master / admin / user)
//   - 정렬: 가입일 / 이메일 / 닉네임 (컬럼 헤더 클릭)
//   - 페이지네이션 (50/page)
//
// 권한: 'members' (master/legacy 자동 통과).

import { useEffect, useState, useCallback } from 'react';

interface MemberRow {
  id: string;
  email: string;
  nickname: string;
  corporationName: string;
  organizationName: string;
  position: string;
  role: string;
  isMaster: boolean;
  createdAt: string;
}

interface MembersResponse {
  total: number;
  rows: MemberRow[];
  facets: { corporations: string[]; organizations: string[] };
}

type SortKey = 'created_at' | 'email' | 'name';
type SortOrder = 'asc' | 'desc';

const PAGE_SIZE = 50;

function formatKstDate(iso: string): string {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return iso;
  }
}

function roleLabel(r: MemberRow): { label: string; bg: string; fg: string } {
  if (r.isMaster) return { label: '마스터', bg: '#FEF3C7', fg: '#92400E' };
  if (r.role === 'admin') return { label: '관리자', bg: '#E0F2FE', fg: '#1E3A8A' };
  return { label: '회원', bg: '#F3F4F6', fg: '#374151' };
}

// 삭제 확인 모달
function DeleteConfirmModal({
  member,
  onConfirm,
  onCancel,
  deleting,
}: {
  member: MemberRow;
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(15,30,51,0.45)' }}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
        <h3 className="text-base font-bold text-gray-900 mb-1">회원 삭제</h3>
        <p className="text-xs text-gray-500 mb-4">이 작업은 되돌릴 수 없습니다.</p>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4 text-xs space-y-1">
          <div><span className="text-gray-400 w-14 inline-block">이메일</span>
            <span className="font-mono text-gray-800">{member.email}</span></div>
          <div><span className="text-gray-400 w-14 inline-block">닉네임</span>
            <span className="text-gray-800">{member.nickname || '-'}</span></div>
          <div><span className="text-gray-400 w-14 inline-block">조직</span>
            <span className="text-gray-800">{member.organizationName || '-'}</span></div>
        </div>

        <p className="text-xs text-red-600 mb-5">
          회원 정보, 인증 이력, 예약 기록이 모두 삭제됩니다.
        </p>

        <div className="flex gap-2">
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: '#DC2626' }}
          >
            {deleting ? '삭제 중…' : '삭제 확인'}
          </button>
          <button
            onClick={onCancel}
            disabled={deleting}
            className="flex-1 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminMembers() {
  const [data, setData] = useState<MembersResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 삭제 모달 상태
  const [deleteTarget, setDeleteTarget] = useState<MemberRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // 필터/검색/정렬/페이지
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState(''); // 디바운스용
  const [corp, setCorp] = useState('');
  const [org, setOrg] = useState('');
  const [role, setRole] = useState('');
  const [sort, setSort] = useState<SortKey>('created_at');
  const [order, setOrder] = useState<SortOrder>('desc');
  const [page, setPage] = useState(0); // 0-indexed

  // 검색 입력 디바운스 (300ms)
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0); // 검색어 바뀌면 첫 페이지로
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (corp) params.set('corp', corp);
    if (org) params.set('org', org);
    if (role) params.set('role', role);
    params.set('sort', sort);
    params.set('order', order);
    params.set('limit', String(PAGE_SIZE));
    params.set('offset', String(page * PAGE_SIZE));

    fetch(`/api/admin/members?${params.toString()}&_=${Date.now()}`, {
      credentials: 'include',
      cache: 'no-store',
    })
      .then(async r => {
        if (!r.ok) {
          if (r.status === 401 || r.status === 403) {
            throw new Error('회원 정보 조회 권한이 없습니다.');
          }
          throw new Error('회원 목록을 불러오지 못했습니다.');
        }
        return r.json();
      })
      .then((d: MembersResponse) => setData(d))
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [search, corp, org, role, sort, order, page]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/members/${deleteTarget.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || '삭제에 실패했습니다.');
      }
      setDeleteTarget(null);
      load(); // 목록 새로고침
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleting(false);
    }
  };

  const handleSort = (key: SortKey) => {
    if (sort === key) {
      setOrder(o => o === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(key);
      setOrder(key === 'created_at' ? 'desc' : 'asc');
    }
    setPage(0);
  };

  const sortIndicator = (key: SortKey) => {
    if (sort !== key) return ' ↕';
    return order === 'asc' ? ' ↑' : ' ↓';
  };

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showingFrom = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const showingTo = Math.min(total, (page + 1) * PAGE_SIZE);

  return (
    <>
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-base font-semibold text-gray-800">
          회원 관리 (총 {total}명)
        </h2>
        {loading && <span className="text-xs text-gray-400">불러오는 중...</span>}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 text-sm">
          {error}
        </div>
      )}

      {/* 필터 바 */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm flex flex-wrap gap-2 items-center">
        <input
          type="text"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="🔍 이메일 또는 닉네임"
          className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500 flex-1 min-w-[200px]"
        />
        <select
          value={corp}
          onChange={e => { setCorp(e.target.value); setPage(0); }}
          className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none"
        >
          <option value="">법인 (전체)</option>
          {data?.facets.corporations.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={org}
          onChange={e => { setOrg(e.target.value); setPage(0); }}
          className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none"
        >
          <option value="">조직 (전체)</option>
          {data?.facets.organizations.map(o => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        <select
          value={role}
          onChange={e => { setRole(e.target.value); setPage(0); }}
          className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none"
        >
          <option value="">역할 (전체)</option>
          <option value="master">마스터</option>
          <option value="admin">관리자</option>
          <option value="user">회원</option>
        </select>
        {(search || corp || org || role) && (
          <button
            onClick={() => {
              setSearchInput(''); setSearch(''); setCorp(''); setOrg(''); setRole(''); setPage(0);
            }}
            className="text-xs text-gray-500 hover:text-gray-800 underline"
          >
            필터 초기화
          </button>
        )}
      </div>

      {/* 표 */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 800 }}>
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th
                  onClick={() => handleSort('email')}
                  className="px-3 py-2 text-left text-xs font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 select-none"
                >
                  이메일{sortIndicator('email')}
                </th>
                <th
                  onClick={() => handleSort('name')}
                  className="px-3 py-2 text-left text-xs font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 select-none"
                >
                  닉네임{sortIndicator('name')}
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">법인</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">조직</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">직무</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">역할</th>
                <th
                  onClick={() => handleSort('created_at')}
                  className="px-3 py-2 text-left text-xs font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 select-none"
                >
                  가입일{sortIndicator('created_at')}
                </th>
                <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600">삭제</th>
              </tr>
            </thead>
            <tbody>
              {data && data.rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-sm text-gray-400">
                    조건에 맞는 회원이 없습니다.
                  </td>
                </tr>
              )}
              {data?.rows.map(r => {
                const rl = roleLabel(r);
                return (
                  <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 text-xs text-gray-800 font-mono">{r.email}</td>
                    <td className="px-3 py-2 text-xs text-gray-800">{r.nickname || '-'}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">{r.corporationName || '-'}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">{r.organizationName || '-'}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">{r.position || '-'}</td>
                    <td className="px-3 py-2 text-xs">
                      <span style={{
                        background: rl.bg, color: rl.fg,
                        padding: '2px 8px', borderRadius: 999,
                        fontSize: 11, fontWeight: 600,
                      }}>
                        {rl.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                      {formatKstDate(r.createdAt)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {r.isMaster ? (
                        <span className="text-xs text-gray-300 select-none">–</span>
                      ) : (
                        <button
                          onClick={() => { setDeleteError(null); setDeleteTarget(r); }}
                          className="text-xs text-red-500 hover:text-red-700 hover:underline font-medium"
                        >
                          삭제
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 삭제 API 에러 */}
      {deleteError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 text-sm">
          {deleteError}
        </div>
      )}

      {/* 페이지네이션 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-gray-500">
          {total === 0 ? '결과 없음' : `${showingFrom}-${showingTo} / ${total}건 (페이지당 ${PAGE_SIZE}개)`}
        </p>
        <div className="flex gap-1">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0 || loading}
            className="px-3 py-1.5 border border-gray-300 rounded text-xs hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← 이전
          </button>
          <span className="px-3 py-1.5 text-xs text-gray-600">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page + 1 >= totalPages || loading}
            className="px-3 py-1.5 border border-gray-300 rounded text-xs hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            다음 →
          </button>
        </div>
      </div>
    </div>

    {/* 삭제 확인 모달 */}
    {deleteTarget && (
      <DeleteConfirmModal
        member={deleteTarget}
        onConfirm={handleDelete}
        onCancel={() => { setDeleteTarget(null); setDeleteError(null); }}
        deleting={deleting}
      />
    )}
    </>
  );
}
