'use client';

import { M } from '../_styles/tokens';
import BrandMark from '../../../components/BrandMark';

interface Props {
  title: string;
  initial?: string;       // 프로필 이니셜
  notifCount?: number;    // 미확인 알림 카운트 (0이면 닷 안 보임)
  onNotifClick?: () => void;
  onProfileClick?: () => void;
}

export default function MobileHeader({
  title,
  initial = '게',
  notifCount = 0,
  onNotifClick,
  onProfileClick,
}: Props) {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: M.surface,
        borderBottom: `1px solid ${M.border}`,
        paddingTop: M.safeTop,
        fontFamily: M.fontKo,
      }}
    >
      <div
        style={{
          maxWidth: M.maxW,
          margin: '0 auto',
          padding: '0 16px',
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        {/* 로고 + 타이틀 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <BrandMark size={36} />
          <div
            style={{
              fontWeight: 700,
              fontSize: 16,
              color: M.text,
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {title}
          </div>
        </div>

        {/* 우측 액션 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {/* 알림 */}
          <button
            type="button"
            onClick={onNotifClick}
            aria-label="알림"
            style={{
              position: 'relative',
              width: 40,
              height: 40,
              borderRadius: 20,
              background: M.bg,
              border: 'none',
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              fontSize: 18,
              color: M.textBody,
            }}
          >
            <span aria-hidden style={{ fontSize: 16 }}>●</span>
            {notifCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  minWidth: 16,
                  height: 16,
                  borderRadius: 8,
                  background: M.danger,
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 700,
                  display: 'grid',
                  placeItems: 'center',
                  padding: '0 4px',
                  fontFamily: M.fontEn,
                }}
              >
                {notifCount > 99 ? '99+' : notifCount}
              </span>
            )}
          </button>

          {/* 프로필 */}
          <button
            type="button"
            onClick={onProfileClick}
            aria-label="프로필"
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              background: M.primaryLight,
              color: M.primary,
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 15,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            {initial}
          </button>
        </div>
      </div>
    </header>
  );
}
