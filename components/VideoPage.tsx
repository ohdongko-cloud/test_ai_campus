"use client";

import { useState, useEffect, useMemo } from 'react';
import { Video, VideoLevel, VideoStats, VideoComment } from '../lib/types';
import { extractVideoId, getSessionId } from '../lib/utils';

function youtubeThumb(youtubeUrl: string): string | null {
  const id = extractVideoId(youtubeUrl);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

const T = {
  primary: '#004A99', primaryDark: '#003A78', primaryLight: '#E6EEF7', primarySoft: '#F0F5FB',
  secondary: '#FF914D', secondaryDark: '#E67835', secondaryLight: '#FFF1E6',
  bg: '#F5F7FA', surface: '#FFFFFF', surfaceAlt: '#FAFBFD',
  text: '#0F1E33', textBody: '#3B4A63', textMuted: '#6B7A91', textFaint: '#9BA7BC',
  border: '#E5EAF1', borderStrong: '#D4DBE6',
  success: '#1E9E6A', successBg: '#E6F6EE',
  danger: '#D8364C', dangerBg: '#FCE6EA',
  info: '#2563EB', infoBg: '#E8EEFB',
  r: 8, r2: 12, r3: 16,
  shadowSm: '0 1px 2px rgba(15,30,51,0.04)',
  shadowMd: '0 2px 6px rgba(15,30,51,0.04), 0 8px 24px rgba(15,30,51,0.06)',
  fontKo: '"Noto Sans KR", "Inter", system-ui, sans-serif',
  fontEn: '"Inter", system-ui, sans-serif',
};

// 기본 4색 + 오버플로우용 팔레트
const BADGE_PALETTES = [
  { bg: T.primaryLight, fg: T.primary },
  { bg: T.secondaryLight, fg: T.secondaryDark },
  { bg: T.infoBg, fg: T.info },
  { bg: '#EEF1F6', fg: T.textBody },
  { bg: '#F0E6F7', fg: '#6940C9' },
  { bg: '#FCE6EA', fg: T.danger },
  { bg: '#E6F6EE', fg: T.success },
  { bg: '#FFF6DB', fg: '#9C7100' },
];

const CARD_PALETTES = [
  { bg: '#E6EEF7', fg: '#004A99' },
  { bg: '#FFF1E6', fg: '#C2581F' },
  { bg: '#E6F6EE', fg: '#1E9E6A' },
  { bg: '#F0E6F7', fg: '#6940C9' },
  { bg: '#FCE6EA', fg: '#D8364C' },
  { bg: '#FFF6DB', fg: '#9C7100' },
];

function getBadgeStyle(levelName: string, levels: VideoLevel[]): { bg: string; fg: string } {
  const idx = levels.findIndex(l => l.name === levelName);
  return BADGE_PALETTES[idx >= 0 ? idx % BADGE_PALETTES.length : BADGE_PALETTES.length - 1];
}

export default function VideoPage() {
  const [videos, setVideosState] = useState<Video[]>([]);
  const [levels, setLevels] = useState<VideoLevel[]>([]);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('전체');
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [hoverCard, setHoverCard] = useState<string | null>(null);
  const [openStageIdx, setOpenStageIdx] = useState<number | null>(null);
  const [copiedStageIdx, setCopiedStageIdx] = useState<number | null>(null);
  const [statsMap, setStatsMap] = useState<Record<string, VideoStats>>({});
  const [thumbFailed, setThumbFailed] = useState<Record<string, true>>({});
  const [likeBusy, setLikeBusy] = useState<Record<string, true>>({});

  const videoIds = useMemo(() => videos.map(v => v.id).join(','), [videos]);

  // 영상 목록 변경 시 stats 일괄 조회
  useEffect(() => {
    if (!videoIds) return;
    const sid = getSessionId();
    const url = `/api/videos/stats?ids=${encodeURIComponent(videoIds)}&sessionId=${encodeURIComponent(sid)}`;
    fetch(url)
      .then(r => r.ok ? r.json() : [])
      .then((rows: VideoStats[]) => {
        const next: Record<string, VideoStats> = {};
        for (const r of rows) next[r.video_id] = r;
        setStatsMap(next);
      })
      .catch(() => { /* network 실패 시 0으로 표시 */ });
  }, [videoIds]);

  const getStats = (id: string): VideoStats => statsMap[id] || { video_id: id, likes_count: 0, comments_count: 0, liked: false };

  const handleToggleLike = async (videoId: string) => {
    if (likeBusy[videoId]) return;
    const before = getStats(videoId);
    const liked = !before.liked;
    const optimistic: VideoStats = {
      ...before,
      liked,
      likes_count: Math.max(0, before.likes_count + (liked ? 1 : -1)),
    };
    setStatsMap(m => ({ ...m, [videoId]: optimistic }));
    setLikeBusy(b => ({ ...b, [videoId]: true }));
    try {
      const res = await fetch(`/api/videos/${encodeURIComponent(videoId)}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: getSessionId(), action: liked ? 'like' : 'unlike' }),
      });
      if (!res.ok) throw new Error('like failed');
      const data = await res.json();
      setStatsMap(m => ({ ...m, [videoId]: { ...optimistic, likes_count: data.likes_count, liked: data.liked } }));
    } catch {
      setStatsMap(m => ({ ...m, [videoId]: before }));
      alert('좋아요 처리에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLikeBusy(b => {
        const { [videoId]: _drop, ...rest } = b;
        return rest;
      });
    }
  };

  const copyStageDescription = async (idx: number, text: string) => {
    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
    }
    if (ok) {
      setCopiedStageIdx(idx);
      setTimeout(() => setCopiedStageIdx(c => (c === idx ? null : c)), 1500);
    } else {
      alert('복사에 실패했습니다.');
    }
  };

  const load = async () => {
    try {
      const [vRes, lRes] = await Promise.all([
        fetch('/api/videos'),
        fetch('/api/video-levels'),
      ]);
      if (vRes.ok) setVideosState(await vRes.json());
      if (lRes.ok) setLevels(await lRes.json());
    } catch {
      // 네트워크 실패 시 빈 상태 유지
    }
  };

  useEffect(() => {
    load();
  }, []);

  const levelNames = levels.map(l => l.name);

  const filtered = videos.filter(v => {
    const matchLevel = levelFilter === '전체' || v.level === levelFilter;
    const matchSearch =
      v.title.toLowerCase().includes(search.toLowerCase()) ||
      v.description.toLowerCase().includes(search.toLowerCase());
    return matchLevel && matchSearch;
  });

  // 레벨별 영상 수 (동적)
  const levelCounts: Record<string, number> = {};
  videos.forEach(v => { levelCounts[v.level] = (levelCounts[v.level] || 0) + 1; });

  const handleWatch = (video: Video) => {
    // optimistic 시청수 +1, 서버에는 view 증가 요청 (fail-and-forget)
    const updated = videos.map(v =>
      v.id === video.id ? { ...v, viewCount: v.viewCount + 1 } : v
    );
    setVideosState(updated);
    setSelectedVideo({ ...video, viewCount: video.viewCount + 1 });
    setOpenStageIdx(null);
    fetch(`/api/videos/${encodeURIComponent(video.id)}/view`, { method: 'POST' })
      .catch(() => { /* ignore */ });
  };

  // ── 댓글 ──
  const [comments, setComments] = useState<VideoComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!selectedVideo) {
      setComments([]);
      setNewComment('');
      setNewPassword('');
      return;
    }
    setCommentsLoading(true);
    fetch(`/api/videos/${encodeURIComponent(selectedVideo.id)}/comments`)
      .then(r => r.ok ? r.json() : [])
      .then((rows: VideoComment[]) => setComments(rows))
      .catch(() => setComments([]))
      .finally(() => setCommentsLoading(false));
  }, [selectedVideo?.id]);

  const submitComment = async () => {
    if (!selectedVideo) return;
    const text = newComment.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/videos/${encodeURIComponent(selectedVideo.id)}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: text,
          password: newPassword || undefined,
          sessionId: getSessionId(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data?.error || '댓글 등록에 실패했습니다.');
        return;
      }
      setNewComment('');
      setNewPassword('');
      // 목록 새로고침
      const list = await fetch(`/api/videos/${encodeURIComponent(selectedVideo.id)}/comments`).then(r => r.json()).catch(() => []);
      setComments(list);
      // 카드 카운트도 +1
      setStatsMap(m => {
        const cur = m[selectedVideo.id] || { video_id: selectedVideo.id, likes_count: 0, comments_count: 0, liked: false };
        return { ...m, [selectedVideo.id]: { ...cur, comments_count: cur.comments_count + 1 } };
      });
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
    if (selectedVideo) {
      setStatsMap(m => {
        const cur = m[selectedVideo.id];
        if (!cur) return m;
        return { ...m, [selectedVideo.id]: { ...cur, comments_count: Math.max(0, cur.comments_count - 1) } };
      });
    }
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return iso;
    }
  };

  const sidebarItems = [
    { id: '전체', count: videos.length },
    ...levelNames.map(name => ({ id: name, count: levelCounts[name] || 0 })),
  ];

  // ── 카드 렌더 헬퍼 ── (level grouping과 단일 그리드에서 공용)
  const renderVideoCard = (v: Video, idx: number, paletteIdx: number) => {
    const badge = getBadgeStyle(v.level, levels);
    const palette = CARD_PALETTES[paletteIdx % CARD_PALETTES.length];
    const isHover = hoverCard === v.id;
    const thumb = youtubeThumb(v.youtubeUrl);
    const useFallback = !thumb || thumbFailed[v.id];
    const s = getStats(v.id);
    void idx;
    return (
      <div
        key={v.id}
        onMouseEnter={() => setHoverCard(v.id)}
        onMouseLeave={() => setHoverCard(null)}
        onClick={() => handleWatch(v)}
        style={{
          background: T.surface, border: `1px solid ${isHover ? T.primary : T.border}`,
          borderRadius: T.r2, overflow: 'hidden',
          boxShadow: isHover ? T.shadowMd : T.shadowSm,
          transform: isHover ? 'translateY(-2px)' : 'translateY(0)',
          transition: 'all .18s', cursor: 'pointer',
        }}
      >
        {/* 썸네일 */}
        <div style={{
          aspectRatio: '16/9',
          background: palette.bg,
          backgroundImage: useFallback
            ? `repeating-linear-gradient(135deg, transparent 0 12px, ${palette.fg}11 12px 13px)`
            : undefined,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', overflow: 'hidden',
        }}>
          {!useFallback && (
            <img
              src={thumb}
              alt={v.title}
              onError={() => setThumbFailed(m => ({ ...m, [v.id]: true }))}
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                objectFit: 'cover',
                transform: isHover ? 'scale(1.04)' : 'scale(1)',
                transition: 'transform .25s ease',
              }}
            />
          )}
          <div style={{
            position: 'relative', zIndex: 1,
            width: 52, height: 52, borderRadius: '50%',
            background: 'rgba(255,255,255,0.95)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path d="M9 7l9 5-9 5V7z" fill={T.primary}/>
            </svg>
          </div>
        </div>

        {/* 카드 본문 */}
        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', height: 20,
              padding: '0 8px', fontSize: 11, background: badge.bg, color: badge.fg,
              borderRadius: 999, fontWeight: 600, whiteSpace: 'nowrap',
            }}>{v.level}</span>
            <span style={{ fontSize: 11, color: T.textMuted }}>
              조회 {v.viewCount.toLocaleString()}
            </span>
            {v.stages && v.stages.length > 0 && (
              <span style={{
                fontSize: 10, color: T.primary,
                background: T.primaryLight, padding: '1px 6px',
                borderRadius: 999, fontWeight: 600,
              }}>
                {v.stages.length}단계
              </span>
            )}
          </div>
          <div style={{
            fontSize: 15, fontWeight: 700, color: T.text,
            letterSpacing: '-0.02em', marginBottom: 6, lineHeight: 1.4,
            fontFamily: T.fontKo,
          }}>{v.title}</div>
          <p style={{
            margin: 0, fontSize: 13, color: T.textMuted, lineHeight: 1.5,
            display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical' as const, overflow: 'hidden',
          }}>{v.description}</p>

          {/* 좋아요 / 댓글 인디케이터 */}
          <div style={{
            marginTop: 14, paddingTop: 12, borderTop: `1px dashed ${T.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); handleToggleLike(v.id); }}
                disabled={!!likeBusy[v.id]}
                aria-pressed={!!s.liked}
                aria-label={s.liked ? '좋아요 취소' : '좋아요'}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px', borderRadius: 999, cursor: 'pointer',
                  background: s.liked ? T.dangerBg : T.surface,
                  border: `1px solid ${s.liked ? '#FBCBD2' : T.border}`,
                  color: s.liked ? T.danger : T.textBody,
                  fontSize: 12, fontWeight: 600, fontFamily: T.fontKo,
                  transition: 'all .15s',
                  opacity: likeBusy[v.id] ? 0.6 : 1,
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24"
                  fill={s.liked ? T.danger : 'none'}
                  stroke={s.liked ? T.danger : T.textMuted}
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
                {s.likes_count}
              </button>
              <div
                aria-label={`댓글 ${s.comments_count}개`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  color: T.textMuted, fontSize: 12, fontWeight: 600,
                  fontFamily: T.fontKo,
                }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                {s.comments_count}
              </div>
            </div>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: T.primary }}>
              시청하기
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6"/>
              </svg>
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 24px 64px', fontFamily: T.fontKo }}>
      {/* 페이지 헤더 */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 6, fontWeight: 500 }}>홈 › 강의 영상</div>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: T.text, letterSpacing: '-0.02em' }}>강의 영상</h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: T.textMuted }}>레벨에 맞춰 골라보세요. 모든 영상은 무료입니다.</p>
      </div>

      <div style={{
        display: 'grid', gap: 24,
        gridTemplateColumns: 'minmax(0, 240px) minmax(0, 1fr)',
      }}>
        {/* 사이드바 */}
        <aside style={{ minWidth: 0 }}>
          <div style={{
            background: T.surface, border: `1px solid ${T.border}`,
            borderRadius: T.r2, padding: 16,
            boxShadow: T.shadowSm, position: 'sticky', top: 88,
          }}>
            {/* 검색 */}
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <div style={{
                position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                color: T.textMuted, fontSize: 14,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>
                </svg>
              </div>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="강의 검색..."
                style={{
                  width: '100%', height: 38, paddingLeft: 34, paddingRight: 12,
                  border: `1px solid ${T.border}`, borderRadius: T.r,
                  background: T.surface, fontSize: 13, color: T.text,
                  outline: 'none', fontFamily: T.fontKo, boxSizing: 'border-box',
                }}
                onFocus={e => { e.target.style.borderColor = T.primary; e.target.style.boxShadow = `0 0 0 3px ${T.primaryLight}`; }}
                onBlur={e => { e.target.style.borderColor = T.border; e.target.style.boxShadow = 'none'; }}
              />
            </div>

            {/* 레벨 필터 (동적) */}
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
              레벨
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {sidebarItems.map(lv => {
                const on = levelFilter === lv.id;
                return (
                  <button
                    key={lv.id}
                    onClick={() => setLevelFilter(lv.id)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 12px', borderRadius: T.r, border: 'none',
                      background: on ? T.primaryLight : 'transparent',
                      color: on ? T.primary : T.textBody,
                      cursor: 'pointer', fontSize: 14, fontWeight: on ? 600 : 500,
                      fontFamily: T.fontKo, transition: 'background .12s',
                    }}
                  >
                    <span>{lv.id}</span>
                    <span style={{ fontSize: 12, color: on ? T.primary : T.textFaint, fontWeight: 600 }}>{lv.count}</span>
                  </button>
                );
              })}
            </div>

            {/* 학습 팁 */}
            <div style={{
              marginTop: 20, padding: 14, borderRadius: T.r,
              background: T.secondaryLight, border: `1px solid ${T.secondaryLight}`,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.secondaryDark, marginBottom: 6 }}>
                학습 팁
              </div>
              <p style={{ margin: 0, fontSize: 12, color: T.secondaryDark, lineHeight: 1.5 }}>
                기초부터 차근차근! 강의 시청 후 게시판에서 모르는 부분을 질문해 보세요.
              </p>
            </div>
          </div>
        </aside>

        {/* 영상 목록 */}
        <div style={{ minWidth: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 16, gap: 12, flexWrap: 'wrap',
          }}>
            <div style={{ fontSize: 14, color: T.textBody, fontWeight: 500 }}>
              총 <strong style={{ color: T.primary }}>{filtered.length}</strong>편의 강의
            </div>
          </div>

          {filtered.length === 0 ? (
            <div style={{
              background: T.surface, border: `1px solid ${T.border}`,
              borderRadius: T.r2, padding: '48px 24px', textAlign: 'center',
              boxShadow: T.shadowSm,
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 6 }}>검색 결과가 없습니다</div>
              <p style={{ margin: 0, fontSize: 13, color: T.textMuted }}>다른 키워드로 검색하거나 필터를 조정해보세요.</p>
            </div>
          ) : levelFilter === '전체' ? (
            // 전체 필터: 레벨별 섹션으로 분리
            <div>
              {levels.map(lv => {
                const items = filtered.filter(v => v.level === lv.name);
                if (items.length === 0) return null;
                const badge = getBadgeStyle(lv.name, levels);
                return (
                  <div key={lv.id} style={{ marginBottom: 36 }}>
                    {/* 레벨 헤더 + 구분선 */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      marginBottom: 16, paddingBottom: 12,
                      borderBottom: `1.5px dashed ${T.border}`,
                    }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', height: 24,
                        padding: '0 10px', fontSize: 12, fontWeight: 700,
                        background: badge.bg, color: badge.fg,
                        borderRadius: 999,
                      }}>{lv.name}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
                        {items.length}편
                      </span>
                      <span style={{ flex: 1, fontSize: 12, color: T.textMuted, marginLeft: 6 }}>
                        {lv.description}
                      </span>
                    </div>
                    {/* 해당 레벨 카드 그리드 */}
                    <div style={{
                      display: 'grid', gap: 16,
                      gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                    }}>
                      {items.map((v, vidx) => {
                        const idx = filtered.indexOf(v);
                        return renderVideoCard(v, idx, vidx);
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{
              display: 'grid', gap: 16,
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            }}>
              {filtered.map((v, idx) => renderVideoCard(v, idx, idx))}
            </div>
          )}
        </div>
      </div>

      {/* 영상 시청 모달 */}
      {selectedVideo && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(15,30,51,0.55)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
          onClick={() => setSelectedVideo(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: T.surface, borderRadius: T.r3,
              width: '100%', maxWidth: 860, maxHeight: 'calc(100vh - 32px)',
              boxShadow: '0 4px 12px rgba(15,30,51,0.06), 0 16px 40px rgba(15,30,51,0.10)',
              overflow: 'hidden', display: 'flex', flexDirection: 'column',
            }}
          >
            {/* 유튜브 플레이어 */}
            <div style={{ aspectRatio: '16/9', background: '#000', flexShrink: 0 }}>
              <iframe
                width="100%" height="100%"
                src={`https://www.youtube.com/embed/${extractVideoId(selectedVideo.youtubeUrl)}?autoplay=1&rel=0`}
                title={selectedVideo.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ display: 'block', border: 'none' }}
              />
            </div>

            {/* 영상 정보 */}
            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    {(() => {
                      const badge = getBadgeStyle(selectedVideo.level, levels);
                      return (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 8px',
                          fontSize: 11, background: badge.bg, color: badge.fg,
                          borderRadius: 999, fontWeight: 600,
                        }}>{selectedVideo.level}</span>
                      );
                    })()}
                    <span style={{ fontSize: 12, color: T.textMuted }}>
                      조회 {selectedVideo.viewCount.toLocaleString()}
                    </span>
                  </div>
                  <h3 style={{
                    margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: T.text,
                    fontFamily: T.fontKo, letterSpacing: '-0.02em',
                  }}>{selectedVideo.title}</h3>
                  <p style={{ margin: 0, fontSize: 14, color: T.textBody, lineHeight: 1.6 }}>
                    {selectedVideo.description}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedVideo(null)}
                  style={{
                    width: 32, height: 32, borderRadius: T.r, border: 'none',
                    background: T.bg, color: T.textMuted, cursor: 'pointer', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 6l12 12M18 6l-12 12"/>
                  </svg>
                </button>
              </div>

              {/* 학습 단계 아코디언 */}
              {selectedVideo.stages && selectedVideo.stages.length > 0 && (
                <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 16 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 10,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
                    </svg>
                    학습 단계 ({selectedVideo.stages.length}단계)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {selectedVideo.stages.map((stage, idx) => {
                      const isOpen = openStageIdx === idx;
                      return (
                        <div
                          key={stage.id}
                          style={{
                            border: `1.5px solid ${isOpen ? T.primary : T.border}`,
                            borderRadius: T.r, overflow: 'hidden',
                            transition: 'border-color .15s',
                          }}
                        >
                          <button
                            onClick={() => setOpenStageIdx(isOpen ? null : idx)}
                            style={{
                              width: '100%', display: 'flex', alignItems: 'center',
                              gap: 10, padding: '10px 14px',
                              background: isOpen ? T.primaryLight : T.surface,
                              border: 'none', cursor: 'pointer',
                              textAlign: 'left', transition: 'background .15s',
                            }}
                          >
                            <span style={{
                              width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                              background: isOpen ? T.primary : T.bg,
                              color: isOpen ? '#fff' : T.textMuted,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 11, fontWeight: 700,
                            }}>
                              {idx + 1}
                            </span>
                            <span style={{
                              flex: 1, fontSize: 13, fontWeight: 600,
                              color: isOpen ? T.primary : T.text,
                            }}>
                              {stage.title}
                            </span>
                            <svg
                              width="14" height="14" viewBox="0 0 24 24"
                              fill="none" stroke={isOpen ? T.primary : T.textMuted}
                              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                              style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s', flexShrink: 0 }}
                            >
                              <path d="M6 9l6 6 6-6"/>
                            </svg>
                          </button>
                          {isOpen && stage.description && (
                            <div style={{
                              padding: '10px 14px 12px 46px',
                              background: T.primarySoft,
                            }}>
                              <div style={{ marginBottom: 8 }}>
                                <button
                                  type="button"
                                  onClick={() => copyStageDescription(idx, stage.description)}
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 6,
                                    minHeight: 28, padding: '4px 10px',
                                    background: copiedStageIdx === idx ? T.successBg : T.surface,
                                    border: `1px solid ${copiedStageIdx === idx ? T.success : T.border}`,
                                    color: copiedStageIdx === idx ? T.success : T.text,
                                    borderRadius: T.r, fontSize: 12, fontWeight: 600,
                                    cursor: 'pointer', fontFamily: T.fontKo,
                                    transition: 'background .15s, border-color .15s, color .15s',
                                  }}
                                  onMouseEnter={e => {
                                    if (copiedStageIdx !== idx) {
                                      e.currentTarget.style.background = T.primaryLight;
                                      e.currentTarget.style.borderColor = T.primary;
                                      e.currentTarget.style.color = T.primary;
                                    }
                                  }}
                                  onMouseLeave={e => {
                                    if (copiedStageIdx !== idx) {
                                      e.currentTarget.style.background = T.surface;
                                      e.currentTarget.style.borderColor = T.border;
                                      e.currentTarget.style.color = T.text;
                                    }
                                  }}
                                  aria-label="스테이지 설명 전체 복사"
                                >
                                  {copiedStageIdx === idx ? (
                                    <>
                                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M5 12l5 5L20 7"/>
                                      </svg>
                                      복사됨
                                    </>
                                  ) : (
                                    <>
                                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="9" y="9" width="11" height="11" rx="2"/>
                                        <path d="M5 15V5a2 2 0 012-2h10"/>
                                      </svg>
                                      전체 복사
                                    </>
                                  )}
                                </button>
                              </div>
                              <div style={{
                                fontSize: 13, color: T.textBody, lineHeight: 1.65,
                                whiteSpace: 'pre-wrap',
                              }}>
                                {stage.description}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 댓글 패널 */}
              <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 16, marginTop: 16 }}>
                <div style={{
                  fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 12,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  댓글 ({comments.filter(c => !c.is_deleted).length})
                </div>

                {/* 작성 폼 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  <textarea
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    maxLength={1000}
                    rows={2}
                    placeholder="이 영상에 대한 의견을 남겨주세요."
                    style={{
                      width: '100%', padding: '8px 12px',
                      border: `1px solid ${T.border}`, borderRadius: T.r,
                      fontSize: 13, color: T.text, fontFamily: T.fontKo,
                      resize: 'vertical', outline: 'none', background: T.surface,
                      boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="삭제용 비밀번호 (선택)"
                      style={{
                        flex: 1, padding: '7px 12px',
                        border: `1px solid ${T.border}`, borderRadius: T.r,
                        fontSize: 12, color: T.text, fontFamily: T.fontKo,
                        outline: 'none', background: T.surface,
                      }}
                    />
                    <button
                      type="button"
                      onClick={submitComment}
                      disabled={!newComment.trim() || submitting}
                      style={{
                        padding: '7px 18px', borderRadius: T.r, border: 'none',
                        background: !newComment.trim() || submitting ? T.borderStrong : T.primary,
                        color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: T.fontKo,
                        cursor: !newComment.trim() || submitting ? 'not-allowed' : 'pointer',
                        whiteSpace: 'nowrap',
                      }}>
                      {submitting ? '등록 중...' : '등록'}
                    </button>
                  </div>
                </div>

                {/* 댓글 목록 */}
                {commentsLoading ? (
                  <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 13, color: T.textMuted }}>
                    댓글을 불러오는 중...
                  </div>
                ) : comments.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 13, color: T.textFaint }}>
                    아직 댓글이 없습니다. 가장 먼저 의견을 남겨보세요.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {comments.map(c => (
                      <div key={c.id} style={{
                        padding: '10px 12px',
                        background: T.surfaceAlt,
                        border: `1px solid ${T.border}`,
                        borderRadius: T.r,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                          <div style={{
                            flex: 1, fontSize: 13,
                            color: c.is_deleted ? T.textFaint : T.textBody,
                            fontStyle: c.is_deleted ? 'italic' : 'normal',
                            lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                          }}>
                            {c.is_deleted ? '삭제된 댓글입니다.' : c.content}
                          </div>
                          {!c.is_deleted && (
                            <button
                              type="button"
                              onClick={() => deleteComment(c.id)}
                              style={{
                                background: 'transparent', border: 'none', color: T.textFaint,
                                fontSize: 11, cursor: 'pointer', fontFamily: T.fontKo,
                                padding: '2px 6px',
                              }}>
                              삭제
                            </button>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: T.textFaint, marginTop: 6 }}>
                          {formatDate(c.created_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
