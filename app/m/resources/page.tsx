'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { M } from '../_styles/tokens';
import MobileHeader from '../_components/MobileHeader';
import type { Resource, ResourceComment } from '../../../lib/types';

// ── 유틸 ──────────────────────────────────────────────────────────
function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}
function getLikedSet(key: string): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')); } catch { return new Set(); }
}
function saveLikedSet(key: string, set: Set<string>) {
  localStorage.setItem(key, JSON.stringify([...set]));
}

const LINK_ICON: Record<string, string> = { drive: '📂', notion: '📝', url: '🔗' };
const LINK_LABEL: Record<string, string> = { drive: '구글 드라이브', notion: 'Notion', url: '외부 링크' };

// ── 댓글 섹션 ─────────────────────────────────────────────────────
function CommentSection({ resourceId }: { resourceId: string }) {
  const [comments, setComments] = useState<ResourceComment[]>([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());
  const [err, setErr] = useState('');

  const likeKey = '_mres_liked_comments';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/resources/${resourceId}/comments`, { credentials: 'include' });
      if (res.ok) setComments(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, [resourceId]);

  useEffect(() => {
    load();
    setLikedComments(getLikedSet(likeKey));
  }, [load]);

  const submit = async () => {
    const text = content.trim();
    if (!text) return;
    setSubmitting(true);
    setErr('');
    try {
      const res = await fetch(`/api/resources/${resourceId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content: text }),
      });
      const json = await res.json();
      if (!res.ok) { setErr(json.error || '서버 오류가 발생했습니다.'); setSubmitting(false); return; }
      setContent('');
      await load();
    } catch {
      setErr('서버 오류가 발생했습니다.');
    }
    setSubmitting(false);
  };

  const handleCommentLike = async (id: string) => {
    const liked = likedComments.has(id);
    try {
      const res = await fetch(`/api/resources/comments/${id}/like`, {
        method: liked ? 'DELETE' : 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        setComments(prev => prev.map(c => c.id === id ? { ...c, like_count: json.like_count } : c));
        const next = new Set(likedComments);
        liked ? next.delete(id) : next.add(id);
        setLikedComments(next);
        saveLikedSet(likeKey, next);
      }
    } catch { /* ignore */ }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('댓글을 삭제할까요?')) return;
    try {
      const res = await fetch(`/api/resources/comments/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) await load();
    } catch { /* ignore */ }
  };

  return (
    <div style={{ marginTop: 16 }}>
      <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: M.text, fontFamily: M.fontKo }}>
        댓글 {comments.length}
      </p>

      {loading ? (
        <p style={{ fontSize: 12, color: M.textMuted, fontFamily: M.fontKo }}>로딩 중...</p>
      ) : comments.length === 0 ? (
        <p style={{ fontSize: 12, color: M.textMuted, fontFamily: M.fontKo }}>첫 번째 댓글을 남겨보세요.</p>
      ) : (
        <div>
          {comments.map(c => (
            <div key={c.id} style={{ padding: '10px 0', borderTop: `1px solid ${M.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: '0 0 4px', fontSize: 13, color: M.textBody, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: M.fontKo }}>
                    {c.content}
                  </p>
                  <div style={{ display: 'flex', gap: 10, fontSize: 11, color: M.textMuted, fontFamily: M.fontKo, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, color: M.textBody }}>{c.author_name}</span>
                    <span>{relativeTime(c.created_at)}</span>
                    <button
                      onClick={() => handleCommentLike(c.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'none', border: 'none', cursor: 'pointer', color: likedComments.has(c.id) ? M.danger : M.textMuted, fontSize: 11, padding: 0, fontFamily: M.fontKo }}
                    >
                      {likedComments.has(c.id) ? '❤' : '♡'} {c.like_count}
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(c.id)}
                  style={{ padding: '2px 8px', borderRadius: 6, border: `1px solid ${M.border}`, background: M.surface, color: M.danger, fontSize: 11, cursor: 'pointer', flexShrink: 0, alignSelf: 'flex-start', fontFamily: M.fontKo }}
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 12, background: M.bg, borderRadius: M.r2, padding: 12 }}>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="댓글을 입력하세요"
          rows={3}
          style={{ width: '100%', border: `1.5px solid ${M.border}`, borderRadius: M.r1, padding: '8px 10px', fontSize: 13, outline: 'none', resize: 'none', fontFamily: M.fontKo, boxSizing: 'border-box', background: M.surface, color: M.text }}
        />
        {err && <p style={{ margin: '4px 0 0', fontSize: 12, color: M.danger, fontFamily: M.fontKo }}>{err}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button
            onClick={submit}
            disabled={submitting || !content.trim()}
            style={{ padding: '8px 16px', borderRadius: M.r1, border: 'none', background: content.trim() ? M.primary : M.border, color: '#fff', fontSize: 13, fontWeight: 600, cursor: content.trim() ? 'pointer' : 'not-allowed', fontFamily: M.fontKo }}
          >
            {submitting ? '...' : '작성'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 자료 카드 ──────────────────────────────────────────────────────
function ResourceCard({ item }: { item: Resource }) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(item.like_count);
  const [showComments, setShowComments] = useState(false);
  const viewRef = useRef(false);

  useEffect(() => {
    setLiked(getLikedSet('_mres_liked').has(item.id));
  }, [item.id]);

  const handleOpen = async () => {
    window.open(item.external_url, '_blank', 'noopener,noreferrer');
    if (viewRef.current) return;
    viewRef.current = true;
    try {
      await fetch(`/api/resources/${item.id}/view`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch { /* ignore */ }
  };

  const handleLike = async () => {
    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikeCount(c => c + (nextLiked ? 1 : -1));
    const next = getLikedSet('_mres_liked');
    nextLiked ? next.add(item.id) : next.delete(item.id);
    saveLikedSet('_mres_liked', next);
    try {
      await fetch(`/api/resources/${item.id}/like`, {
        method: nextLiked ? 'POST' : 'DELETE',
        credentials: 'include',
      });
    } catch { /* ignore */ }
  };

  return (
    <div
      style={{
        margin: '0 16px 12px',
        borderRadius: M.r3,
        border: `1px solid ${M.border}`,
        background: M.surface,
        overflow: 'hidden',
        boxShadow: M.shadowSm,
        fontFamily: M.fontKo,
      }}
    >
      {/* 카드 본문 — 탭해서 외부 링크 열기 */}
      <div
        onClick={handleOpen}
        style={{ padding: '16px', cursor: 'pointer', activeOpacity: 0.8 } as React.CSSProperties}
      >
        {/* 배지 */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
          {item.is_pinned && (
            <span style={{ padding: '1px 7px', borderRadius: 5, fontSize: 10, fontWeight: 700, color: '#D97706', background: '#FEF3C7' }}>
              📌 고정
            </span>
          )}
          {item.category && (
            <span style={{ padding: '1px 7px', borderRadius: 5, fontSize: 10, fontWeight: 600, color: '#7C3AED', background: '#EDE9FE' }}>
              {item.category}
            </span>
          )}
          <span style={{ padding: '1px 7px', borderRadius: 5, fontSize: 10, fontWeight: 600, color: '#1A73E8', background: '#E8F0FE' }}>
            {LINK_ICON[item.link_type] || '🔗'} {LINK_LABEL[item.link_type] || '링크'}
          </span>
        </div>

        {/* 제목 */}
        <div style={{
          fontSize: 15, fontWeight: 700, color: M.text, marginBottom: 6, letterSpacing: '-0.01em',
          display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden',
        }}>
          {item.title}
        </div>

        {/* 설명 2줄 */}
        {item.description && (
          <div style={{
            fontSize: 13, color: M.textBody, lineHeight: 1.55, marginBottom: 8,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden',
          }}>
            {item.description}
          </div>
        )}

        {/* 메타 */}
        <div style={{ display: 'flex', gap: 12, fontSize: 11, color: M.textMuted, flexWrap: 'wrap', alignItems: 'center' }}>
          <span>조회 {item.view_count}</span>
          <span>❤ {likeCount}</span>
          <span>💬 {item.comment_count}</span>
          <span style={{ marginLeft: 'auto', fontSize: 18, color: M.textMuted }}>↗</span>
        </div>
      </div>

      {/* 액션 행 */}
      <div style={{ padding: '10px 16px', borderTop: `1px solid ${M.border}`, background: M.bg, display: 'flex', gap: 8 }}>
        <button
          onClick={handleLike}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '7px 14px', borderRadius: M.r1,
            border: `1.5px solid ${liked ? '#FECACA' : M.border}`,
            background: liked ? '#FEE2E2' : M.surface,
            color: liked ? M.danger : M.textMuted,
            fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: M.fontKo,
          }}
        >
          {liked ? '❤' : '♡'} {likeCount}
        </button>
        <button
          onClick={() => setShowComments(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '7px 14px', borderRadius: M.r1,
            border: `1.5px solid ${showComments ? '#BFDBFE' : M.border}`,
            background: showComments ? '#EFF4FF' : M.surface,
            color: showComments ? M.primary : M.textMuted,
            fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: M.fontKo,
          }}
        >
          💬 {item.comment_count}
        </button>
      </div>

      {/* 댓글 펼침 */}
      {showComments && (
        <div style={{ padding: '0 16px 16px', borderTop: `1px solid ${M.border}` }}>
          <CommentSection resourceId={item.id} />
        </div>
      )}
    </div>
  );
}

// ── 스켈레톤 ──────────────────────────────────────────────────────
function Skeleton() {
  return (
    <>
      {[0, 1, 2].map(i => (
        <div key={i} style={{ margin: '0 16px 12px', borderRadius: M.r3, border: `1px solid ${M.border}`, background: M.surface, padding: 16 }}>
          <div style={{ height: 12, width: '50%', background: M.surfaceAlt, borderRadius: 4, marginBottom: 10 }} />
          <div style={{ height: 16, width: '80%', background: M.surfaceAlt, borderRadius: 4, marginBottom: 8 }} />
          <div style={{ height: 12, width: '65%', background: M.surfaceAlt, borderRadius: 4 }} />
        </div>
      ))}
    </>
  );
}

// ── 메인 ──────────────────────────────────────────────────────────
export default function MobileResourcesPage() {
  const router = useRouter();
  const [resources, setResources] = useState<Resource[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (cat: string) => {
    setLoading(true);
    setError('');
    try {
      const url = cat ? `/api/resources?category=${encodeURIComponent(cat)}` : '/api/resources';
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error || '자료를 불러오지 못했습니다.');
        setLoading(false);
        return;
      }
      const data: Resource[] = await res.json();
      setResources(data);
      if (!cat) {
        const cats = Array.from(new Set(data.map(r => r.category).filter((c): c is string => !!c)));
        setCategories(cats);
      }
    } catch {
      setError('서버에 연결할 수 없습니다.');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(activeCategory); }, [load, activeCategory]);

  return (
    <>
      <MobileHeader title="자료실" />
      <div
        style={{
          paddingTop: 16,
          paddingBottom: `calc(${M.tabBarH}px + env(safe-area-inset-bottom, 0px) + 16px)`,
          maxWidth: M.maxW,
          margin: '0 auto',
          fontFamily: M.fontKo,
        }}
      >
        {/* 카테고리 필터 */}
        {categories.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '0 16px 16px', overflowX: 'auto', paddingBottom: 2 }}>
            {(['', ...categories] as const).map(cat => (
              <button
                key={cat || '__all__'}
                onClick={() => setActiveCategory(cat)}
                style={{
                  padding: '6px 14px', borderRadius: M.r1, fontSize: 12, whiteSpace: 'nowrap',
                  fontWeight: activeCategory === cat ? 700 : 400,
                  border: `1.5px solid ${activeCategory === cat ? '#BFDBFE' : M.border}`,
                  background: activeCategory === cat ? '#EFF4FF' : M.surface,
                  color: activeCategory === cat ? M.primary : M.textMuted,
                  cursor: 'pointer', fontFamily: M.fontKo,
                }}
              >
                {cat || '전체'}
              </button>
            ))}
          </div>
        )}

        {/* 목록 */}
        {loading ? (
          <Skeleton />
        ) : error ? (
          <div style={{ margin: '0 16px', padding: 16, background: '#FEE2E2', color: M.danger, borderRadius: M.r3, fontSize: 13, textAlign: 'center', fontFamily: M.fontKo }}>
            {error}
          </div>
        ) : resources.length === 0 ? (
          <div style={{ margin: '0 16px', padding: '48px 16px', background: M.surface, border: `1px solid ${M.border}`, borderRadius: M.r3, textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: M.text }}>
              {activeCategory ? `'${activeCategory}' 자료 없음` : '등록된 자료가 없습니다'}
            </p>
            <p style={{ margin: '6px 0 0', fontSize: 12, color: M.textMuted }}>곧 새로운 자료가 추가될 예정입니다.</p>
          </div>
        ) : (
          resources.map(r => <ResourceCard key={r.id} item={r} />)
        )}
      </div>

      {/* 뒤로가기 버튼 */}
      <button
        type="button"
        aria-label="뒤로가기"
        onClick={() => router.back()}
        style={{
          position: 'fixed', left: 16,
          bottom: `calc(${M.tabBarH}px + env(safe-area-inset-bottom, 0px) + 16px)`,
          padding: '8px 16px', borderRadius: M.r2,
          background: M.surface, border: `1px solid ${M.border}`,
          color: M.textMuted, fontSize: 13, fontWeight: 500,
          cursor: 'pointer', boxShadow: M.shadowMd,
          fontFamily: M.fontKo, zIndex: 20,
        }}
      >
        ← 홈
      </button>
    </>
  );
}
