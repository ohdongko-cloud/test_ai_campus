'use client';

import { useEffect, useState, useCallback } from 'react';
import { M } from '../_styles/tokens';
import MobileHeader from '../_components/MobileHeader';
import MobileServiceCard from '../_components/MobileServiceCard';
import MobileShareRegisterSheet from '../_components/MobileShareRegisterSheet';
import { useToast } from '../_components/MobileToast';
import { getUserInfo } from '../../../lib/utils';
import type { SharedService } from '../../../lib/types';

export default function MobileSharePage() {
  const [services, setServices] = useState<SharedService[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch(`/api/services?_=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      const rows: SharedService[] = await res.json();
      setServices(rows);
    } catch {
      setLoadError('공유 서비스 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const info = getUserInfo();
    setIsLoggedIn(!!info?.visited);
    void fetch('/api/users/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : { user: null })
      .then(d => setIsLoggedIn(!!d?.user))
      .catch(() => { /* keep local guess */ });
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleOpenSheet = () => {
    if (!isLoggedIn) {
      toast.show('로그인 후 이용 가능합니다.', { kind: 'warn' });
      return;
    }
    setSheetOpen(true);
  };

  const handleSubmit = async (data: {
    serviceName: string; url: string; testAccount: string; description: string;
  }): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, error: body?.error || '등록에 실패했습니다.' };
      }
      toast.success(`${data.serviceName} 서비스가 공유되었습니다.`);
      await load();
      return { ok: true };
    } catch {
      return { ok: false, error: '서버에 연결할 수 없습니다.' };
    }
  };

  return (
    <>
      <MobileHeader title="공유 서비스" />

      <div
        style={{
          maxWidth: M.maxW,
          margin: '0 auto',
          paddingTop: 16,
          paddingBottom: 120,
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
          🎉 내가 만든 AI 서비스를 동료들에게 자랑해보세요.<br />
          <span style={{ color: M.textMuted, fontSize: 12 }}>회원 누구나 자유롭게 등록 가능</span>
        </div>

        {loading && (
          <div style={{ padding: '24px 0', textAlign: 'center', color: M.textMuted, fontSize: 13 }}>
            불러오는 중...
          </div>
        )}

        {loadError && (
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

        {!loading && !loadError && services.length === 0 && (
          <div
            style={{
              margin: '32px 16px',
              padding: 24,
              textAlign: 'center',
              color: M.textMuted,
              fontSize: 13,
              background: M.surface,
              border: `1px dashed ${M.border}`,
              borderRadius: M.r3,
            }}
          >
            아직 공유된 서비스가 없습니다.<br />첫 번째로 공유해보세요!
          </div>
        )}

        {services.map(s => (
          <MobileServiceCard key={s.id} service={s} />
        ))}
      </div>

      {/* FAB */}
      <button
        type="button"
        onClick={handleOpenSheet}
        style={{
          position: 'fixed',
          right: 20,
          bottom: `calc(20px + ${M.safeBottom})`,
          width: 56,
          height: 56,
          borderRadius: 28,
          border: 'none',
          background: M.primary,
          color: '#fff',
          fontSize: 28,
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: M.shadowLg,
          zIndex: 30,
          display: 'grid',
          placeItems: 'center',
          fontFamily: M.fontEn,
        }}
        aria-label="서비스 공유하기"
      >
        +
      </button>

      <MobileShareRegisterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSubmit={handleSubmit}
      />
    </>
  );
}
