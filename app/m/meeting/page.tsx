'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { M } from '../_styles/tokens';
import MobileHeader from '../_components/MobileHeader';
import MobileMeetingCalendar from '../_components/MobileMeetingCalendar';
import MobileMeetingForm from '../_components/MobileMeetingForm';
import { useToast } from '../_components/MobileToast';
import { getWeekDates } from '../../../lib/utils';
import type { Reservation, BlockedSlot } from '../../../lib/types';

interface SelectedSlot {
  date: string;
  startTime: string;
  endTime: string;
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export default function MobileMeetingPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [tKey, setTKey] = useState(todayKey);
  const weekDates = useMemo(() => {
    void tKey;
    return getWeekDates(weekOffset);
  }, [weekOffset, tKey]);

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selected, setSelected] = useState<SelectedSlot | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [rRes, bRes] = await Promise.all([
        fetch('/api/reservations', { cache: 'no-store' }),
        fetch('/api/blocked-slots', { cache: 'no-store' }),
      ]);
      if (rRes.ok) {
        const rows = await rRes.json();
        setReservations(rows.map((r: { id: string; date: string; startTime: string; endTime: string; status: string }) => ({
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
      } else {
        throw new Error(String(rRes.status));
      }
      if (bRes.ok) {
        setBlockedSlots(await bRes.json());
      }
    } catch {
      setLoadError('예약 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // 자정 경과 자동 갱신
  useEffect(() => {
    const tick = () => {
      const k = todayKey();
      if (k !== tKey) {
        setTKey(k);
        setWeekOffset(0);
      }
    };
    const onVisible = () => { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    const id = window.setInterval(tick, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.clearInterval(id);
    };
  }, [tKey]);

  const handleSubmit = async (data: {
    name: string; role: string; taskSummary: string; inquiry: string;
    email: string; phone: string; date: string; startTime: string; endTime: string;
  }): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 409) {
        toast.show('이미 신청된 슬롯입니다.', { kind: 'warn' });
        setSelected(null);
        await load();
        return { ok: false, error: '이미 신청된 슬롯입니다.' };
      }
      if (res.status === 429) {
        return { ok: false, error: '요청이 많습니다. 잠시 후 다시 시도해주세요.' };
      }
      if (!res.ok) {
        return { ok: false, error: body?.error || '신청에 실패했습니다.' };
      }
      toast.success('미팅 신청이 접수되었습니다.');
      setSelected(null);
      await load();
      return { ok: true };
    } catch {
      return { ok: false, error: '서버에 연결할 수 없습니다.' };
    }
  };

  return (
    <>
      <MobileHeader title="미팅 신청" />

      <div
        style={{
          maxWidth: M.maxW,
          margin: '0 auto',
          paddingTop: 16,
          paddingBottom: 32,
          fontFamily: M.fontKo,
        }}
      >
        <div
          style={{
            margin: '0 16px 16px',
            padding: 14,
            borderRadius: M.r3,
            background: M.primaryLight,
            border: `1px solid ${M.border}`,
            fontSize: 13,
            color: M.text,
            lineHeight: 1.5,
          }}
        >
          📅 운영팀과 1:1 상담을 신청해보세요.<br />
          <span style={{ color: M.textMuted, fontSize: 12 }}>빈 슬롯을 탭하면 신청 폼이 열립니다 · 30분 단위</span>
        </div>

        {loading && (
          <div style={{ padding: '24px 0', textAlign: 'center', color: M.textMuted, fontSize: 13 }}>
            불러오는 중...
          </div>
        )}

        {loadError && !loading && (
          <div
            style={{
              margin: '12px 16px',
              padding: 14,
              borderRadius: M.r3,
              background: M.dangerBg,
              color: M.danger,
              fontSize: 13,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <span>{loadError}</span>
            <button
              type="button"
              onClick={() => void load()}
              style={{
                border: 'none',
                background: M.danger,
                color: '#fff',
                fontSize: 12,
                fontWeight: 700,
                padding: '6px 12px',
                borderRadius: M.r1,
                cursor: 'pointer',
              }}
            >
              재시도
            </button>
          </div>
        )}

        {!loading && !loadError && (
          <MobileMeetingCalendar
            weekDates={weekDates}
            weekOffset={weekOffset}
            reservations={reservations}
            blockedSlots={blockedSlots}
            selected={selected}
            onSelect={(s) => setSelected(s)}
            onPrev={() => setWeekOffset(o => o - 1)}
            onNext={() => setWeekOffset(o => o + 1)}
            onToday={() => setWeekOffset(0)}
          />
        )}

        {selected && (
          <MobileMeetingForm
            slot={selected}
            onCancel={() => setSelected(null)}
            onSubmit={handleSubmit}
          />
        )}
      </div>
    </>
  );
}
