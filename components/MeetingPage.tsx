"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Reservation } from '../lib/types';
import {
  getWeekDates, generateTimeSlots,
  getNextSlot, formatDate, getUserInfo,
  maskName,
} from '../lib/utils';
import { BlockedSlot } from '../lib/types';

const DAY_NAMES = ['월', '화', '수', '목', '금'];

// 오늘 날짜를 'YYYY-MM-DD' 키로 — 자정 지나 바뀌면 이 값도 바뀜 → 주차 자동 갱신 트리거
function getTodayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

interface SelectedSlot {
  date: string;
  startTime: string;
  endTime: string;
}

export default function MeetingPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  // todayKey 가 바뀌면 weekDates 자동 재계산 (자정/탭 활성화 시 setState 호출)
  const [todayKey, setTodayKey] = useState<string>(getTodayKey);
  // useMemo: weekOffset / todayKey 변경 시 자동 재계산
  const weekDates = useMemo(() => {
    void todayKey; // todayKey 변경을 의존성으로 잡기 위한 명시적 참조
    return getWeekDates(weekOffset);
  }, [weekOffset, todayKey]);
  const [timeSlots] = useState<string[]>(generateTimeSlots());
  const [reservations, setReservationsState] = useState<Reservation[]>([]);
  const [blockedSlots, setBlockedSlotsState] = useState<BlockedSlot[]>([]);
  const [selected, setSelected] = useState<SelectedSlot | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  // Form state
  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState('');
  const [formTask, setFormTask] = useState('');
  const [formInquiry, setFormInquiry] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');

  // 날짜 변경 자동 감지 — 페이지 오래 열어둔 채 자정이 지나도, 다른 탭 갔다 돌아와도
  // 자동으로 "이번 주"가 다시 표시되게 한다.
  //   - 매 60초마다 오늘 날짜 키 비교 → 바뀌었으면 todayKey 갱신 + weekOffset 0 으로 reset
  //   - 탭 다시 활성화(visibilitychange) / 창 focus 시에도 즉시 체크
  useEffect(() => {
    const tick = () => {
      const k = getTodayKey();
      if (k !== todayKey) {
        setTodayKey(k);
        setWeekOffset(0); // 새 주가 시작됐으면 자동으로 이번 주로
      }
    };
    const onVisible = () => { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    const id = setInterval(tick, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      clearInterval(id);
    };
  }, [todayKey]);

  const loadAll = async () => {
    try {
      const [rRes, bRes] = await Promise.all([
        fetch('/api/reservations'),
        fetch('/api/blocked-slots'),
      ]);
      if (rRes.ok) {
        const rows = await rRes.json();
        // 공개 API는 마스킹된 name만 반환 → Reservation 타입 일부 필드만 채움
        setReservationsState(rows.map((r: { id: string; date: string; startTime: string; endTime: string; status: string }) => ({
          id: r.id,
          name: '',
          role: '',
          taskSummary: '',
          inquiry: '',
          email: '',
          phone: '',
          date: r.date,
          startTime: r.startTime,
          endTime: r.endTime,
          registeredAt: '',
          status: r.status,
        }) as Reservation));
      }
      if (bRes.ok) setBlockedSlotsState(await bRes.json());
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    const info = getUserInfo();
    if (info) {
      if (info.name) setFormName(info.name);
      if (info.role) setFormRole(info.role);
      if (info.email) setFormEmail(info.email);
    }
  }, []);

  // 예약된 슬롯 여부 (cancelled 제외)
  const isReserved = (date: string, time: string): boolean =>
    reservations.some(r =>
      r.date === date && r.startTime === time && r.status !== 'cancelled'
    );

  // 관리자 차단 슬롯 여부: [startTime, endTime) 범위 내 slot 포함 여부
  const isBlocked = (date: string, time: string): boolean =>
    blockedSlots.some(b => {
      // endTime 없는 레거시 데이터는 startTime+30분으로 처리 (utils에서 마이그레이션되므로 보험용)
      const endTime = b.endTime ?? (() => {
        const [h, m] = b.startTime.split(':').map(Number);
        const total = h * 60 + m + 30;
        return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
      })();
      if (b.recurring) {
        const d = new Date(date + 'T00:00:00');
        return b.dayOfWeek === d.getDay() && b.startTime <= time && time < endTime;
      }
      return b.date === date && b.startTime <= time && time < endTime;
    });

  // 선택 불가 여부
  const isUnavailable = (date: string, time: string): boolean =>
    isReserved(date, time) || isBlocked(date, time);

  // 해당 슬롯의 예약 정보 (확정 상태)
  const getConfirmedReservation = (date: string, time: string) =>
    reservations.find(r =>
      r.date === date && r.startTime === time && r.status === 'confirmed'
    );

  const isSelected = (date: string, time: string): boolean =>
    selected?.date === date && (selected.startTime === time || selected.endTime === time);

  const handleSlotClick = (date: string, time: string) => {
    if (isUnavailable(date, time)) return;

    if (selected && selected.date === date) {
      const nextSlot = getNextSlot(selected.startTime);
      if (time === selected.startTime) {
        setSelected(null);
      } else if (time === nextSlot && !isUnavailable(date, nextSlot)) {
        setSelected({ date, startTime: selected.startTime, endTime: nextSlot });
      } else {
        setSelected({ date, startTime: time, endTime: time });
      }
    } else {
      setSelected({ date, startTime: time, endTime: time });
    }
  };

  // pending 예약 슬롯
  const getPendingReservation = (date: string, time: string) =>
    reservations.find(r =>
      r.date === date && r.startTime === time && r.status === 'pending'
    );

  const getSlotContent = (date: string, time: string): { label: string; sub?: string; blocked?: boolean } => {
    if (isBlocked(date, time)) return { label: '예약 불가', blocked: true };
    const confirmed = getConfirmedReservation(date, time);
    if (confirmed) return { label: '예약 확정', sub: maskName(confirmed.name) };
    const pending = getPendingReservation(date, time);
    if (pending) return { label: '일정 확인 중' };
    if (isReserved(date, time)) return { label: '예약중' };
    if (isSelected(date, time)) return { label: '선택됨' };
    return { label: '' };
  };

  const getSlotStyle = (date: string, time: string): React.CSSProperties => {
    if (isBlocked(date, time)) return {
      background: 'repeating-linear-gradient(-45deg,#e5e7eb,#e5e7eb 3px,#f3f4f6 3px,#f3f4f6 7px)',
      color: '#9ca3af', cursor: 'not-allowed', fontSize: 11,
    };
    const confirmed = getConfirmedReservation(date, time);
    if (confirmed)
      return { background: '#dcfce7', color: '#15803d', cursor: 'not-allowed', fontSize: 11, fontWeight: 500 };
    const pending = getPendingReservation(date, time);
    if (pending)
      return { background: '#fefce8', color: '#a16207', cursor: 'not-allowed', fontSize: 11 };
    if (isReserved(date, time))
      return { background: '#e5e7eb', color: '#6b7280', cursor: 'not-allowed', fontSize: 11 };
    if (isSelected(date, time))
      return { background: '#2563eb', color: '#fff', fontSize: 11, cursor: 'pointer' };
    return { background: '#fff', fontSize: 11, cursor: 'pointer' };
  };

  const getSelectedSummary = (): string => {
    if (!selected) return '';
    const dateObj = weekDates.find(d => formatDate(d) === selected.date);
    if (!dateObj) return '';
    const dayIdx = dateObj.getDay() - 1;
    const dayName = DAY_NAMES[dayIdx] || '';
    const month = dateObj.getMonth() + 1;
    const day = dateObj.getDate();
    const endTime = selected.endTime === selected.startTime
      ? getNextSlot(selected.startTime)
      : getNextSlot(selected.endTime);
    return `선택된 시간: ${dayName}요일 ${month}/${day} ${selected.startTime} ~ ${endTime}`;
  };

  const isFormValid = () =>
    formName && formRole && formTask && formInquiry && formEmail && formPhone && selected;

  const handleReserve = async () => {
    if (!isFormValid() || !selected) return;
    const endTime = selected.endTime === selected.startTime
      ? getNextSlot(selected.startTime)
      : getNextSlot(selected.endTime);

    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName, role: formRole,
          taskSummary: formTask, inquiry: formInquiry,
          email: formEmail, phone: formPhone,
          date: selected.date,
          startTime: selected.startTime,
          endTime,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSuccessMsg(data?.error || '예약 등록에 실패했습니다.');
        setTimeout(() => setSuccessMsg(''), 4000);
        return;
      }

      const dateObj = new Date(selected.date + 'T00:00:00');
      const month = dateObj.getMonth() + 1;
      const day = dateObj.getDate();
      setSuccessMsg(`예약이 완료되었습니다 — ${formName}님의 ${month}/${day} ${selected.startTime} 미팅이 등록되었습니다`);
      setTimeout(() => setSuccessMsg(''), 4000);

      setSelected(null);
      setFormTask('');
      setFormInquiry('');
      await loadAll();
    } catch {
      setSuccessMsg('서버 연결에 실패했습니다.');
      setTimeout(() => setSuccessMsg(''), 4000);
    }
  };

  const handleCancel = () => {
    setSelected(null);
    setFormTask('');
    setFormInquiry('');
  };

  const userInfo = getUserInfo();
  const myReservations = userInfo?.email
    ? reservations.filter(r => r.email === userInfo.email)
    : reservations;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {successMsg && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-800 rounded p-3 text-sm">
          {successMsg}
        </div>
      )}

      <h1 className="text-2xl font-bold text-gray-900 mb-2">미팅 요청하기</h1>
      <p className="text-sm text-gray-500 mb-1">
        AI서비스 구현 어려울 경우 미팅 요청해주세요. 일정 확인 후 메일로 개별 연락 드립니다.
      </p>
      <p className="text-sm text-gray-400 mb-6">
        원하는 날짜와 시간을 선택하고 예약 정보를 입력하세요. 30분 또는 1시간 단위로 예약 가능합니다.
      </p>

      {/* 주 이동 */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <button
          onClick={() => setWeekOffset(w => w - 1)}
          className="bg-white border border-gray-300 text-black px-3 py-1.5 rounded text-sm hover:bg-gray-50"
        >
          &lt; 이전 주
        </button>
        <span className="text-sm font-medium text-gray-700 inline-flex items-center gap-2">
          {weekDates.length > 0
            ? `${weekDates[0].getMonth() + 1}/${weekDates[0].getDate()} ~ ${weekDates[4].getMonth() + 1}/${weekDates[4].getDate()}`
            : ''}
          {weekOffset === 0 && (
            <span className="text-[11px] font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              이번 주
            </span>
          )}
        </span>
        <button
          onClick={() => setWeekOffset(w => w + 1)}
          className="bg-white border border-gray-300 text-black px-3 py-1.5 rounded text-sm hover:bg-gray-50"
        >
          다음 주 &gt;
        </button>
        {weekOffset !== 0 && (
          <button
            onClick={() => setWeekOffset(0)}
            className="ml-auto text-xs font-semibold bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 transition-colors"
            title="이번 주로 돌아가기"
          >
            오늘로 ↩
          </button>
        )}
      </div>

      {/* 캘린더 테이블 */}
      <div className="overflow-x-auto mb-4">
        <table className="w-full border-collapse text-sm" style={{ minWidth: '600px' }}>
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-gray-200 px-3 py-2 text-xs text-gray-500 font-medium w-16">시간</th>
              {weekDates.map((d, i) => (
                <th key={i} className="border border-gray-200 px-2 py-2 text-xs text-gray-700 font-semibold">
                  {DAY_NAMES[i]} {d.getMonth() + 1}/{d.getDate()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timeSlots.map(slot => (
              <tr key={slot}>
                <td className="border border-gray-200 px-3 py-1.5 text-xs text-gray-500 font-medium bg-gray-50 text-center">
                  {slot}
                </td>
                {weekDates.map((d, i) => {
                  const dateStr = formatDate(d);
                  const content = getSlotContent(dateStr, slot);
                  return (
                    <td
                      key={i}
                      onClick={() => handleSlotClick(dateStr, slot)}
                      className="border border-gray-200 px-1 py-1 text-center"
                      style={{ minHeight: '32px', ...getSlotStyle(dateStr, slot) }}
                    >
                      {content.label && (
                        <div className="leading-tight">
                          {content.blocked ? (
                            <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', letterSpacing: '-0.02em' }}>
                              🚫 예약 불가
                            </div>
                          ) : (
                            <div>{content.label}</div>
                          )}
                          {content.sub && <div className="text-xs opacity-80">{content.sub}</div>}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 선택된 시간 요약 */}
      {selected && (
        <div className="mb-6 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded p-3">
          {getSelectedSummary()}
        </div>
      )}

      {/* 예약 폼 */}
      {selected && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-5">예약 정보 입력</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">이름 <span className="text-red-500">*</span></label>
              <input type="text" value={formName} onChange={e => setFormName(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">직무 / 직급 <span className="text-red-500">*</span></label>
              <input type="text" value={formRole} onChange={e => setFormRole(e.target.value)}
                placeholder="예: 마케팅팀 과장"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">현재 담당 업무 요약 <span className="text-red-500">*</span></label>
              <textarea rows={3} value={formTask} onChange={e => setFormTask(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500 resize-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">필요한 서비스 / 문의 내용 <span className="text-red-500">*</span></label>
              <textarea rows={3} value={formInquiry} onChange={e => setFormInquiry(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500 resize-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">이메일 주소 <span className="text-red-500">*</span></label>
              <input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">전화번호 <span className="text-red-500">*</span></label>
              <input type="text" value={formPhone} onChange={e => setFormPhone(e.target.value)}
                placeholder="010-0000-0000"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500" />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button
              onClick={handleReserve}
              disabled={!isFormValid()}
              className={`px-5 py-2 rounded text-sm font-medium transition-colors ${
                isFormValid()
                  ? 'bg-black text-white hover:bg-gray-800'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              예약 완료
            </button>
            <button
              onClick={handleCancel}
              className="bg-white text-black border border-gray-300 px-5 py-2 rounded text-sm font-medium hover:bg-gray-50"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 내 예약 내역 */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">내 예약 내역</h2>
        {myReservations.length === 0 ? (
          <p className="text-sm text-gray-500">예약 내역이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm" style={{ minWidth: '600px' }}>
              <thead>
                <tr className="bg-gray-50">
                  {['상태', '날짜', '시간', '담당 업무 요약', '문의 내용'].map(col => (
                    <th key={col} className="border border-gray-200 px-3 py-2 text-left text-xs text-gray-600 font-semibold">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {myReservations.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="border border-gray-200 px-3 py-2 text-xs whitespace-nowrap">
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
                    <td className="border border-gray-200 px-3 py-2 text-xs whitespace-nowrap">{r.date}</td>
                    <td className="border border-gray-200 px-3 py-2 text-xs whitespace-nowrap">{r.startTime} ~ {r.endTime}</td>
                    <td className="border border-gray-200 px-3 py-2 text-xs">{r.taskSummary}</td>
                    <td className="border border-gray-200 px-3 py-2 text-xs">{r.inquiry}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
