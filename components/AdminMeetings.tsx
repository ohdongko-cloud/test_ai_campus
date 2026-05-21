"use client";

import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Reservation } from '../lib/types';
import { getReservations, setReservations } from '../lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

type Filter = '전체' | '이번 주' | '이번 달';

const DAY_NAMES = ['월', '화', '수', '목', '금'];

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

export default function AdminMeetings() {
  const [reservations, setReservationsState] = useState<Reservation[]>([]);
  const [filter, setFilter] = useState<Filter>('전체');

  const load = () => setReservationsState(getReservations());

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

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

  // 요일별 예약 건수
  const dayCount: Record<string, number> = { '월': 0, '화': 0, '수': 0, '목': 0, '금': 0 };
  filtered.forEach(r => {
    const d = new Date(r.date + 'T00:00:00');
    const dayIdx = d.getDay() - 1;
    if (dayIdx >= 0 && dayIdx < 5) dayCount[DAY_NAMES[dayIdx]]++;
  });
  const dayChartData = DAY_NAMES.map(name => ({ name, value: dayCount[name] }));

  const handleStatusChange = (id: string, status: 'confirmed' | 'cancelled') => {
    const updated = reservations.map(r =>
      r.id === id ? { ...r, status } : r
    );
    setReservations(updated);
    setReservationsState(updated);
    window.dispatchEvent(new Event('storage'));
  };

  const handleDelete = (id: string) => {
    const updated = reservations.filter(r => r.id !== id);
    setReservations(updated);
    setReservationsState(updated);
    window.dispatchEvent(new Event('storage'));
  };

  const handleExcel = () => {
    const data = filtered.map(r => ({
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

  return (
    <div className="space-y-6">
      {/* 필터 버튼 */}
      <div className="flex gap-2">
        {(['전체', '이번 주', '이번 달'] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded text-sm font-medium border transition-colors ${
              filter === f
                ? 'bg-black text-white border-black'
                : 'bg-white text-black border-gray-300 hover:bg-gray-50'
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

      {/* 예약 목록 테이블 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <h3 className="text-base font-semibold text-gray-800 mb-4">
          예약 목록 ({filtered.length}건)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs" style={{ minWidth: '900px' }}>
            <thead>
              <tr className="bg-gray-50">
                {['상태', '신청일시', '이름', '직무·직급', '예약날짜', '예약시간', '이메일', '전화번호', '담당업무요약', '문의내용', '확정/취소', '삭제'].map(col => (
                  <th key={col} className="border border-gray-200 px-3 py-2 text-left text-xs text-gray-600 font-semibold whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={12} className="border border-gray-200 px-4 py-8 text-center text-sm text-gray-400">
                    예약 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                filtered.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50 align-top">
                    <td className="border border-gray-200 px-3 py-2 whitespace-nowrap">
                      {r.status === 'confirmed' && (
                        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-medium">확정</span>
                      )}
                      {r.status === 'cancelled' && (
                        <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded text-xs font-medium">취소</span>
                      )}
                      {(!r.status || r.status === 'pending') && (
                        <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-xs font-medium">검토중</span>
                      )}
                    </td>
                    <td className="border border-gray-200 px-3 py-2 whitespace-nowrap">{r.registeredAt}</td>
                    <td className="border border-gray-200 px-3 py-2 whitespace-nowrap">{r.name}</td>
                    <td className="border border-gray-200 px-3 py-2 whitespace-nowrap">{r.role}</td>
                    <td className="border border-gray-200 px-3 py-2 whitespace-nowrap">{r.date}</td>
                    <td className="border border-gray-200 px-3 py-2 whitespace-nowrap">{r.startTime} ~ {r.endTime}</td>
                    <td className="border border-gray-200 px-3 py-2">{r.email}</td>
                    <td className="border border-gray-200 px-3 py-2 whitespace-nowrap">{r.phone}</td>
                    <td className="border border-gray-200 px-3 py-2 max-w-xs">{r.taskSummary}</td>
                    <td className="border border-gray-200 px-3 py-2 max-w-xs">{r.inquiry}</td>
                    <td className="border border-gray-200 px-3 py-2 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        {r.status !== 'confirmed' && (
                          <button
                            onClick={() => handleStatusChange(r.id, 'confirmed')}
                            className="bg-green-600 text-white px-2 py-1 rounded text-xs font-medium hover:bg-green-700 transition-colors"
                          >
                            확정
                          </button>
                        )}
                        {r.status !== 'cancelled' && (
                          <button
                            onClick={() => handleStatusChange(r.id, 'cancelled')}
                            className="bg-white text-red-500 border border-red-300 px-2 py-1 rounded text-xs font-medium hover:bg-red-50 transition-colors"
                          >
                            취소
                          </button>
                        )}
                        {r.status === 'confirmed' && (
                          <button
                            onClick={() => handleStatusChange(r.id, 'pending')}
                            className="bg-white text-gray-500 border border-gray-300 px-2 py-1 rounded text-xs font-medium hover:bg-gray-50 transition-colors"
                          >
                            되돌리기
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="border border-gray-200 px-3 py-2">
                      <button onClick={() => handleDelete(r.id)} className="text-red-500 hover:text-red-700">
                        삭제
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <button
        onClick={handleExcel}
        className="bg-black text-white px-5 py-2 rounded text-sm font-medium hover:bg-gray-800 transition-colors"
      >
        전체 목록 엑셀 다운로드
      </button>
    </div>
  );
}
