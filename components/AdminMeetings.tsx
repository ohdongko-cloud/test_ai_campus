"use client";

import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Reservation, BlockedSlot } from '../lib/types';
import {
  generateTimeSlots,
  addMinutes, minutesBetween,
} from '../lib/utils';
import { adminFetch, AdminAuthError } from '../lib/admin-client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

type Filter = '전체' | '이번 주' | '이번 달';

const DAY_NAMES = ['월', '화', '수', '목', '금'];
const DOW_OPTIONS = [
  { label: '월', value: 1 },
  { label: '화', value: 2 },
  { label: '수', value: 3 },
  { label: '목', value: 4 },
  { label: '금', value: 5 },
];
const MAX_BLOCK_HOURS = 99;

function getWeekRange(): [string, string] {
  const today = new Date();
  const day = today.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  return [monday.toISOString().slice(0, 10), friday.toISOString().slice(0, 10)];
}

function getMonthRange(): [string, string] {
  const today = new Date();
  const start = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
  return [start, end];
}

// 두 BlockedSlot이 같은 "키"(요일 or 날짜)인지 확인
function isSameKey(a: BlockedSlot, b: BlockedSlot): boolean {
  if (a.recurring !== b.recurring) return false;
  return a.recurring ? a.dayOfWeek === b.dayOfWeek : a.date === b.date;
}

// 두 슬롯이 시간 범위에서 겹치는지 확인
function overlapsTime(a: BlockedSlot, b: BlockedSlot): boolean {
  const aEnd = a.endTime ?? addMinutes(a.startTime, 60);
  const bEnd = b.endTime ?? addMinutes(b.startTime, 60);
  return a.startTime < bEnd && b.startTime < aEnd;
}

// 겹치는 슬롯 병합 처리
function mergeIntoSlots(existing: BlockedSlot[], newSlot: BlockedSlot): BlockedSlot[] {
  let merged = { ...newSlot };
  const rest: BlockedSlot[] = [];
  for (const s of existing) {
    if (isSameKey(s, merged) && overlapsTime(s, merged)) {
      const sEnd = s.endTime ?? addMinutes(s.startTime, 60);
      const mEnd = merged.endTime ?? addMinutes(merged.startTime, 60);
      merged = {
        ...merged,
        startTime: merged.startTime < s.startTime ? merged.startTime : s.startTime,
        endTime: mEnd > sEnd ? mEnd : sEnd,
        reason: merged.reason || s.reason,
      };
    } else {
      rest.push(s);
    }
  }
  return [...rest, merged];
}

// 새 차단 슬롯이 기존 예약과 충돌하는지 검사
function findConflictingReservations(newSlot: BlockedSlot, reservations: Reservation[]): Reservation[] {
  const slotEnd = newSlot.endTime ?? addMinutes(newSlot.startTime, 60);
  return reservations.filter(r => {
    if (r.status === 'cancelled') return false;
    if (newSlot.recurring) {
      const d = new Date(r.date + 'T00:00:00');
      if (d.getDay() !== newSlot.dayOfWeek) return false;
    } else {
      if (r.date !== newSlot.date) return false;
    }
    return r.startTime >= newSlot.startTime && r.startTime < slotEnd;
  });
}

type StatusFilter = 'all' | 'pending' | 'confirmed' | 'cancelled';

export default function AdminMeetings() {
  const [reservations, setReservationsState] = useState<Reservation[]>([]);
  const [filter, setFilter] = useState<Filter>('전체');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [meetingSearch, setMeetingSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 차단 슬롯 상태
  const [blocked, setBlockedState] = useState<BlockedSlot[]>([]);
  const [newRecurring, setNewRecurring] = useState(true);
  const [newDow, setNewDow] = useState<number>(1);
  const [newDate, setNewDate] = useState('');
  const [newStartTime, setNewStartTime] = useState('09:00');
  const [newEndTime, setNewEndTime] = useState('10:00');
  const [newReason, setNewReason] = useState('');
  const [blockError, setBlockError] = useState('');
  const [blockMsg, setBlockMsg] = useState('');

  const timeSlots = generateTimeSlots();
  // 종료시간 선택 옵션: 시작시간보다 이후 + 17:00까지
  const endTimeOptions = [...timeSlots, '17:00'].filter(t => t > newStartTime);

  const load = async () => {
    try {
      const [rRes, bRes] = await Promise.all([
        adminFetch('/api/admin/reservations'),
        fetch('/api/blocked-slots'),
      ]);
      if (rRes.ok) setReservationsState(await rRes.json());
      if (bRes.ok) setBlockedState(await bRes.json());
    } catch (e) {
      if (e instanceof AdminAuthError) {
        setBlockError('관리자 세션이 만료되었습니다. 다시 로그인해주세요.');
      }
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 시작시간 변경 시 종료시간 자동 보정
  const handleStartTimeChange = (t: string) => {
    setNewStartTime(t);
    if (newEndTime <= t) {
      setNewEndTime(addMinutes(t, 30));
    }
    setBlockError('');
  };

  // ── 예약 필터 ──
  const filtered = reservations.filter(r => {
    if (filter === '전체') return true;
    if (filter === '이번 주') {
      const [start, end] = getWeekRange();
      return r.date >= start && r.date <= end;
    }
    if (filter === '이번 달') {
      const [start, end] = getMonthRange();
      return r.date >= start && r.date <= end;
    }
    return true;
  }).sort((a, b) => b.registeredAt.localeCompare(a.registeredAt));

  // 상태별 건수 (날짜범위 적용 후 기준)
  const statusCount = {
    all: filtered.length,
    pending: filtered.filter(r => !r.status || r.status === 'pending').length,
    confirmed: filtered.filter(r => r.status === 'confirmed').length,
    cancelled: filtered.filter(r => r.status === 'cancelled').length,
  };

  // 카드 목록: 날짜범위 → 상태 → 검색어 순차 적용
  const q = meetingSearch.trim().toLowerCase();
  const displayList = filtered.filter(r => {
    if (statusFilter === 'pending' && !(!r.status || r.status === 'pending')) return false;
    if (statusFilter === 'confirmed' && r.status !== 'confirmed') return false;
    if (statusFilter === 'cancelled' && r.status !== 'cancelled') return false;
    if (q) {
      const hay = `${r.name} ${r.email} ${r.role}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // 요일별 예약 건수
  const dayCount: Record<string, number> = { '월': 0, '화': 0, '수': 0, '목': 0, '금': 0 };
  filtered.forEach(r => {
    const d = new Date(r.date + 'T00:00:00');
    const dayIdx = d.getDay() - 1;
    if (dayIdx >= 0 && dayIdx < 5) dayCount[DAY_NAMES[dayIdx]]++;
  });
  const dayChartData = DAY_NAMES.map(name => ({ name, value: dayCount[name] }));

  const handleStatusChange = async (id: string, status: 'pending' | 'confirmed' | 'cancelled') => {
    // optimistic
    setReservationsState(rs => rs.map(r => r.id === id ? { ...r, status } : r));
    try {
      const res = await adminFetch(`/api/admin/reservations/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch {
      await load();
    }
  };

  const handleDelete = async (id: string) => {
    setReservationsState(rs => rs.filter(r => r.id !== id));
    try {
      const res = await adminFetch(`/api/admin/reservations/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
    } catch {
      await load();
    }
  };

  const handleExcel = () => {
    const data = displayList.map(r => ({
      '이름': r.name,
      '직무/직급': r.role,
      '담당 업무 요약': r.taskSummary,
      '문의 내용': r.inquiry,
      '이메일': r.email,
      '전화번호': r.phone,
      '예약 날짜': r.date,
      '예약 시간': `${r.startTime} ~ ${r.endTime}`,
      '신청 일시': r.registeredAt,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '미팅예약목록');
    XLSX.writeFile(wb, `미팅예약목록_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // ── 차단 슬롯 추가 ──
  const handleAddBlock = async () => {
    setBlockError('');

    // 검증 1: 특정 날짜일 때 날짜 필수
    if (!newRecurring && !newDate) {
      setBlockError('날짜를 선택해주세요.');
      return;
    }
    // 검증 2: 종료시간 > 시작시간
    if (newEndTime <= newStartTime) {
      setBlockError('종료시간은 시작시간보다 이후여야 합니다.');
      return;
    }
    // 검증 3: 최대 8시간
    const diff = minutesBetween(newStartTime, newEndTime);
    if (diff > MAX_BLOCK_HOURS * 60) {
      setBlockError(`차단 범위는 최대 ${MAX_BLOCK_HOURS}시간을 초과할 수 없습니다.`);
      return;
    }

    const draft: BlockedSlot = {
      id: '',
      recurring: newRecurring,
      startTime: newStartTime,
      endTime: newEndTime,
      reason: newReason || undefined,
      ...(newRecurring ? { dayOfWeek: newDow } : { date: newDate }),
    };

    // 검증 4: 기존 예약과 충돌 확인
    const conflicts = findConflictingReservations(draft, reservations);
    if (conflicts.length > 0) {
      const names = conflicts.map(r => `${r.name}(${r.date} ${r.startTime})`).join(', ');
      setBlockError(`기존 예약과 충돌합니다: ${names}`);
      return;
    }

    try {
      const res = await adminFetch('/api/admin/blocked-slots', {
        method: 'POST',
        body: JSON.stringify(draft),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setBlockError(data?.error || '저장에 실패했습니다.');
        return;
      }
      setNewDate('');
      setNewReason('');
      setNewStartTime('09:00');
      setNewEndTime('10:00');
      setBlockMsg('차단 슬롯이 저장되었습니다.');
      setTimeout(() => setBlockMsg(''), 3000);
      await load();
    } catch (e) {
      if (e instanceof AdminAuthError) setBlockError('관리자 세션이 만료되었습니다.');
      else setBlockError('서버 연결 실패');
    }
  };

  const handleDeleteBlock = async (id: string) => {
    try {
      const res = await adminFetch(`/api/admin/blocked-slots/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch {
      // ignore
    }
  };

  const dowLabel = (d: number) => DOW_OPTIONS.find(o => o.value === d)?.label ?? String(d);
  const recurringSlots = blocked.filter(b => b.recurring).sort((a, b) => (a.dayOfWeek ?? 0) - (b.dayOfWeek ?? 0));
  const specificSlots = blocked.filter(b => !b.recurring).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));

  return (
    <div className="space-y-6">
      {/* 필터 버튼 */}
      <div className="flex gap-2">
        {(['전체', '이번 주', '이번 달'] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded text-sm font-medium border transition-colors ${
              filter === f ? 'bg-black text-white border-black' : 'bg-white text-black border-gray-300 hover:bg-gray-50'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* 요일별 막대 차트 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <h3 className="text-base font-semibold text-gray-800 mb-4">요일별 예약 건수</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={dayChartData} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="value" fill="#2563EB" radius={[4, 4, 0, 0]} label={{ position: 'top', fontSize: 11 }} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── 차단 슬롯 관리 ── */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm space-y-5">
        <h3 className="text-base font-semibold text-gray-800">예약 차단 시간 관리</h3>

        {blockMsg && (
          <div className="bg-green-50 border border-green-200 text-green-800 rounded p-2 text-sm">{blockMsg}</div>
        )}

        {/* 추가 폼 */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-600">새 차단 슬롯 추가</p>

          {/* 반복 / 특정 날짜 토글 */}
          <div className="flex gap-2">
            <button
              onClick={() => { setNewRecurring(true); setBlockError(''); }}
              className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                newRecurring ? 'bg-black text-white border-black' : 'bg-white text-gray-600 border-gray-300'
              }`}
            >
              매주 반복
            </button>
            <button
              onClick={() => { setNewRecurring(false); setBlockError(''); }}
              className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                !newRecurring ? 'bg-black text-white border-black' : 'bg-white text-gray-600 border-gray-300'
              }`}
            >
              특정 날짜
            </button>
          </div>

          {/* 요일/날짜 + 시작~종료 시간 (한 행) */}
          <div className="grid grid-cols-3 gap-3">
            {newRecurring ? (
              <div>
                <label className="block text-xs text-gray-500 mb-1">요일</label>
                <select
                  value={newDow}
                  onChange={e => { setNewDow(Number(e.target.value)); setBlockError(''); }}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-gray-500"
                >
                  {DOW_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}요일</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs text-gray-500 mb-1">날짜</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={e => { setNewDate(e.target.value); setBlockError(''); }}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-gray-500"
                />
              </div>
            )}

            <div>
              <label className="block text-xs text-gray-500 mb-1">시작 시간</label>
              <select
                value={newStartTime}
                onChange={e => handleStartTimeChange(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-gray-500"
              >
                {timeSlots.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">종료 시간</label>
              <select
                value={newEndTime}
                onChange={e => { setNewEndTime(e.target.value); setBlockError(''); }}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-gray-500"
              >
                {endTimeOptions.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* 사유 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">사유 (선택)</label>
            <input
              type="text"
              value={newReason}
              onChange={e => setNewReason(e.target.value)}
              placeholder="예: 전사 회의, 외부 출장 등"
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-gray-500"
            />
          </div>

          {/* 에러 메시지 */}
          {blockError && (
            <p className="text-xs text-red-600 font-medium">{blockError}</p>
          )}

          <button
            onClick={handleAddBlock}
            className="bg-black text-white px-4 py-2 rounded text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            + 차단 추가
          </button>
        </div>

        {/* 매주 반복 목록 */}
        {recurringSlots.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2">매주 반복 차단 ({recurringSlots.length}건)</p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-blue-50">
                    <th className="border border-blue-100 px-3 py-2 text-left font-semibold text-blue-800">요일</th>
                    <th className="border border-blue-100 px-3 py-2 text-left font-semibold text-blue-800">차단 시간</th>
                    <th className="border border-blue-100 px-3 py-2 text-left font-semibold text-blue-800">사유</th>
                    <th className="border border-blue-100 px-3 py-2 text-center font-semibold text-blue-800">삭제</th>
                  </tr>
                </thead>
                <tbody>
                  {recurringSlots.map(b => (
                    <tr key={b.id} className="hover:bg-blue-50/50">
                      <td className="border border-blue-100 px-3 py-2">
                        <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-semibold">
                          매주 {dowLabel(b.dayOfWeek!)}요일
                        </span>
                      </td>
                      <td className="border border-blue-100 px-3 py-2 font-medium text-gray-800">
                        {b.startTime}–{b.endTime ?? addMinutes(b.startTime, 60)}
                      </td>
                      <td className="border border-blue-100 px-3 py-2 text-gray-500">{b.reason ?? '—'}</td>
                      <td className="border border-blue-100 px-3 py-2 text-center">
                        <button onClick={() => handleDeleteBlock(b.id)} className="text-red-400 hover:text-red-600 font-medium">삭제</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 특정 날짜 목록 */}
        {specificSlots.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2">특정 날짜 차단 ({specificSlots.length}건)</p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-600">날짜</th>
                    <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-600">차단 시간</th>
                    <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-600">사유</th>
                    <th className="border border-gray-200 px-3 py-2 text-center font-semibold text-gray-600">삭제</th>
                  </tr>
                </thead>
                <tbody>
                  {specificSlots.map(b => (
                    <tr key={b.id} className="hover:bg-gray-50">
                      <td className="border border-gray-200 px-3 py-2 font-medium">{b.date}</td>
                      <td className="border border-gray-200 px-3 py-2 font-medium text-gray-800">
                        {b.startTime}–{b.endTime ?? addMinutes(b.startTime, 60)}
                      </td>
                      <td className="border border-gray-200 px-3 py-2 text-gray-500">{b.reason ?? '—'}</td>
                      <td className="border border-gray-200 px-3 py-2 text-center">
                        <button onClick={() => handleDeleteBlock(b.id)} className="text-red-400 hover:text-red-600 font-medium">삭제</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {blocked.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-3">차단된 슬롯이 없습니다.</p>
        )}
      </div>

      {/* 예약 목록 (카드형) */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-base font-semibold text-gray-800">예약 목록 ({displayList.length}건)</h3>
          <button
            onClick={handleExcel}
            className="bg-black text-white px-4 py-1.5 rounded text-xs font-medium hover:bg-gray-800 transition-colors"
          >
            엑셀 다운로드
          </button>
        </div>

        {/* 상태 탭 */}
        <div className="flex gap-2 flex-wrap">
          {([
            { key: 'all' as const, label: '전체', count: statusCount.all, color: 'blue' },
            { key: 'pending' as const, label: '검토중', count: statusCount.pending, color: 'yellow' },
            { key: 'confirmed' as const, label: '확정', count: statusCount.confirmed, color: 'green' },
            { key: 'cancelled' as const, label: '취소', count: statusCount.cancelled, color: 'red' },
          ]).map(t => {
            const on = statusFilter === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setStatusFilter(t.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  on ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {t.label} <span className={on ? 'text-blue-100' : 'text-gray-400'}>{t.count}</span>
              </button>
            );
          })}
        </div>

        {/* 검색 */}
        <input
          type="text"
          value={meetingSearch}
          onChange={e => setMeetingSearch(e.target.value)}
          placeholder="🔍 이름 · 이메일 · 직무 검색"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
        />

        {/* 카드 목록 */}
        <div className="space-y-3">
          {displayList.length === 0 ? (
            <div className="text-center py-10 text-sm text-gray-400">조건에 맞는 예약이 없습니다.</div>
          ) : (
            displayList.map(r => {
              const expanded = expandedId === r.id;
              const statusBadge =
                r.status === 'confirmed' ? <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-semibold">확정</span> :
                r.status === 'cancelled' ? <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded text-xs font-semibold">취소</span> :
                <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-xs font-semibold">검토중</span>;
              return (
                <div key={r.id} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
                  {/* 헤더: 상태 + 이름·직무 + 신청일시 */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                      {statusBadge}
                      <span className="text-sm font-bold text-gray-900">{r.name}</span>
                      <span className="text-xs text-gray-500">{r.role}</span>
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">신청 {r.registeredAt}</span>
                  </div>

                  {/* 날짜·시간·연락처 */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600 mb-3">
                    <span className="font-medium text-gray-800">📅 {r.date}</span>
                    <span className="font-medium text-gray-800">⏰ {r.startTime} ~ {r.endTime}</span>
                    <span>✉ {r.email}</span>
                    <span>📞 {r.phone}</span>
                  </div>

                  {/* 상세 펼치기 */}
                  {expanded && (
                    <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 mb-3 space-y-2 text-xs">
                      <div>
                        <span className="font-semibold text-gray-500 block mb-0.5">담당 업무 요약</span>
                        <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{r.taskSummary || '—'}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-500 block mb-0.5">문의 내용</span>
                        <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{r.inquiry || '—'}</p>
                      </div>
                    </div>
                  )}

                  {/* 액션 바 */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100">
                    <button
                      onClick={() => setExpandedId(expanded ? null : r.id)}
                      className="text-xs font-medium text-blue-600 hover:text-blue-800"
                    >
                      {expanded ? '상세 접기 ▲' : '상세 펼치기 ▼'}
                    </button>
                    <div className="flex gap-1.5">
                      {r.status !== 'confirmed' && (
                        <button onClick={() => handleStatusChange(r.id, 'confirmed')}
                          className="bg-green-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-green-700 transition-colors">확정</button>
                      )}
                      {r.status !== 'cancelled' && (
                        <button onClick={() => handleStatusChange(r.id, 'cancelled')}
                          className="bg-white text-red-500 border border-red-300 px-3 py-1.5 rounded text-xs font-medium hover:bg-red-50 transition-colors">취소</button>
                      )}
                      {r.status === 'confirmed' && (
                        <button onClick={() => handleStatusChange(r.id, 'pending')}
                          className="bg-white text-gray-500 border border-gray-300 px-3 py-1.5 rounded text-xs font-medium hover:bg-gray-50 transition-colors">되돌리기</button>
                      )}
                      <button onClick={() => handleDelete(r.id)}
                        className="text-red-500 hover:text-red-700 border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded text-xs font-medium transition-colors">삭제</button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
