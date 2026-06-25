"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { Resource, ResourceComment } from '../lib/types';

// ────────────────────────────── 디자인 상수 ──────────────────────────────
const T = {
  primary: '#2563EB', primaryLight: '#EFF4FF', primaryBorder: '#BFDBFE',
  text: '#0F1E33', textBody: '#3B4A63', textMuted: '#6B7A90',
  border: '#E8EDF5', surface: '#FFFFFF', bg: '#F5F7FA',
  danger: '#D8364C', dangerBg: '#FEE2E2',
  success: '#16A34A',
  r: 8, r2: 12, r3: 16,
  shadow: '0 1px 4px rgba(0,0,0,0.06)',
  shadowMd: '0 4px 16px rgba(0,0,0,0.08)',
};

// ────────────────────────────── 유틸 ──────────────────────────────
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

// link_type 아이콘 + 라벨
function LinkTypeBadge({ type }: { type: 'drive' | 'notion' | 'url' }) {
  const map: Record<string, { icon: string; label: string; color: string; bg: string }> = {
    drive:  { icon: '📂', label: '구글 드라이브', color: '#1A73E8', bg: '#E8F0FE' },
    notion: { icon: '📝', label: 'Notion',        color: '#37352F', bg: '#F1F1EF' },
    url:    { icon: '🔗', label: '외부 링크',     color: '#2563EB', bg: '#EFF4FF' },
  };
  const m = map[type] ?? map.url;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
      color: m.color, background: m.bg,
    }}>
      {m.icon} {m.label}
    </span>
  );
}

function CategoryBadge({ cat }: { cat: string | null }) {
  if (!cat) return null;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
      color: '#7C3AED', background: '#EDE9FE',
    }}>
      {cat}
    </span>
  );
}

// ────────────────────────────── 댓글 섹션 ──────────────────────────────
function CommentSection({ resourceId }: { resourceId: string }) {
  const [comments, setComments] = useState<ResourceComment[]>([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());
  const [err, setErr] = useState('');

  const likeKey = '_res_liked_comments';

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
    <div style={{ marginTop: 20 }}>
      <h4 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: T.text }}>
        댓글 {comments.length}
      </h4>

      {loading ? (
        <p style={{ fontSize: 13, color: T.textMuted }}>댓글 불러오는 중...</p>
      ) : comments.length === 0 ? (
        <p style={{ fontSize: 13, color: T.textMuted }}>첫 번째 댓글을 남겨보세요.</p>
      ) : (
        <div>
          {comments.map(c => (
            <div key={c.id} style={{ padding: '12px 0', borderTop: `1px solid ${T.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: '0 0 6px', fontSize: 13, color: T.textBody, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {c.content}
                  </p>
                  <div style={{ display: 'flex', gap: 12, fontSize: 12, color: T.textMuted, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, color: T.textBody }}>{c.author_name}</span>
                    <span>{relativeTime(c.created_at)}</span>
                    <button
                      onClick={() => handleCommentLike(c.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', color: likedComments.has(c.id) ? T.danger : T.textMuted, fontSize: 12, padding: 0 }}
                    >
                      {likedComments.has(c.id) ? '❤' : '♡'} {c.like_count}
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(c.id)}
                  style={{ padding: '3px 8px', borderRadius: 6, border: `1px solid ${T.border}`, background: T.surface, color: T.danger, fontSize: 11, cursor: 'pointer', flexShrink: 0, alignSelf: 'flex-start' }}
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 댓글 입력 */}
      <div style={{ marginTop: 14, background: T.bg, borderRadius: T.r2, padding: 14 }}>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="댓글을 입력하세요"
          rows={3}
          style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: T.r, padding: '9px 12px', fontSize: 13, outline: 'none', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box', background: T.surface, color: T.text }}
          onFocus={e => e.target.style.borderColor = T.primary}
          onBlur={e => e.target.style.borderColor = T.border}
        />
        {err && <p style={{ margin: '4px 0 0', fontSize: 12, color: T.danger }}>{err}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button
            onClick={submit}
            disabled={submitting || !content.trim()}
            style={{ padding: '8px 18px', borderRadius: T.r, border: 'none', background: content.trim() ? T.primary : '#CBD5E1', color: '#fff', fontSize: 13, fontWeight: 600, cursor: content.trim() ? 'pointer' : 'not-allowed' }}
          >
            {submitting ? '...' : '댓글 작성'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────── 자료 카드 ──────────────────────────────
function ResourceCard({ item }: { item: Resource }) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(item.like_count);
  const [showComments, setShowComments] = useState(false);
  const [viewCounted, setViewCounted] = useState(false);
  const viewRef = useRef(false);

  useEffect(() => {
    setLiked(getLikedSet('_res_liked').has(item.id));
  }, [item.id]);

  const handleOpen = async () => {
    window.open(item.external_url, '_blank', 'noopener,noreferrer');
    // 조회수는 최초 1회만 (렌더 루프 방지: ref 가드)
    if (viewRef.current || viewCounted) return;
    viewRef.current = true;
    setViewCounted(true);
    try {
      await fetch(`/api/resources/${item.id}/view`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch { /* ignore */ }
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikeCount(c => c + (nextLiked ? 1 : -1));
    const next = getLikedSet('_res_liked');
    nextLiked ? next.add(item.id) : next.delete(item.id);
    saveLikedSet('_res_liked', next);
    try {
      await fetch(`/api/resources/${item.id}/like`, {
        method: nextLiked ? 'POST' : 'DELETE',
        credentials: 'include',
      });
    } catch { /* ignore */ }
  };

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r2, overflow: 'hidden', boxShadow: T.shadow }}>
      {/* 카드 본문 */}
      <div
        style={{ padding: '18px 20px', cursor: 'pointer' }}
        onClick={handleOpen}
        onMouseEnter={e => (e.currentTarget.style.background = T.bg)}
        onMouseLeave={e => (e.currentTarget.style.background = T.surface)}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, justifyContent: 'space-between' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* 배지 행 */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
              {item.is_pinned && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 6, fontSize: 11, fontWeight: 700, color: '#D97706', background: '#FEF3C7' }}>
                  📌 고정
                </span>
              )}
              <CategoryBadge cat={item.category} />
              <LinkTypeBadge type={item.link_type} />
            </div>
            {/* 제목 */}
            <h3 style={{
              margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: T.text, letterSpacing: '-0.01em',
              display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden',
            }}>
              {item.title}
            </h3>
            {/* 설명 (2줄 말줄임) */}
            {item.description && (
              <p style={{
                margin: '0 0 10px', fontSize: 13.5, color: T.textBody, lineHeight: 1.55,
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden',
              }}>
                {item.description}
              </p>
            )}
            {/* 메타 */}
            <div style={{ display: 'flex', gap: 14, fontSize: 12, color: T.textMuted, flexWrap: 'wrap' }}>
              <span>조회 {item.view_count}</span>
              <span>❤ {likeCount}</span>
              <span>💬 {item.comment_count}</span>
              <span>{new Date(item.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
            </div>
          </div>
          {/* 외부 링크 열기 화살표 */}
          <div style={{ flexShrink: 0, color: T.textMuted, fontSize: 18, marginTop: 2 }}>↗</div>
        </div>
      </div>

      {/* 액션 행 */}
      <div style={{ padding: '10px 20px', borderTop: `1px solid ${T.border}`, background: T.bg, display: 'flex', gap: 8 }}>
        <button
          onClick={handleLike}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: T.r, border: `1.5px solid ${liked ? '#FECACA' : T.border}`, background: liked ? T.dangerBg : T.surface, color: liked ? T.danger : T.textMuted, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          {liked ? '❤' : '♡'} 좋아요 {likeCount}
        </button>
        <button
          onClick={() => setShowComments(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: T.r, border: `1.5px solid ${showComments ? T.primaryBorder : T.border}`, background: showComments ? T.primaryLight : T.surface, color: showComments ? T.primary : T.textMuted, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          💬 댓글 {item.comment_count}
        </button>
      </div>

      {/* 댓글 펼침 */}
      {showComments && (
        <div style={{ padding: '0 20px 20px', borderTop: `1px solid ${T.border}` }}>
          <CommentSection resourceId={item.id} />
        </div>
      )}
    </div>
  );
}

// ────────────────────────────── 메인 ResourcesPage ──────────────────────────────
export default function ResourcesPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('');
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
        setError(json.error || '자료실을 불러오지 못했습니다.');
        setLoading(false);
        return;
      }
      const data: Resource[] = await res.json();
      setResources(data);

      // 전체 목록에서 카테고리 추출 (처음 로드 시만)
      if (!cat) {
        const cats = Array.from(new Set(data.map(r => r.category).filter((c): c is string => !!c)));
        setCategories(cats);
      }
    } catch {
      setError('서버에 연결할 수 없습니다.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load(activeCategory);
  }, [load, activeCategory]);

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 24px 64px' }}>
      {/* 헤더 */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 4 }}>홈 › 자료실</div>
        <h1 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 700, color: T.text, letterSpacing: '-0.02em' }}>자료실</h1>
        <p style={{ margin: 0, fontSize: 13, color: T.textMuted }}>
          AI 학습에 도움이 되는 자료를 모아두었습니다. 클릭하면 자료가 새 탭에서 열립니다.
        </p>
      </div>

      {/* 카테고리 필터 */}
      {categories.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {(['', ...categories] as const).map(cat => (
            <button
              key={cat || '__all__'}
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: '6px 14px', borderRadius: T.r, fontSize: 13,
                fontWeight: activeCategory === cat ? 600 : 400,
                border: `1.5px solid ${activeCategory === cat ? T.primaryBorder : T.border}`,
                background: activeCategory === cat ? T.primaryLight : T.surface,
                color: activeCategory === cat ? T.primary : T.textMuted,
                cursor: 'pointer',
              }}
            >
              {cat || '전체'}
            </button>
          ))}
        </div>
      )}

      {/* 목록 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '64px 0', color: T.textMuted, fontSize: 14 }}>불러오는 중...</div>
      ) : error ? (
        <div style={{ background: T.dangerBg, border: `1px solid #FECACA`, borderRadius: T.r2, padding: '20px 24px', color: T.danger, fontSize: 14, textAlign: 'center' }}>
          {error}
        </div>
      ) : resources.length === 0 ? (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r2, padding: '56px 24px', textAlign: 'center', boxShadow: T.shadow }}>
          <p style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: T.text }}>
            {activeCategory ? `'${activeCategory}' 카테고리에 자료가 없습니다` : '등록된 자료가 없습니다'}
          </p>
          <p style={{ margin: 0, fontSize: 13, color: T.textMuted }}>곧 새로운 자료가 추가될 예정입니다.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {resources.map(r => (
            <ResourceCard key={r.id} item={r} />
          ))}
        </div>
      )}
    </div>
  );
}
