'use client';

import { useMemo } from 'react';
import { M } from '../_styles/tokens';
import { generateTimeSlots, getNextSlot } from '../../../lib/utils';
import type { Reservation, BlockedSlot } from '../../../lib/types';

const DAY_NAMES = ['월', '화', '수', '목', '금'];

interface Props {
  weekDates: Date[]; // 월~금 5일
  weekOffset: number;
  reservations: Reservation[];
  blockedSlots: BlockedSlot[];
  selected: { date: string; startTime: string; endTime: string } | null;
  onSelect: (slot: { date: string; startTime: string; endTime: string }) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isPast(d: Date, time: string): boolean {
  const [h, m] = time.split(':').map(Number);
  const slotEnd = new Date(d);
  slotEnd.setHours(h, m + 30, 0, 0);
  return slotEnd.getTime() < Date.now();
}

function inBlockedRange(time: string, b: BlockedSlot): boolean {
  if (!b.endTime) return time === b.startTime;
  return time >= b.startTime && time < b.endTime;
}

export default function MobileMeetingCalendar({
  weekDates,
  weekOffset,
  reservations,
  blockedSlots,
  selected,
  onSelect,
  onPrev,
  onNext,
  onToday,
}: Props) {
  const slots = useMemo(() => generateTimeSlots(), []);

  // (date,time) → 슬롯 상태
  const stateFor = (d: Date, time: string): {
    kind: 'empty' | 'pending' | 'confirmed' | 'blocked' | 'past';
  } => {
    if (isPast(d, time)) return { kind: 'past' };
    const key = dateKey(d);

    // 차단 슬롯 (특정 날짜 또는 매주 반복)
    const dow = d.getDay(); // 0=일 ... 6=토
    const blocked = blockedSlots.find(b => {
      if (b.recurring) return b.dayOfWeek === dow && inBlockedRange(time, b);
      return b.date === key && inBlockedRange(time, b);
    });
    if (blocked) return { kind: 'blocked' };

    // 예약 (mask된 상태 포함)
    const r = reservations.find(rv => rv.date === key && rv.startTime <= time && time < rv.endTime);
    if (r) {
      if (r.status === 'confirmed') return { kind: 'confirmed' };
      if (r.status === 'pending') return { kind: 'pending' };
    }
    return { kind: 'empty' };
  };

  const handleClick = (d: Date, time: string) => {
    const s = stateFor(d, time);
    if (s.kind !== 'empty') return;
    onSelect({
      date: dateKey(d),
      startTime: time,
      endTime: getNextSlot(time),
    });
  };

  const first = weekDates[0];
  const last = weekDates[weekDates.length - 1];
  const weekLabel = first && last
    ? `${first.getFullYear()}.${String(first.getMonth() + 1).padStart(2, '0')}.${String(first.getDate()).padStart(2, '0')} – ${String(last.getMonth() + 1).padStart(2, '0')}.${String(last.getDate()).padStart(2, '0')}`
    : '';

  return (
    <div style={{ fontFamily: M.fontKo }}>
      {/* 주차 헤더 */}
      <div
        style={{
          margin: '0 16px 12px',
          padding: 14,
          background: M.surface,
          border: `1px solid ${M.border}`,
          borderRadius: M.r3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <button
          type="button"
          onClick={onPrev}
          style={navBtnStyle}
          aria-label="이전 주"
        >
          ‹
        </button>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: M.text, letterSpacing: '-0.01em' }}>
            {weekLabel}
          </div>
          {weekOffset !== 0 && (
            <button
              type="button"
              onClick={onToday}
              style={{
                marginTop: 4,
                background: 'none',
                border: 'none',
                color: M.primary,
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              이번 주로
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onNext}
          style={navBtnStyle}
          aria-label="다음 주"
        >
          ›
        </button>
      </div>

      {/* 캘린더 그리드 */}
      <div
        style={{
          margin: '0 16px',
          background: M.surface,
          border: `1px solid ${M.border}`,
          borderRadius: M.r3,
          overflow: 'hidden',
        }}
      >
        {/* 헤더 행 (요일·날짜) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `48px repeat(5, 1fr)`,
            background: M.surfaceAlt,
            borderBottom: `1px solid ${M.border}`,
          }}
        >
          <div />
          {weekDates.map((d, i) => {
            const isToday = dateKey(d) === dateKey(new Date());
            return (
              <div
                key={i}
                style={{
                  padding: '8px 0 6px',
                  textAlign: 'center',
                  fontSize: 11,
                  color: isToday ? M.primary : M.textMuted,
                  fontWeight: 700,
                }}
              >
                <div>{DAY_NAMES[i]}</div>
                <div
                  style={{
                    fontSize: 14,
                    marginTop: 2,
                    color: isToday ? '#fff' : M.text,
                    background: isToday ? M.primary : 'transparent',
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    margin: '2px auto 0',
                    display: 'grid',
                    placeItems: 'center',
                    fontFamily: M.fontEn,
                    fontWeight: 700,
                  }}
                >
                  {d.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* 슬롯 그리드 */}
        {slots.map((time) => (
          <div
            key={time}
            style={{
              display: 'grid',
              gridTemplateColumns: `48px repeat(5, 1fr)`,
              borderBottom: `1px solid ${M.border}`,
            }}
          >
            <div
              style={{
                padding: '0 4px',
                textAlign: 'center',
                fontSize: 10,
                color: M.textFaint,
                display: 'grid',
                placeItems: 'center',
                fontFamily: M.fontEn,
                background: M.surfaceAlt,
              }}
            >
              {time}
            </div>
            {weekDates.map((d) => {
              const s = stateFor(d, time);
              const isSelected =
                selected?.date === dateKey(d) && selected.startTime === time;
              return (
                <button
                  key={dateKey(d) + time}
                  type="button"
                  onClick={() => handleClick(d, time)}
                  disabled={s.kind !== 'empty'}
                  style={{
                    ...slotBaseStyle,
                    ...slotPaletteFor(s.kind, isSelected),
                  }}
                  aria-label={`${dateKey(d)} ${time} ${labelFor(s.kind)}`}
                >
                  {s.kind === 'pending' && '대기'}
                  {s.kind === 'confirmed' && '확정'}
                  {s.kind === 'blocked' && '차단'}
                  {isSelected && '선택'}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* 범례 */}
      <div
        style={{
          margin: '12px 16px 0',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          fontSize: 11,
          color: M.textMuted,
        }}
      >
        <Legend dot={M.success} label="가능" />
        <Legend dot={M.warn} label="대기" />
        <Legend dot={M.textMuted} label="확정" />
        <Legend dot={M.danger} label="차단" />
      </div>
    </div>
  );
}

const navBtnStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 18,
  border: 'none',
  background: M.primaryLight,
  color: M.primary,
  fontSize: 20,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: M.fontEn,
  flexShrink: 0,
};

const slotBaseStyle: React.CSSProperties = {
  border: 'none',
  borderLeft: `1px solid ${M.border}`,
  height: 36,
  cursor: 'pointer',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '-0.01em',
  padding: 0,
};

function slotPaletteFor(
  kind: 'empty' | 'pending' | 'confirmed' | 'blocked' | 'past',
  isSelected: boolean
): React.CSSProperties {
  if (isSelected) return { background: M.primary, color: '#fff', cursor: 'pointer' };
  switch (kind) {
    case 'empty':
      return { background: M.surface, color: M.textMuted };
    case 'pending':
      return { background: M.warnBg, color: M.warn, cursor: 'not-allowed' };
    case 'confirmed':
      return { background: M.bg, color: M.textMuted, cursor: 'not-allowed' };
    case 'blocked':
      return { background: M.dangerBg, color: M.danger, cursor: 'not-allowed' };
    case 'past':
      return { background: M.surfaceAlt, color: M.textFaint, cursor: 'not-allowed', opacity: 0.5 };
  }
}

function labelFor(kind: 'empty' | 'pending' | 'confirmed' | 'blocked' | 'past') {
  switch (kind) {
    case 'empty': return '예약 가능';
    case 'pending': return '예약 대기';
    case 'confirmed': return '예약 확정';
    case 'blocked': return '차단됨';
    case 'past': return '과거';
  }
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span aria-hidden style={{ width: 8, height: 8, borderRadius: 4, background: dot }} />
      {label}
    </span>
  );
}
