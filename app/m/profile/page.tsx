'use client';

import { useEffect, useState } from 'react';
import { M } from '../_styles/tokens';
import MobileHeader from '../_components/MobileHeader';
import { getUserInfo, clearUserInfo, type UserInfo } from '../../../lib/utils';

export default function MobileProfilePage() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  useEffect(() => {
    setUserInfo(getUserInfo());
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/users/logout', { method: 'POST', credentials: 'include' });
    } catch {
      /* ignore */
    }
    clearUserInfo();
    window.location.href = '/m';
  };

  return (
    <>
      <MobileHeader title="프로필" initial={userInfo?.name?.[0] || '게'} />
      <div style={{ padding: '24px 16px', fontFamily: M.fontKo, maxWidth: M.maxW, margin: '0 auto' }}>
        {userInfo ? (
          <>
            <div
              style={{
                background: M.surface,
                borderRadius: M.r5,
                border: `1px solid ${M.border}`,
                padding: 20,
                marginBottom: 16,
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 800, color: M.text, marginBottom: 4 }}>
                {userInfo.name}
              </div>
              <div style={{ fontSize: 13, color: M.textMuted, marginBottom: 12 }}>
                {userInfo.email}
              </div>
              <div style={{ display: 'grid', gap: 6, fontSize: 13, color: M.textBody }}>
                {userInfo.corporationName && <div>법인: {userInfo.corporationName}</div>}
                {userInfo.organizationName && <div>조직: {userInfo.organizationName}</div>}
                {userInfo.position && <div>직무: {userInfo.position}</div>}
              </div>
            </div>

            <button
              onClick={handleLogout}
              style={{
                width: '100%',
                padding: 16,
                borderRadius: M.r3,
                border: `1px solid ${M.border}`,
                background: M.surface,
                color: M.danger,
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              로그아웃
            </button>
          </>
        ) : (
          <p style={{ fontSize: 13, color: M.textMuted }}>로그인이 필요합니다.</p>
        )}
      </div>
    </>
  );
}
