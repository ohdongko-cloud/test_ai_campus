'use client';

import { M } from '../_styles/tokens';
import type { Post } from '../../../lib/types';

interface Props {
  post: Post;
  author?: string;
  org?: string;
  onClick: (p: Post) => void;
}

function isNew(createdAt: string): boolean {
  try {
    return Date.now() - new Date(createdAt).getTime() < 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function relativeTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60_000);
    if (m < 60) return `${Math.max(m, 1)}분 전`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}시간 전`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}일 전`;
    return new Date(iso).toLocaleDateString('ko-KR');
  } catch {
    return '';
  }
}

export default function MobilePostCard({ post, author, org, onClick }: Props) {
  const newBadge = isNew(post.created_at);
  return (
    <button
      type="button"
      onClick={() => onClick(post)}
      style={{
        display: 'block',
        width: 'calc(100% - 32px)',
        margin: '0 16px 12px',
        padding: 16,
        border: `1px solid ${M.border}`,
        borderRadius: M.r3,
        background: M.surface,
        boxShadow: M.shadowSm,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: M.fontKo,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        {newBadge && (
          <span
            style={{
              background: M.accent,
              color: '#fff',
              fontSize: 10,
              fontWeight: 800,
              padding: '3px 8px',
              borderRadius: 8,
              letterSpacing: '0.04em',
              fontFamily: M.fontEn,
            }}
          >
            NEW
          </span>
        )}
        <div
          style={{
            flex: 1,
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
          {post.title}
        </div>
      </div>

      <div style={{ fontSize: 12, color: M.textBody, marginBottom: 4 }}>
        {author ? `${author}${org ? ` · ${org}` : ''}` : '익명'}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <span style={{ fontSize: 11, color: M.textMuted }}>{relativeTime(post.created_at)}</span>
        <span style={{ fontSize: 11, color: M.textMuted, display: 'flex', gap: 10 }}>
          <span>조회 {post.views_count}</span>
          <span>댓글 {post.comments_count}</span>
          <span>좋아요 {post.likes_count}</span>
        </span>
      </div>
    </button>
  );
}
