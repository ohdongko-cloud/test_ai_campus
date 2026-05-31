'use client';

import { useRouter } from 'next/navigation';
import { M, MENU_GRADIENTS, gradient, type MenuKind } from '../_styles/tokens';

interface MenuItem {
  kind: MenuKind;
  title: string;
  sub: string;
  count: string;
  countSuffix: string;
  href: string;
}

export interface MenuCardCounts {
  /** 강의 전체 개수 (`/api/videos` 길이) */
  videoCount?: number;
  /** 게시글 전체 개수 (`/api/posts` 길이) */
  postCount?: number;
  /** 공유 서비스 개수 (`/api/services` 길이) */
  serviceCount?: number;
}

function buildItems(c: MenuCardCounts): MenuItem[] {
  const fmt = (n?: number) => (typeof n === 'number' ? String(n) : '–');
  return [
    { kind: 'learn',   title: '학습', sub: 'AI 강의 · 실습',    count: fmt(c.videoCount),   countSuffix: '강',    href: '/m/video' },
    { kind: 'meeting', title: '미팅', sub: '1:1 상담 신청',     count: '예약',              countSuffix: '가능',  href: '/m/meeting' },
    { kind: 'ask',     title: '질문', sub: '게시판 · QnA',       count: fmt(c.postCount),    countSuffix: '글',    href: '/m/board' },
    { kind: 'share',   title: '공유', sub: 'AI 서비스 공유',     count: fmt(c.serviceCount), countSuffix: '개',    href: '/m/share' },
  ];
}

export default function MobileMenuCard({
  videoCount, postCount, serviceCount,
}: MenuCardCounts = {}) {
  const ITEMS = buildItems({ videoCount, postCount, serviceCount });
  const router = useRouter();
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 12,
        margin: '0 16px',
      }}
    >
      {ITEMS.map(item => {
        const grad = MENU_GRADIENTS[item.kind];
        return (
          <button
            key={item.kind}
            type="button"
            onClick={() => router.push(item.href)}
            style={{
              position: 'relative',
              textAlign: 'left',
              padding: 18,
              minHeight: 180,
              borderRadius: M.r5,
              border: 'none',
              cursor: 'pointer',
              color: '#fff',
              background: gradient(grad.from, grad.to, 135),
              boxShadow: M.shadowMd,
              overflow: 'hidden',
              fontFamily: M.fontKo,
            }}
          >
            {/* 장식 원 */}
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: -30,
                right: -30,
                width: 100,
                height: 100,
                borderRadius: 50,
                background: 'rgba(255,255,255,0.08)',
              }}
            />

            {/* 큰 숫자 + 단위 */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span
                style={{
                  fontSize: 32,
                  fontWeight: 800,
                  fontFamily: M.fontEn,
                  letterSpacing: '-0.02em',
                }}
              >
                {item.count}
              </span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>
                {item.countSuffix}
              </span>
            </div>

            {/* 타이틀 + 부제 */}
            <div style={{ marginTop: 36 }}>
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.01em' }}>
                {item.title}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>
                {item.sub}
              </div>
            </div>

            {/* 우하단 화살표 */}
            <div
              aria-hidden
              style={{
                position: 'absolute',
                right: 12,
                bottom: 12,
                width: 28,
                height: 28,
                borderRadius: 14,
                background: 'rgba(255,255,255,0.2)',
                display: 'grid',
                placeItems: 'center',
                fontFamily: M.fontEn,
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              ›
            </div>
          </button>
        );
      })}
    </div>
  );
}
