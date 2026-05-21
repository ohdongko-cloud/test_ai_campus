"use client";

import { useState, useEffect, useCallback } from 'react';
import { Post, Comment } from '../lib/types';

// ────────────────────────────── 유틸 ──────────────────────────────
function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem('_board_session');
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('_board_session', id); }
  return id;
}
function getLikedSet(key: string): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')); } catch { return new Set(); }
}
function saveLikedSet(key: string, set: Set<string>) {
  localStorage.setItem(key, JSON.stringify([...set]));
}
function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

// ────────────────────────────── 디자인 상수 ──────────────────────────────
const T = {
  primary: '#2563EB', primaryLight: '#EFF4FF', primaryBorder: '#BFDBFE',
  text: '#0F1E33', textBody: '#3B4A63', textMuted: '#6B7A90',
  border: '#E8EDF5', surface: '#FFFFFF', bg: '#F5F7FA',
  danger: '#D8364C', dangerBg: '#FEE2E2',
  success: '#16A34A', successBg: '#DCFCE7',
  r: 8, r2: 12, r3: 16,
  shadow: '0 1px 4px rgba(0,0,0,0.06)',
  shadowMd: '0 4px 16px rgba(0,0,0,0.08)',
};

// ────────────────────────────── 비밀번호 모달 ──────────────────────────────
function PwModal({ title, onConfirm, onClose }: {
  title: string;
  onConfirm: (pw: string) => Promise<string | null>;
  onClose: () => void;
}) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    if (!pw) { setErr('비밀번호를 입력해주세요.'); return; }
    setLoading(true);
    const error = await onConfirm(pw);
    setLoading(false);
    if (error) setErr(error);
  };
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(15,30,51,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}>
      <div style={{ background: T.surface, borderRadius: T.r3, padding: 28, width: '100%', maxWidth: 360, boxShadow: T.shadowMd }}
        onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: T.text }}>{title}</h3>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: T.textMuted }}>작성 시 설정한 비밀번호를 입력하세요.</p>
        <input type="password" value={pw} onChange={e => { setPw(e.target.value); setErr(''); }}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="비밀번호"
          style={{ width: '100%', border: `1.5px solid ${err ? T.danger : T.border}`, borderRadius: T.r, padding: '9px 12px', fontSize: 13, color: T.text, outline: 'none', boxSizing: 'border-box' }}
          autoFocus />
        {err && <p style={{ margin: '6px 0 0', fontSize: 12, color: T.danger }}>{err}</p>}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={submit} disabled={loading}
            style={{ flex: 1, padding: '9px 0', borderRadius: T.r, border: 'none', background: T.primary, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {loading ? '확인 중...' : '확인'}
          </button>
          <button onClick={onClose}
            style={{ flex: 1, padding: '9px 0', borderRadius: T.r, border: `1.5px solid ${T.border}`, background: T.surface, color: T.textBody, fontSize: 13, cursor: 'pointer' }}>
            취소
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────── 게시글 목록 ──────────────────────────────
function PostList({ onWrite, onSelect }: { onWrite: () => void; onSelect: (id: string) => void }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [sort, setSort] = useState<'latest' | 'popular'>('latest');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/posts?sort=${sort}`);
    if (res.ok) setPosts(await res.json());
    setLoading(false);
  }, [sort]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 24px 64px' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 4 }}>홈 › 게시판</div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: T.text, letterSpacing: '-0.02em' }}>게시판</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: T.textMuted }}>익명으로 자유롭게 질문하고 소통하세요.</p>
        </div>
        <button onClick={onWrite}
          style={{ padding: '9px 20px', borderRadius: T.r, border: 'none', background: T.primary, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          글쓰기
        </button>
      </div>

      {/* 정렬 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['latest', 'popular'] as const).map(s => (
          <button key={s} onClick={() => setSort(s)}
            style={{ padding: '6px 14px', borderRadius: T.r, fontSize: 13, fontWeight: sort === s ? 600 : 400, border: `1.5px solid ${sort === s ? T.primaryBorder : T.border}`, background: sort === s ? T.primaryLight : T.surface, color: sort === s ? T.primary : T.textMuted, cursor: 'pointer' }}>
            {s === 'latest' ? '최신순' : '인기순'}
          </button>
        ))}
      </div>

      {/* 목록 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: T.textMuted, fontSize: 14 }}>불러오는 중...</div>
      ) : posts.length === 0 ? (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r2, padding: '48px 24px', textAlign: 'center', boxShadow: T.shadow }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: T.text, marginBottom: 4 }}>아직 게시글이 없습니다</p>
          <p style={{ margin: 0, fontSize: 13, color: T.textMuted }}>첫 번째 글을 작성해보세요!</p>
        </div>
      ) : (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r2, overflow: 'hidden', boxShadow: T.shadow }}>
          {posts.map((p, idx) => (
            <div key={p.id} onClick={() => onSelect(p.id)}
              style={{ padding: '16px 20px', borderBottom: idx < posts.length - 1 ? `1px solid ${T.border}` : 'none', cursor: 'pointer', transition: 'background .12s' }}
              onMouseEnter={e => (e.currentTarget.style.background = T.bg)}
              onMouseLeave={e => (e.currentTarget.style.background = T.surface)}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, justifyContent: 'space-between' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: T.text, letterSpacing: '-0.01em', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>
                    {p.title}
                  </span>
                  {p.link && <span style={{ marginLeft: 6, fontSize: 11, color: T.primary, background: T.primaryLight, padding: '1px 6px', borderRadius: 4 }}>링크</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 14, marginTop: 6, fontSize: 12, color: T.textMuted }}>
                <span>익명</span>
                <span>{relativeTime(p.created_at)}</span>
                <span>조회 {p.views_count}</span>
                <span>❤ {p.likes_count}</span>
                <span>💬 {p.comments_count}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────── 글쓰기 폼 ──────────────────────────────
function WriteForm({ onBack, editPost }: { onBack: (newId?: string) => void; editPost?: Post }) {
  const [title, setTitle]     = useState(editPost?.title || '');
  const [content, setContent] = useState(editPost?.content || '');
  const [link, setLink]       = useState(editPost?.link || '');
  const [password, setPassword] = useState('');
  const [err, setErr]         = useState('');
  const [loading, setLoading] = useState(false);
  const isEdit = !!editPost;

  const submit = async () => {
    if (!title.trim() || !content.trim()) { setErr('제목과 내용을 입력해주세요.'); return; }
    setLoading(true);
    setErr('');
    if (isEdit) {
      const res = await fetch(`/api/posts/${editPost!.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, content, link, password }) });
      const json = await res.json();
      if (!res.ok) { setErr(json.error || '오류가 발생했습니다.'); setLoading(false); return; }
      onBack(editPost!.id);
    } else {
      const res = await fetch('/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, content, link, password }) });
      const json = await res.json();
      if (!res.ok) { setErr(json.error || '오류가 발생했습니다.'); setLoading(false); return; }
      onBack(json.id);
    }
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px 64px' }}>
      <button onClick={() => onBack()} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: T.textMuted, fontSize: 13, cursor: 'pointer', marginBottom: 24, padding: 0 }}>
        ← 목록으로
      </button>
      <h2 style={{ margin: '0 0 24px', fontSize: 22, fontWeight: 700, color: T.text, letterSpacing: '-0.02em' }}>
        {isEdit ? '게시글 수정' : '게시글 작성'}
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* 제목 */}
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 6 }}>
            제목 <span style={{ color: T.danger }}>*</span>
          </label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="제목을 입력하세요"
            style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: T.r, padding: '10px 14px', fontSize: 14, color: T.text, outline: 'none', boxSizing: 'border-box' }}
            onFocus={e => e.target.style.borderColor = T.primary} onBlur={e => e.target.style.borderColor = T.border} />
        </div>

        {/* 내용 */}
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 6 }}>
            내용 <span style={{ color: T.danger }}>*</span>
          </label>
          <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="내용을 입력하세요" rows={10}
            style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: T.r, padding: '10px 14px', fontSize: 14, color: T.text, outline: 'none', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6, boxSizing: 'border-box' }}
            onFocus={e => e.target.style.borderColor = T.primary} onBlur={e => e.target.style.borderColor = T.border} />
        </div>

        {/* 링크 */}
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 6 }}>
            첨부 링크 <span style={{ color: T.textMuted, fontWeight: 400 }}>(선택)</span>
          </label>
          <input value={link} onChange={e => setLink(e.target.value)} placeholder="https://..."
            style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: T.r, padding: '10px 14px', fontSize: 14, color: T.text, outline: 'none', boxSizing: 'border-box' }}
            onFocus={e => e.target.style.borderColor = T.primary} onBlur={e => e.target.style.borderColor = T.border} />
        </div>

        {/* 비밀번호 */}
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 6 }}>
            비밀번호 <span style={{ color: T.textMuted, fontWeight: 400 }}>(선택)</span>
          </label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="수정·삭제 시 필요합니다"
            style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: T.r, padding: '10px 14px', fontSize: 14, color: T.text, outline: 'none', boxSizing: 'border-box' }}
            onFocus={e => e.target.style.borderColor = T.primary} onBlur={e => e.target.style.borderColor = T.border} />
          {!password && !isEdit && (
            <p style={{ margin: '6px 0 0', fontSize: 12, color: '#B45309', background: '#FFFBEB', border: '1px solid #FDE68A', padding: '6px 10px', borderRadius: 6 }}>
              ⚠️ 비밀번호를 설정하지 않으면 게시 후 수정·삭제가 불가능합니다.
            </p>
          )}
        </div>

        {err && <p style={{ margin: 0, fontSize: 13, color: T.danger, background: T.dangerBg, padding: '8px 12px', borderRadius: T.r }}>{err}</p>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={() => onBack()}
            style={{ padding: '10px 20px', borderRadius: T.r, border: `1.5px solid ${T.border}`, background: T.surface, color: T.textBody, fontSize: 13, cursor: 'pointer' }}>
            취소
          </button>
          <button onClick={submit} disabled={loading}
            style={{ padding: '10px 24px', borderRadius: T.r, border: 'none', background: T.primary, color: '#fff', fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? '저장 중...' : isEdit ? '수정 완료' : '게시하기'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────── 댓글 컴포넌트 ──────────────────────────────
function CommentSection({ postId }: { postId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [content, setContent]   = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());
  const [pwModal, setPwModal]   = useState<{ id: string; action: 'edit' | 'delete'; editContent?: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const load = useCallback(async () => {
    const res = await fetch(`/api/comments?postId=${postId}`);
    if (res.ok) setComments(await res.json());
  }, [postId]);

  useEffect(() => {
    load();
    setLikedComments(getLikedSet('_liked_comments'));
  }, [load]);

  const submit = async () => {
    if (!content.trim()) return;
    setLoading(true);
    await fetch('/api/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId, content, password }) });
    setContent(''); setPassword('');
    await load();
    setLoading(false);
  };

  const handleLike = async (id: string) => {
    const liked = likedComments.has(id);
    const action = liked ? 'unlike' : 'like';
    const res = await fetch(`/api/comments/${id}/like`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: getSessionId(), action }) });
    if (res.ok) {
      const json = await res.json();
      setComments(prev => prev.map(c => c.id === id ? { ...c, likes_count: json.likes_count } : c));
      const next = new Set(likedComments);
      liked ? next.delete(id) : next.add(id);
      setLikedComments(next);
      saveLikedSet('_liked_comments', next);
    }
  };

  const handleDelete = async (pw: string) => {
    if (!pwModal) return null;
    const res = await fetch(`/api/comments/${pwModal.id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) });
    const json = await res.json();
    if (!res.ok) return json.error;
    setPwModal(null); await load(); return null;
  };

  const handleEdit = async (pw: string) => {
    if (!pwModal) return null;
    const res = await fetch(`/api/comments/${pwModal.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: editContent, password: pw }) });
    const json = await res.json();
    if (!res.ok) return json.error;
    setPwModal(null); setEditingId(null); await load(); return null;
  };

  const visibleComments = comments.filter(c => !c.is_deleted);

  return (
    <div style={{ marginTop: 32 }}>
      <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700, color: T.text }}>댓글 {visibleComments.length}</h3>

      {/* 댓글 목록 */}
      {visibleComments.map(c => (
        <div key={c.id} style={{ padding: '16px 0', borderTop: `1px solid ${T.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ flex: 1 }}>
              {editingId === c.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={3}
                    style={{ width: '100%', border: `1.5px solid ${T.primary}`, borderRadius: T.r, padding: '8px 12px', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => { setPwModal({ id: c.id, action: 'edit' }); }}
                      style={{ padding: '6px 14px', borderRadius: T.r, border: 'none', background: T.primary, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>수정 저장</button>
                    <button onClick={() => setEditingId(null)}
                      style={{ padding: '6px 14px', borderRadius: T.r, border: `1px solid ${T.border}`, background: T.surface, color: T.textBody, fontSize: 12, cursor: 'pointer' }}>취소</button>
                  </div>
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: 14, color: T.textBody, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{c.content}</p>
              )}
              <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 12, color: T.textMuted, alignItems: 'center' }}>
                <span>익명</span>
                <span>{relativeTime(c.created_at)}</span>
                <button onClick={() => handleLike(c.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', color: likedComments.has(c.id) ? T.danger : T.textMuted, fontSize: 12, padding: 0 }}>
                  {likedComments.has(c.id) ? '❤' : '♡'} {c.likes_count}
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <button onClick={() => { setEditingId(c.id); setEditContent(c.content); }}
                style={{ padding: '3px 8px', borderRadius: 6, border: `1px solid ${T.border}`, background: T.surface, color: T.textMuted, fontSize: 11, cursor: 'pointer' }}>수정</button>
              <button onClick={() => setPwModal({ id: c.id, action: 'delete' })}
                style={{ padding: '3px 8px', borderRadius: 6, border: `1px solid ${T.border}`, background: T.surface, color: T.danger, fontSize: 11, cursor: 'pointer' }}>삭제</button>
            </div>
          </div>
        </div>
      ))}

      {/* 댓글 입력 */}
      <div style={{ marginTop: 20, background: T.bg, borderRadius: T.r2, padding: 16 }}>
        <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="댓글을 입력하세요" rows={3}
          style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: T.r, padding: '10px 12px', fontSize: 13, outline: 'none', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box', background: T.surface }}
          onFocus={e => e.target.style.borderColor = T.primary} onBlur={e => e.target.style.borderColor = T.border} />
        <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="비밀번호 (선택, 수정·삭제용)"
            style={{ flex: '0 0 220px', border: `1.5px solid ${T.border}`, borderRadius: T.r, padding: '8px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          <button onClick={submit} disabled={loading || !content.trim()}
            style={{ padding: '9px 20px', borderRadius: T.r, border: 'none', background: content.trim() ? T.primary : '#CBD5E1', color: '#fff', fontSize: 13, fontWeight: 600, cursor: content.trim() ? 'pointer' : 'not-allowed' }}>
            {loading ? '...' : '댓글 작성'}
          </button>
        </div>
      </div>

      {/* 비밀번호 모달 */}
      {pwModal && (
        <PwModal
          title={pwModal.action === 'delete' ? '댓글 삭제' : '댓글 수정'}
          onConfirm={pwModal.action === 'delete' ? handleDelete : handleEdit}
          onClose={() => { setPwModal(null); setEditingId(null); }}
        />
      )}
    </div>
  );
}

// ────────────────────────────── 게시글 상세 ──────────────────────────────
function PostDetail({ id, onBack, onEdit }: { id: string; onBack: () => void; onEdit: (post: Post) => void }) {
  const [post, setPost]   = useState<Post | null>(null);
  const [liked, setLiked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pwModal, setPwModal] = useState<'edit' | 'delete' | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/posts/${id}`);
    if (res.ok) setPost(await res.json());
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
    setLiked(getLikedSet('_liked_posts').has(id));
  }, [load, id]);

  const handleLike = async () => {
    if (!post) return;
    const action = liked ? 'unlike' : 'like';
    const res = await fetch(`/api/posts/${id}/like`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: getSessionId(), action }) });
    if (res.ok) {
      const json = await res.json();
      setPost(p => p ? { ...p, likes_count: json.likes_count } : p);
      const next = getLikedSet('_liked_posts');
      liked ? next.delete(id) : next.add(id);
      setLiked(!liked);
      saveLikedSet('_liked_posts', next);
    }
  };

  const handleDelete = async (pw: string) => {
    const res = await fetch(`/api/posts/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) });
    const json = await res.json();
    if (!res.ok) return json.error;
    setPwModal(null); onBack(); return null;
  };

  const handleEditVerify = async (pw: string) => {
    // 비밀번호 확인만 (실제 수정은 WriteForm에서)
    const res = await fetch(`/api/posts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: post!.title, content: post!.content, link: post!.link, password: pw }) });
    const json = await res.json();
    if (!res.ok) return json.error;
    setPwModal(null); onEdit(post!); return null;
  };

  if (loading) return <div style={{ padding: '80px 24px', textAlign: 'center', color: T.textMuted }}>불러오는 중...</div>;
  if (!post) return <div style={{ padding: '80px 24px', textAlign: 'center', color: T.textMuted }}>게시글을 찾을 수 없습니다.</div>;

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 24px 64px' }}>
      <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: T.textMuted, fontSize: 13, cursor: 'pointer', marginBottom: 24, padding: 0 }}>
        ← 목록으로
      </button>

      {/* 게시글 헤더 */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r2, padding: '24px 28px', boxShadow: T.shadow }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 700, color: T.text, letterSpacing: '-0.02em', lineHeight: 1.4 }}>{post.title}</h2>
        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: T.textMuted, marginBottom: 20, flexWrap: 'wrap' }}>
          <span>익명</span>
          <span>{relativeTime(post.created_at)}</span>
          <span>조회 {post.views_count}</span>
          <span>❤ {post.likes_count}</span>
          <span>💬 {post.comments_count}</span>
        </div>

        <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 20, marginBottom: 20 }}>
          <p style={{ margin: 0, fontSize: 15, color: T.textBody, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{post.content}</p>
        </div>

        {post.link && (
          <a href={post.link} target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: T.primary, background: T.primaryLight, padding: '6px 14px', borderRadius: T.r, textDecoration: 'none', border: `1px solid ${T.primaryBorder}` }}>
            🔗 첨부 링크 열기
          </a>
        )}

        {/* 액션 버튼 */}
        <div style={{ display: 'flex', gap: 8, marginTop: 20, paddingTop: 16, borderTop: `1px solid ${T.border}`, flexWrap: 'wrap' }}>
          <button onClick={handleLike}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: T.r, border: `1.5px solid ${liked ? '#FECACA' : T.border}`, background: liked ? T.dangerBg : T.surface, color: liked ? T.danger : T.textBody, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {liked ? '❤' : '♡'} 좋아요 {post.likes_count}
          </button>
          <button onClick={() => setPwModal('edit')}
            style={{ padding: '8px 16px', borderRadius: T.r, border: `1.5px solid ${T.border}`, background: T.surface, color: T.textMuted, fontSize: 13, cursor: 'pointer' }}>수정</button>
          <button onClick={() => setPwModal('delete')}
            style={{ padding: '8px 16px', borderRadius: T.r, border: `1.5px solid #FECACA`, background: T.dangerBg, color: T.danger, fontSize: 13, cursor: 'pointer' }}>삭제</button>
        </div>
      </div>

      {/* 댓글 */}
      <CommentSection postId={id} />

      {/* 비밀번호 모달 */}
      {pwModal === 'delete' && <PwModal title="게시글 삭제" onConfirm={handleDelete} onClose={() => setPwModal(null)} />}
      {pwModal === 'edit'   && <PwModal title="게시글 수정" onConfirm={handleEditVerify} onClose={() => setPwModal(null)} />}
    </div>
  );
}

// ────────────────────────────── 메인 BoardPage ──────────────────────────────
type View = { type: 'list' } | { type: 'write' } | { type: 'detail'; id: string } | { type: 'edit'; post: Post };

export default function BoardPage() {
  const [view, setView] = useState<View>({ type: 'list' });

  if (view.type === 'write') {
    return <WriteForm onBack={(newId) => setView(newId ? { type: 'detail', id: newId } : { type: 'list' })} />;
  }
  if (view.type === 'edit') {
    return <WriteForm editPost={view.post} onBack={(id) => setView(id ? { type: 'detail', id } : { type: 'list' })} />;
  }
  if (view.type === 'detail') {
    return <PostDetail id={view.id} onBack={() => setView({ type: 'list' })} onEdit={(post) => setView({ type: 'edit', post })} />;
  }
  return <PostList onWrite={() => setView({ type: 'write' })} onSelect={(id) => setView({ type: 'detail', id })} />;
}
