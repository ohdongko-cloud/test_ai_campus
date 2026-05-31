'use client';

import { M, gradient } from '../_styles/tokens';
import type { Video } from '../../../lib/types';
import { extractVideoId } from '../../../lib/utils';

interface Props {
  video: Video;
  views?: number;
  likes?: number;
  comments?: number;
  onClick: (v: Video) => void;
}

function youtubeThumb(youtubeUrl: string): string | null {
  const id = extractVideoId(youtubeUrl);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

export default function MobileVideoCard({ video, views, likes, comments, onClick }: Props) {
  const thumb = youtubeThumb(video.youtubeUrl);
  return (
    <button
      type="button"
      onClick={() => onClick(video)}
      style={{
        display: 'block',
        width: 'calc(100% - 32px)',
        margin: '0 16px 16px',
        padding: 0,
        border: `1px solid ${M.border}`,
        borderRadius: M.r4,
        background: M.surface,
        boxShadow: M.shadowSm,
        cursor: 'pointer',
        overflow: 'hidden',
        textAlign: 'left',
        fontFamily: M.fontKo,
      }}
    >
      {/* 썸네일 영역 */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          paddingTop: '56.25%', // 16:9
          background: thumb ? `url(${thumb}) center/cover no-repeat` : gradient(M.primaryDark, M.primary, 135),
        }}
      >
        {/* 재생 버튼 */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 56,
            height: 56,
            borderRadius: 28,
            background: 'rgba(255,255,255,0.92)',
            display: 'grid',
            placeItems: 'center',
            boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
          }}
        >
          <div
            style={{
              width: 0,
              height: 0,
              borderLeft: `14px solid ${M.primary}`,
              borderTop: '10px solid transparent',
              borderBottom: '10px solid transparent',
              marginLeft: 4,
            }}
          />
        </div>
      </div>

      {/* 정보 */}
      <div style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          <span
            style={{
              background: M.primaryLight,
              color: M.primary,
              fontSize: 11,
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: 10,
            }}
          >
            {video.level}
          </span>
        </div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: M.text,
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {video.title}
        </div>
        <div style={{ fontSize: 11, color: M.textMuted, marginTop: 10, display: 'flex', gap: 12 }}>
          <span>조회 {views ?? video.viewCount ?? 0}</span>
          {typeof likes === 'number' && <span>좋아요 {likes}</span>}
          {typeof comments === 'number' && <span>댓글 {comments}</span>}
        </div>
      </div>
    </button>
  );
}
