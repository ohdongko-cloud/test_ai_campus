'use client';

import { useRouter, usePathname } from 'next/navigation';
import { M } from '../_styles/tokens';

const TABS = [
  { key: 'home',    label: '홈',     href: '/m' },
  { key: 'video',   label: '학습',   href: '/m/video' },
  { key: 'board',   label: '질문',   href: '/m/board' },
  { key: 'profile', label: '프로필', href: '/m/profile' },
] as const;

export type TabKey = (typeof TABS)[number]['key'];

function isActive(pathname: string, href: string) {
  if (href === '/m') return pathname === '/m';
  return pathname.startsWith(href);
}

export default function MobileTabBar() {
  const router = useRouter();
  const pathname = usePathname() ?? '/m';

  return (
    <nav
      aria-label="하단 탭"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 40,
        background: M.surface,
        borderTop: `1px solid ${M.border}`,
        paddingBottom: M.safeBottom,
        fontFamily: M.fontKo,
      }}
    >
      <div
        style={{
          maxWidth: M.maxW,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: `repeat(${TABS.length}, 1fr)`,
          height: M.tabBarH,
        }}
      >
        {TABS.map(t => {
          const active = isActive(pathname, t.href);
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => router.push(t.href)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: active ? M.primary : M.textMuted,
                position: 'relative',
              }}
            >
              {/* 상단 액티브 인디케이터 */}
              {active && (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 24,
                    height: 3,
                    borderRadius: 2,
                    background: M.primary,
                  }}
                />
              )}
              {/* 점 아이콘 (이모지 대체) */}
              <span
                aria-hidden
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  background: active ? M.primary : M.border,
                }}
              />
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '-0.01em' }}>
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
