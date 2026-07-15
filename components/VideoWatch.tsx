"use client";

// 강의 영상 단독 페이지 본문 — /video/[id] 및 공유 링크용.
// 데스크톱 모달(components/VideoPage.tsx)의 시청 경험을 팝업이 아닌 페이지로 이식한다.
// 보호 기능(워터마크·우클릭/단축키 차단·외부이동 오버레이·FLAG_SECURE)을 그대로 포함.
// watermarkEmail=null 이면 비로그인 → 페이지 내 "로그인 후 시청" 게이트를 렌더한다.

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { Video, VideoStage, VideoComment } from '../lib/types';
import { extractVideoId, getSessionId } from '../lib/utils';
import { enableSecureScreen, disableSecureScreen } from '../lib/secureScreen';
import StageImageLightbox from './StageImageLightbox';

const T = {
  primary: '#004A99', primaryLight: '#E6EEF7', primarySoft: '#F0F5FB',
  secondary: '#FF914D', secondaryDark: '#E67835', secondaryLight: '#FFF1E6',
  bg: '#F5F7FA', surface: '#FFFFFF',
  text: '#0F1E33', textBody: '#3B4A63', textMuted: '#6B7A91', textFaint: '#9BA7BC',
  border: '#E5EAF1', borderStrong: '#D4DBE6',
  success: '#1E9E6A', successBg: '#E6F6EE',
  danger: '#D8364C', dangerBg: '#FCE6EA',
  r: 8, r2: 12, r3: 16,
  fontKo: '"Noto Sans KR", "Inter", system-ui, sans-serif',
};

interface AttachmentItem {
  id: string;
  filename: string;
  sizeBytes: number;
  mimeType: string;
  downloadCount: number;
}

interface Stats {
  likes_count: number;
  comments_count: number;
  liked: boolean;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${units[i]}`;
}

function iconFor(name: string): string {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (ext === 'pdf') return '📄';
  if (['doc', 'docx'].includes(ext)) return '📝';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return '📊';
  if (['ppt', 'pptx'].includes(ext)) return '📽';
  if (['zip', 'rar', '7z'].includes(ext)) return '🗜';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return '🖼';
  return '📎';
}

function youtubeThumb(youtubeUrl: string): string | null {
  const id = extractVideoId(youtubeUrl);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

type Tab = 'info' | 'stages' | 'files' | 'comments';

export default function VideoWatch({ video, watermarkEmail }: { video: Video; watermarkEmail: string | null }) {
  const loggedIn = !!watermarkEmail;
  const youtubeId = useMemo(() => extractVideoId(video.youtubeUrl), [video.youtubeUrl]);
  const stages: VideoStage[] = video.stages || [];

  const [tab, setTab] = useState<Tab>(stages.length > 0 ? 'stages' : 'info');
  const [openStageIdx, setOpenStageIdx] = useState<number | null>(stages.length > 0 ? 0 : null);
  const [copiedStageIdx, setCopiedStageIdx] = useState<number | null>(null);
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);

  const [wmPosToggle, setWmPosToggle] = useState(0);
  const [externalLinkBlocked, setExternalLinkBlocked] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const videoAreaRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [stats, setStats] = useState<Stats>({ likes_count: 0, comments_count: 0, liked: false });
  const [likeBusy, setLikeBusy] = useState(false);

  const [comments, setComments] = useState<VideoComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [attachments, setAttachments] = useState<AttachmentItem[] | null>(null);
  const [attachmentsErr, setAttachmentsErr] = useState('');

  // ── 조회수 +1 (로그인 시, best effort) ──
  useEffect(() => {
    if (!loggedIn) return;
    fetch(`/api/videos/${encodeURIComponent(video.id)}/view`, { method: 'POST' }).catch(() => {});
  }, [loggedIn, video.id]);

  // ── FLAG_SECURE ──
  useEffect(() => {
    if (!loggedIn) return;
    enableSecureScreen();
    return () => { disableSecureScreen(); };
  }, [loggedIn]);

  // ── 워터마크 위치 30초 swap ──
  useEffect(() => {
    if (!loggedIn) return;
    const id = window.setInterval(() => setWmPosToggle(v => (v === 0 ? 1 : 0)), 30_000);
    return () => window.clearInterval(id);
  }, [loggedIn]);

  // ── YouTube IFrame API onReady → hd1080 요청 ──
  useEffect(() => {
    if (!loggedIn) return;
    const handler = (e: MessageEvent) => {
      if (!e.origin.includes('youtube.com')) return;
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (data?.event === 'onReady') {
          const cmd = (func: string) =>
            iframeRef.current?.contentWindow?.postMessage(
              JSON.stringify({ event: 'command', func, args: ['hd1080'] }),
              'https://www.youtube.com'
            );
          cmd('setPlaybackQuality');
          cmd('setSuggestedQuality');
        }
      } catch { /* ignore */ }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [loggedIn]);

  // ── 전체화면 sync ──
  useEffect(() => {
    const h = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  // ── 통계(좋아요/댓글수) + 댓글 로드 ──
  useEffect(() => {
    if (!loggedIn) return;
    const sid = getSessionId();
    fetch(`/api/videos/stats?ids=${encodeURIComponent(video.id)}&sessionId=${encodeURIComponent(sid)}`)
      .then(r => r.ok ? r.json() : [])
      .then((rows: Array<{ video_id: string; likes_count: number; comments_count: number; liked: boolean }>) => {
        const row = rows.find(x => x.video_id === video.id);
        if (row) setStats({ likes_count: row.likes_count, comments_count: row.comments_count, liked: row.liked });
      })
      .catch(() => {});

    setCommentsLoading(true);
    fetch(`/api/videos/${encodeURIComponent(video.id)}/comments`)
      .then(r => r.ok ? r.json() : [])
      .then((rows: VideoComment[]) => setComments(Array.isArray(rows) ? rows : []))
      .catch(() => setComments([]))
      .finally(() => setCommentsLoading(false));
  }, [loggedIn, video.id]);

  // ── 첨부 자료 lazy 로드 (자료 탭 진입 시) ──
  useEffect(() => {
    if (!loggedIn || tab !== 'files' || attachments !== null) return;
    setAttachmentsErr('');
    fetch(`/api/videos/${encodeURIComponent(video.id)}/attachments`, { credentials: 'include' })
      .then(async r => {
        if (r.status === 401) { setAttachmentsErr('로그인이 필요합니다.'); setAttachments([]); return; }
        if (!r.ok) throw new Error(String(r.status));
        const rows = (await r.json()) as AttachmentItem[];
        setAttachments(Array.isArray(rows) ? rows : []);
      })
      .catch(() => { setAttachmentsErr('첨부 자료를 불러오지 못했습니다.'); setAttachments([]); });
  }, [loggedIn, tab, attachments, video.id]);

  const blockContext = (e: React.MouseEvent) => { e.preventDefault(); };
  const blockShortcuts = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey && (e.key === 's' || e.key === 'u' || e.key === 'c'))
      || (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C'))
      || e.key === 'F12') {
      e.preventDefault();
    }
  };
  const handleExternalLinkBlock = () => {
    setExternalLinkBlocked(true);
    setTimeout(() => setExternalLinkBlocked(false), 2000);
  };
  const nowLabel = () => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch { return iso; }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) videoAreaRef.current?.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  };

  const doCopy = useCallback(async (text: string): Promise<boolean> => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch { /* fallthrough */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch { return false; }
  }, []);

  const copyLink = async () => {
    const url = typeof window !== 'undefined'
      ? `${window.location.origin}/video/${encodeURIComponent(video.id)}`
      : `/video/${encodeURIComponent(video.id)}`;
    const ok = await doCopy(url);
    if (ok) {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1800);
    } else {
      alert('링크 복사에 실패했습니다.');
    }
  };

  const copyStageDescription = async (idx: number, text: string) => {
    const ok = await doCopy(text);
    if (ok) {
      setCopiedStageIdx(idx);
      setTimeout(() => setCopiedStageIdx(c => (c === idx ? null : c)), 1500);
    } else {
      alert('복사에 실패했습니다.');
    }
  };

  const handleToggleLike = async () => {
    if (likeBusy) return;
    const before = stats;
    const liked = !before.liked;
    const optimistic: Stats = { ...before, liked, likes_count: Math.max(0, before.likes_count + (liked ? 1 : -1)) };
    setStats(optimistic);
    setLikeBusy(true);
    try {
      const res = await fetch(`/api/videos/${encodeURIComponent(video.id)}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: getSessionId(), action: liked ? 'like' : 'unlike' }),
      });
      if (!res.ok) throw new Error('like failed');
      const data = await res.json();
      setStats({ ...optimistic, likes_count: data.likes_count, liked: data.liked });
    } catch {
      setStats(before);
      alert('좋아요 처리에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLikeBusy(false);
    }
  };

  const submitComment = async () => {
    const text = newComment.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/videos/${encodeURIComponent(video.id)}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text, password: newPassword || undefined, sessionId: getSessionId() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data?.error || '댓글 등록에 실패했습니다.');
        return;
      }
      setNewComment('');
      setNewPassword('');
      const list = await fetch(`/api/videos/${encodeURIComponent(video.id)}/comments`).then(r => r.json()).catch(() => []);
      setComments(Array.isArray(list) ? list : []);
      setStats(s => ({ ...s, comments_count: s.comments_count + 1 }));
    } finally {
      setSubmitting(false);
    }
  };

  const deleteComment = async (commentId: string) => {
    const password = window.prompt('비밀번호를 입력하세요.');
    if (password == null) return;
    if (!password) { alert('비밀번호를 입력해주세요.'); return; }
    const res = await fetch(`/api/videos/comments/${encodeURIComponent(commentId)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data?.error || '삭제에 실패했습니다.');
      return;
    }
    setComments(cs => cs.map(c => c.id === commentId ? { ...c, is_deleted: true, content: '' } : c));
    setStats(s => ({ ...s, comments_count: Math.max(0, s.comments_count - 1) }));
  };

  const loginHref = `/login?next=${encodeURIComponent(`/video/${video.id}`)}`;
  const activeComments = comments.filter(c => !c.is_deleted);

  return (
    <div style={{ minHeight: '100vh', background: T.bg, fontFamily: T.fontKo, color: T.text }}>
      {/* 상단 바 */}
      <header
        style={{
          position: 'sticky', top: 0, zIndex: 20,
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 20px', background: '#0A1424', color: '#fff',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <a
          href="/#videos"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            color: 'rgba(255,255,255,0.85)', textDecoration: 'none',
            fontSize: 13, fontWeight: 600, flexShrink: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
          목록으로
        </a>
        <div
          style={{
            flex: 1, minWidth: 0, textAlign: 'center',
            fontSize: 14, fontWeight: 700, color: '#fff',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}
        >
          {video.title}
        </div>
        <button
          type="button"
          onClick={copyLink}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
            padding: '7px 12px', borderRadius: 8, cursor: 'pointer',
            border: '1px solid ' + (linkCopied ? T.success : 'rgba(255,255,255,0.25)'),
            background: linkCopied ? T.success : 'rgba(255,255,255,0.10)',
            color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: T.fontKo,
          }}
          aria-label="이 영상 링크 복사"
        >
          {linkCopied ? (
            <>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
              복사됨
            </>
          ) : (
            <>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              링크 복사
            </>
          )}
        </button>
      </header>

      <main style={{ maxWidth: 1000, margin: '0 auto', padding: '0 0 64px' }}>
        {/* 영상 영역 */}
        <div style={{ background: '#000', position: 'relative' }}>
          <div
            ref={videoAreaRef}
            style={{
              maxWidth: 960, margin: '0 auto',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <div
              style={{ width: '100%', aspectRatio: '16/9', position: 'relative' }}
              onContextMenu={blockContext}
              onKeyDown={blockShortcuts}
            >
              {loggedIn && youtubeId ? (
                <iframe
                  ref={iframeRef}
                  width="100%" height="100%"
                  src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0&modestbranding=1&iv_load_policy=3&disablekb=1&playsinline=1&fs=0&enablejsapi=1`}
                  title={video.title}
                  allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                  style={{ display: 'block', border: 'none' }}
                />
              ) : loggedIn ? (
                <div style={{ display: 'grid', placeItems: 'center', width: '100%', height: '100%', color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
                  영상 ID 없음
                </div>
              ) : (
                /* ── 비로그인 게이트 ── */
                <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
                  {youtubeThumb(video.youtubeUrl) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={youtubeThumb(video.youtubeUrl)!}
                      alt=""
                      aria-hidden
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(8px) brightness(0.45)', transform: 'scale(1.1)' }}
                    />
                  )}
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, textAlign: 'center' }}>
                    <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,255,255,0.14)', display: 'grid', placeItems: 'center' }}>
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </div>
                    <div style={{ color: '#fff', fontSize: 15, fontWeight: 700, lineHeight: 1.5 }}>
                      이 영상은 이랜드리테일 임직원 전용입니다.<br />로그인 후 시청하세요.
                    </div>
                    <a
                      href={loginHref}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '11px 22px', borderRadius: 10,
                        background: T.primary, color: '#fff', textDecoration: 'none',
                        fontSize: 14, fontWeight: 700,
                      }}
                    >
                      로그인하고 시청하기
                    </a>
                  </div>
                </div>
              )}

              {/* ── 보호 레이어 (로그인 시에만) ── */}
              {loggedIn && youtubeId && (
                <>
                  {/* 외부 이동 차단 오버레이 */}
                  <div onClick={handleExternalLinkBlock} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '12%', zIndex: 5, cursor: 'not-allowed' }} aria-hidden="true" />
                  <div onClick={handleExternalLinkBlock} style={{ position: 'absolute', top: 0, right: 0, width: '12%', height: '14%', zIndex: 5, cursor: 'not-allowed' }} aria-hidden="true" />
                  <div onClick={handleExternalLinkBlock} style={{ position: 'absolute', bottom: 0, right: 0, width: '22%', height: '14%', zIndex: 5, cursor: 'not-allowed' }} aria-hidden="true" />
                  <div onClick={handleExternalLinkBlock} style={{ position: 'absolute', bottom: 0, left: 0, width: '14%', height: '14%', zIndex: 5, cursor: 'not-allowed' }} aria-hidden="true" />
                  {/* 워터마크 — 2개씩 30초 swap */}
                  {[
                    wmPosToggle === 0 ? { top: 10, left: 12 } : { top: 10, right: 12 },
                    wmPosToggle === 0 ? { bottom: 10, right: 12 } : { bottom: 10, left: 12 },
                  ].map((pos, i) => (
                    <div key={i} aria-hidden="true" style={{
                      position: 'absolute', ...pos, zIndex: 4, pointerEvents: 'none',
                      fontSize: 11, fontWeight: 600, fontFamily: 'sans-serif',
                      color: 'rgba(255,255,255,0.55)', textShadow: '0 0 4px rgba(0,0,0,0.8)',
                      letterSpacing: 0.3, userSelect: 'none',
                    }}>
                      {watermarkEmail} · {nowLabel()}
                    </div>
                  ))}
                  {/* 외부 링크 차단 토스트 */}
                  {externalLinkBlocked && (
                    <div style={{
                      position: 'absolute', bottom: 60, left: '50%', transform: 'translateX(-50%)',
                      zIndex: 10, padding: '8px 14px', borderRadius: 6,
                      background: 'rgba(216,54,76,0.95)', color: '#fff', fontSize: 12, fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}>
                      외부 이동이 차단되었습니다 · 사내 한정 자료
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <div style={{ padding: '0 20px' }}>
          {/* 액션 바: 좋아요 · 전체화면 (로그인 시) */}
          {loggedIn && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 0 4px' }}>
              <button
                type="button"
                onClick={handleToggleLike}
                disabled={likeBusy}
                aria-pressed={stats.liked}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '7px 14px', borderRadius: 999, cursor: likeBusy ? 'default' : 'pointer',
                  background: stats.liked ? T.dangerBg : T.surface,
                  border: `1px solid ${stats.liked ? '#FBCBD2' : T.border}`,
                  color: stats.liked ? T.danger : T.textBody,
                  fontSize: 13, fontWeight: 600, fontFamily: T.fontKo, opacity: likeBusy ? 0.6 : 1,
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill={stats.liked ? T.danger : 'none'} stroke={stats.liked ? T.danger : T.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
                {stats.likes_count}
              </button>
              <button
                type="button"
                onClick={toggleFullscreen}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '7px 14px', borderRadius: 999, cursor: 'pointer',
                  background: T.surface, border: `1px solid ${T.border}`, color: T.textBody,
                  fontSize: 13, fontWeight: 600, fontFamily: T.fontKo,
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {isFullscreen
                    ? <path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3" />
                    : <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />}
                </svg>
                {isFullscreen ? '전체화면 종료' : '전체화면'}
              </button>
            </div>
          )}

          {/* 사내 한정 안내 */}
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: T.secondaryLight, color: T.secondaryDark,
              borderRadius: T.r, padding: '10px 14px', margin: '12px 0',
              fontSize: 12.5, fontWeight: 700,
            }}
          >
            <span aria-hidden style={{ width: 8, height: 8, borderRadius: 4, background: T.secondary, flexShrink: 0 }} />
            본 영상은 이랜드리테일 임직원 전용 자료입니다 · 외부 유출·재배포 금지
          </div>

          {/* 탭 바 */}
          <div style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${T.border}`, marginBottom: 16 }}>
            <TabBtn active={tab === 'info'} onClick={() => setTab('info')} label="정보" />
            <TabBtn active={tab === 'stages'} onClick={() => setTab('stages')} label={`학습 단계${stages.length ? ` ${stages.length}` : ''}`} />
            <TabBtn active={tab === 'files'} onClick={() => setTab('files')} label={`자료${attachments ? ` ${attachments.length}` : (video.attachmentCount ? ` ${video.attachmentCount}` : '')}`} />
            <TabBtn active={tab === 'comments'} onClick={() => setTab('comments')} label={`댓글${loggedIn ? ` ${stats.comments_count}` : ''}`} />
          </div>

          {/* 탭 콘텐츠 */}
          {tab === 'info' && (
            <div>
              <h1 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800, color: T.text, letterSpacing: '-0.02em' }}>{video.title}</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 10px', fontSize: 12, background: T.primaryLight, color: T.primary, borderRadius: 999, fontWeight: 600 }}>{video.level}</span>
                <span style={{ fontSize: 13, color: T.textMuted }}>조회 {(video.viewCount ?? 0).toLocaleString()}</span>
                {video.duration && <span style={{ fontSize: 13, color: T.textMuted }}>{video.duration}</span>}
              </div>
              {!loggedIn
                ? <p style={{ margin: 0, fontSize: 14, color: T.textFaint }}>로그인 후 상세 내용과 영상을 확인할 수 있습니다.</p>
                : video.description
                ? <p style={{ margin: 0, fontSize: 14.5, color: T.textBody, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{video.description}</p>
                : <p style={{ margin: 0, fontSize: 14, color: T.textFaint }}>등록된 설명이 없습니다.</p>}
            </div>
          )}

          {tab === 'stages' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {!loggedIn ? (
                <Empty msg="학습 단계는 로그인 후 확인할 수 있습니다." />
              ) : stages.length === 0 ? (
                <Empty msg="등록된 학습 단계가 없습니다." />
              ) : stages.map((stage, idx) => {
                const isOpen = openStageIdx === idx;
                return (
                  <div key={stage.id || idx} style={{ border: `1.5px solid ${isOpen ? T.primary : T.border}`, borderRadius: T.r, overflow: 'hidden' }}>
                    <button
                      type="button"
                      onClick={() => setOpenStageIdx(isOpen ? null : idx)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
                        background: isOpen ? T.primaryLight : T.surface, border: 'none', cursor: 'pointer',
                        textAlign: 'left', fontFamily: T.fontKo,
                      }}
                    >
                      <span style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, background: isOpen ? T.primary : T.bg, color: isOpen ? '#fff' : T.textMuted, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700 }}>{idx + 1}</span>
                      <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: isOpen ? T.primary : T.text }}>{stage.title}</span>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={isOpen ? T.primary : T.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }}><path d="M6 9l6 6 6-6" /></svg>
                    </button>
                    {isOpen && (stage.description || (stage.images && stage.images.length > 0)) && (
                      <div style={{ padding: '12px 16px 14px', background: T.primarySoft }}>
                        {stage.description && (
                          <>
                            <div style={{ marginBottom: 8 }}>
                              <button
                                type="button"
                                onClick={() => copyStageDescription(idx, stage.description)}
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 28, padding: '4px 10px',
                                  background: copiedStageIdx === idx ? T.successBg : T.surface,
                                  border: `1px solid ${copiedStageIdx === idx ? T.success : T.border}`,
                                  color: copiedStageIdx === idx ? T.success : T.text,
                                  borderRadius: T.r, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: T.fontKo,
                                }}
                              >
                                {copiedStageIdx === idx ? '복사됨' : '전체 복사'}
                              </button>
                            </div>
                            <div style={{ fontSize: 14, color: T.textBody, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{stage.description}</div>
                          </>
                        )}
                        {stage.images && stage.images.length > 0 && (
                          <div style={{ marginTop: stage.description ? 12 : 0, display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
                            {stage.images.map((url, ii) => (
                              <button
                                key={url}
                                type="button"
                                onClick={() => setLightbox({ images: stage.images || [], index: ii })}
                                onContextMenu={e => e.preventDefault()}
                                style={{ padding: 0, border: 'none', background: 'transparent', cursor: 'zoom-in', overflow: 'hidden', borderRadius: 8, aspectRatio: '1 / 1' }}
                                aria-label={`스테이지 이미지 ${ii + 1} 확대 보기`}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={url} alt={`스테이지 ${idx + 1} 이미지 ${ii + 1}`} draggable={false} onDragStart={e => e.preventDefault()} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', border: `1px solid ${T.border}`, borderRadius: 8, userSelect: 'none' }} />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'files' && (
            <div>
              {!loggedIn ? (
                <Empty msg="자료는 로그인 후 확인할 수 있습니다." />
              ) : attachments === null ? (
                <Empty msg="불러오는 중..." />
              ) : attachmentsErr ? (
                <Empty msg={attachmentsErr} />
              ) : attachments.length === 0 ? (
                <Empty msg="등록된 학습 자료가 없습니다." />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {attachments.map(att => (
                    <a
                      key={att.id}
                      href={`/api/videos/${encodeURIComponent(video.id)}/attachments/${encodeURIComponent(att.id)}/download`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: T.r2, border: `1px solid ${T.border}`, background: T.surface, textDecoration: 'none', color: T.text }}
                    >
                      <span style={{ fontSize: 22, flexShrink: 0 }}>{iconFor(att.filename)}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.filename}</div>
                        <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 2 }}>{formatBytes(att.sizeBytes)} · 다운로드 {att.downloadCount}회</div>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                    </a>
                  ))}
                  <p style={{ fontSize: 11, color: T.textFaint, marginTop: 6, lineHeight: 1.5 }}>
                    🔒 본 자료는 이랜드리테일 사내 한정입니다. 외부 공유 시 다운로드 이력이 추적됩니다.
                  </p>
                </div>
              )}
            </div>
          )}

          {tab === 'comments' && (
            <div>
              {!loggedIn ? (
                <Empty msg="댓글은 로그인 후 확인할 수 있습니다." />
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
                    <textarea
                      value={newComment}
                      onChange={e => setNewComment(e.target.value)}
                      maxLength={1000}
                      rows={3}
                      placeholder="이 영상에 대한 의견을 남겨주세요."
                      style={{ width: '100%', padding: '10px 12px', border: `1px solid ${T.border}`, borderRadius: T.r, fontSize: 13.5, color: T.text, fontFamily: T.fontKo, resize: 'vertical', outline: 'none', background: T.surface, boxSizing: 'border-box' }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="삭제 비밀번호(선택)"
                        style={{ flex: 1, height: 38, padding: '0 12px', border: `1px solid ${T.border}`, borderRadius: T.r, fontSize: 13, color: T.text, fontFamily: T.fontKo, outline: 'none', boxSizing: 'border-box' }}
                      />
                      <button
                        type="button"
                        onClick={submitComment}
                        disabled={!newComment.trim() || submitting}
                        style={{ flex: '0 0 96px', height: 38, borderRadius: T.r, border: 'none', background: (!newComment.trim() || submitting) ? '#AFC0D6' : T.primary, color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: (!newComment.trim() || submitting) ? 'not-allowed' : 'pointer', fontFamily: T.fontKo }}
                      >
                        {submitting ? '등록 중…' : '등록'}
                      </button>
                    </div>
                  </div>

                  {commentsLoading ? (
                    <Empty msg="불러오는 중..." />
                  ) : activeComments.length === 0 ? (
                    <Empty msg="첫 댓글을 남겨보세요." />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {activeComments.map(c => (
                        <div key={c.id} style={{ padding: '12px 14px', borderRadius: T.r, border: `1px solid ${T.border}`, background: T.surface }}>
                          <div style={{ fontSize: 14, color: T.textBody, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{c.content}</div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                            <span style={{ fontSize: 11.5, color: T.textFaint }}>{formatDate(c.created_at)}</span>
                            <button
                              type="button"
                              onClick={() => deleteComment(c.id)}
                              style={{ background: 'none', border: 'none', color: T.textFaint, fontSize: 12, cursor: 'pointer', fontFamily: T.fontKo }}
                            >
                              삭제
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </main>

      {lightbox && (
        <StageImageLightbox
          images={lightbox.images}
          index={lightbox.index}
          onChangeIndex={(next) => setLightbox(lb => lb ? { ...lb, index: next } : lb)}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}

function TabBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '10px 16px', background: 'transparent', border: 'none',
        borderBottom: active ? `2px solid ${T.primary}` : '2px solid transparent',
        color: active ? T.primary : T.textMuted, fontSize: 13.5, fontWeight: 700,
        cursor: 'pointer', fontFamily: T.fontKo, marginBottom: -1,
      }}
    >
      {label}
    </button>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 16px', color: T.textFaint, fontSize: 13.5 }}>
      {msg}
    </div>
  );
}
