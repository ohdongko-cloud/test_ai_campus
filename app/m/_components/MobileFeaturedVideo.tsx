'use client';

import { useRouter } from 'next/navigation';
import { M, gradient } from '../_styles/tokens';

interface Props {
  title: string;
  level: string;
  duration: string;
  views?: number;
  author?: string;
  videoId?: string; // 클릭 시 /m/video?id=
}

export default function MobileFeaturedVideo({
  title, level, duration, views, author, videoId,
}: Props) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.push(videoId ? `/m/video?id=${videoId}` : '/m/video')}
      style={{
        display: 'flex',
        gap: 0,
        width: 'calc(100% - 32px)',
        margin: '0 16px',
        padding: 0,
        border: `1px solid ${M.border}`,
        borderRadius: M.r4,
        background: M.surface,
        boxShadow: M.shadowSm,
        cursor: 'pointer',
        overflow: 'hidden',
        textAlign: 'left',
        fontFamily: M.fontKo,
        alignItems: 'stretch',
      }}
    >
      {/* 썸네일 (그라데이션) */}
      <div
        style={{
          position: 'relative',
          width: 120,
          flexShrink: 0,
          background: gradient(M.primaryDark, M.primary, 135),
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <div
          aria-hidden
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            background: 'rgba(255,255,255,0.9)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <div
            style={{
              width: 0,
              height: 0,
              borderLeft: `12px solid ${M.primary}`,
              borderTop: '8px solid transparent',
              borderBottom: '8px solid transparent',
              marginLeft: 3,
            }}
          />
        </div>
      </div>

      {/* 정보 */}
      <div style={{ flex: 1, padding: 16, minWidth: 0 }}>
        <div
          style={{
            display: 'inline-block',
            background: M.primaryLight,
            color: M.primary,
            fontSize: 11,
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: 10,
            marginBottom: 8,
          }}
        >
          {level}
        </div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: M.text,
            lineHeight: 1.4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 11, color: M.textMuted, marginTop: 6 }}>
          {author ? `${author} · ` : ''}{duration}
          {typeof views === 'number' ? ` · ${views}회 시청` : ''}
        </div>
      </div>
    </button>
  );
}
