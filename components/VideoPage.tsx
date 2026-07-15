"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Video, VideoLevel, VideoStats } from '../lib/types';
import { extractVideoId, getSessionId } from '../lib/utils';
import LevelTest, { LevelResult } from './LevelTest';

// 레벨 테스트 결과와 무관하게 항상 추천에 포함되는 콘텐츠 레벨
const ALWAYS_RECOMMENDED = ['공통', '레퍼런스'];

function youtubeThumb(youtubeUrl: string): string | null {
  const id = extractVideoId(youtubeUrl);
  // mqdefault = 네이티브 16:9 (320x180). hqdefault(4:3 레터박스) 대신 사용해 비율 통일.
  return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null;
}

// 설명에서 핵심 요약 한 줄 추출 (첫 줄)
function firstLine(text: string): string {
  return (text || '').split('\n').map(s => s.trim()).filter(Boolean)[0] || '';
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
  const router = useRouter();
  const [videos, setVideosState] = useState<Video[]>([]);
  const [levels, setLevels] = useState<VideoLevel[]>([]);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('전체');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  // 레벨 테스트
  const [userLevel, setUserLevel] = useState<string | null>(null);
  const [showLevelTest, setShowLevelTest] = useState(false);
  const [hoverCard, setHoverCard] = useState<string | null>(null);

  // ── 강의 요청 ──
  const [reqUser, setReqUser] = useState<{ name: string; email: string }>({ name: '', email: '' });
  const [showRequest, setShowRequest] = useState(false);
  const [reqTitle, setReqTitle] = useState('');
  const [reqContent, setReqContent] = useState('');
  const [reqSubmitting, setReqSubmitting] = useState(false);
  const [reqDone, setReqDone] = useState(false);
  const [reqError, setReqError] = useState('');

  // 강의 요청 폼 프리필용 사용자 정보(로그인 시).
  useEffect(() => {
    fetch('/api/users/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : { user: null })
      .then(d => {
        if (d?.user?.email) {
          setReqUser({ name: d.user.nickname || '', email: d.user.email });
        }
      })
      .catch(() => {});
  }, []);

  // 레벨 테스트: 계정(서버) 기준으로 최초 1회만 노출.
  // localStorage는 기기/브라우저별이라 기기가 바뀌면 재노출되던 버그를,
  // users.level_test_done_at(서버) 기준 판단으로 교정한다.
  // (원하면 사이드바 '레벨 테스트 다시하기'로 언제든 수동 응시 가능)
  useEffect(() => {
    let cancelled = false;

    // 서버 조회 실패 시 폴백: 기존 localStorage 기준(과노출 방지 우선)
    const localFallback = () => {
      try {
        const saved = localStorage.getItem('videoLevel');
        if (saved) {
          setUserLevel(saved);
          setLevelFilter('추천');
        }
        if (!localStorage.getItem('levelTestDone')) {
          localStorage.setItem('levelTestDone', '1');
          setShowLevelTest(true);
        }
      } catch { /* ignore */ }
    };

    (async () => {
      try {
        const res = await fetch('/api/users/me', { cache: 'no-store' });
        const data = await res.json();
        const user = data?.user;
        if (cancelled) return;
        if (!user) { localFallback(); return; }

        // 저장된 레벨 복원
        if (user.videoLevel) {
          setUserLevel(user.videoLevel);
          setLevelFilter('추천');
          try { localStorage.setItem('videoLevel', user.videoLevel); } catch { /* ignore */ }
        }

        // 계정 기준 최초 진입에만 노출 + 즉시 '본 것으로' 서버 기록
        if (!user.levelTestDone) {
          setShowLevelTest(true);
          try { localStorage.setItem('levelTestDone', '1'); } catch { /* ignore */ }
          fetch('/api/level-test/seen', { method: 'POST' }).catch(() => {});
        } else {
          try { localStorage.setItem('levelTestDone', '1'); } catch { /* ignore */ }
        }
      } catch {
        if (!cancelled) localFallback();
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const handleLevelComplete = (r: LevelResult) => {
    try {
      localStorage.setItem('videoLevel', r.level);
      localStorage.setItem('levelTestDone', '1');
    } catch { /* ignore */ }
    setUserLevel(r.level);
    setLevelFilter('추천');
    setShowLevelTest(false);
  };

  const handleLevelSkip = () => {
    try { localStorage.setItem('levelTestDone', '1'); } catch { /* ignore */ }
    setShowLevelTest(false);
  };

  const submitRequest = async () => {
    if (!reqTitle.trim() || !reqContent.trim()) return;
    setReqSubmitting(true);
    setReqError('');
    try {
      const res = await fetch('/api/lecture-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: reqTitle.trim(),
          content: reqContent.trim(),
          name: reqUser.name || undefined,
          email: reqUser.email || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || '요청 제출에 실패했습니다.');
      }
      setReqDone(true);
      setReqTitle('');
      setReqContent('');
    } catch (e) {
      setReqError(e instanceof Error ? e.message : String(e));
    } finally {
      setReqSubmitting(false);
    }
  };

  const closeRequest = () => {
    setShowRequest(false);
    setReqDone(false);
    setReqError('');
    setReqTitle('');
    setReqContent('');
  };

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

  // 추천 = 본인 레벨 + 공통 + 레퍼런스
  const recommendedLevels = userLevel ? [userLevel, ...ALWAYS_RECOMMENDED] : ALWAYS_RECOMMENDED;

  const filtered = videos.filter(v => {
    const matchLevel =
      levelFilter === '전체' ? true
      : levelFilter === '추천' ? recommendedLevels.includes(v.level)
      : v.level === levelFilter;
    const matchSearch =
      v.title.toLowerCase().includes(search.toLowerCase()) ||
      v.description.toLowerCase().includes(search.toLowerCase());
    return matchLevel && matchSearch;
  });

  // 레벨별 영상 수 (동적)
  const levelCounts: Record<string, number> = {};
  videos.forEach(v => { levelCounts[v.level] = (levelCounts[v.level] || 0) + 1; });

  const handleWatch = (video: Video) => {
    // 팝업 대신 영상별 단독 페이지로 이동(공유 가능한 URL).
    // 조회수 증가·시청 보호는 /video/[id] 페이지에서 처리한다.
    router.push(`/video/${encodeURIComponent(video.id)}`);
  };


  const sidebarItems = [
    ...(userLevel ? [{ id: '추천', count: videos.filter(v => recommendedLevels.includes(v.level)).length }] : []),
    { id: '전체', count: videos.length },
    ...levelNames.map(name => ({ id: name, count: levelCounts[name] || 0 })),
  ];

  // ── 카드 렌더 헬퍼 ── (level grouping과 단일 그리드에서 공용)
  const renderVideoCard = (v: Video, idx: number, paletteIdx: number, sessionNo: number | null = null) => {
    const badge = getBadgeStyle(v.level, levels);
    const palette = CARD_PALETTES[paletteIdx % CARD_PALETTES.length];
    const isHover = hoverCard === v.id;
    const thumb = youtubeThumb(v.youtubeUrl);
    const useFallback = !thumb || thumbFailed[v.id];
    const s = getStats(v.id);
    const summary = firstLine(v.description);
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
          {/* 필수 시청 뱃지 — 빨강 배경 + 노랑 글씨, 좌측 상단 */}
          {v.isRequired && (
            <span
              aria-label="필수 시청 영상"
              style={{
                position: 'absolute', top: 8, left: 8, zIndex: 5,
                background: '#E11D2E', color: '#FFD400',
                fontSize: 11, fontWeight: 700, letterSpacing: '-0.01em',
                padding: '4px 8px', borderRadius: 999,
                boxShadow: '0 2px 6px rgba(225,29,46,0.35)',
                fontFamily: T.fontKo, whiteSpace: 'nowrap',
                userSelect: 'none', pointerEvents: 'none',
              }}
            >
              필수 시청
            </span>
          )}
          {/* 재생시간 뱃지 — 우하단 */}
          {v.duration && (
            <span
              aria-label={`재생시간 ${v.duration}`}
              style={{
                position: 'absolute', bottom: 8, right: 8, zIndex: 5,
                background: 'rgba(0,0,0,0.72)', color: '#fff',
                fontSize: 11, fontWeight: 600,
                padding: '3px 7px', borderRadius: 4,
                fontFamily: T.fontEn, whiteSpace: 'nowrap',
                userSelect: 'none', pointerEvents: 'none',
                letterSpacing: '0.03em',
              }}
            >
              {v.duration}
            </span>
          )}
        </div>

        {/* 카드 본문 */}
        <div style={{ padding: 16 }}>
          {/* 세션 번호 (전체 보기에서만 전달됨) */}
          {sessionNo != null && (
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
              color: T.primary, marginBottom: 6, fontFamily: T.fontEn,
            }}>
              SESSION {String(sessionNo).padStart(2, '0')}
            </div>
          )}
          {/* 메타: 레벨 · 조회수 · 단계 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
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
          {/* 제목 — 2줄 고정(말줄임)으로 카드 높이 정렬 */}
          <div style={{
            fontSize: 15, fontWeight: 700, color: T.text,
            letterSpacing: '-0.02em', marginBottom: 6, lineHeight: 1.4,
            fontFamily: T.fontKo,
            display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical' as const, overflow: 'hidden',
            minHeight: 42,
          }}>{v.title}</div>
          {/* 핵심 요약 — 설명 첫 줄 1줄 말줄임 */}
          <p style={{
            margin: 0, fontSize: 13, color: T.textMuted, lineHeight: 1.5,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            minHeight: 20,
          }}>{summary}</p>

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
              {/* 학습 자료(첨부) 뱃지 — count > 0 일 때만 */}
              {(v.attachmentCount ?? 0) > 0 && (
                <div
                  aria-label={`학습 자료 ${v.attachmentCount}개`}
                  title="학습 자료 (첨부파일)"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    color: T.primary, fontSize: 12, fontWeight: 700,
                    fontFamily: T.fontKo,
                  }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                  </svg>
                  {v.attachmentCount}
                </div>
              )}
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

  // 리스트(콤팩트 1행) 아이템 렌더러
  const renderVideoListItem = (v: Video, sessionNo: number | null = null) => {
    const badge = getBadgeStyle(v.level, levels);
    const isHover = hoverCard === v.id;
    const thumb = youtubeThumb(v.youtubeUrl);
    const useFallback = !thumb || thumbFailed[v.id];
    const s = getStats(v.id);
    const summary = firstLine(v.description);
    return (
      <div
        key={v.id}
        onMouseEnter={() => setHoverCard(v.id)}
        onMouseLeave={() => setHoverCard(null)}
        onClick={() => handleWatch(v)}
        style={{
          display: 'flex', gap: 14, alignItems: 'stretch',
          background: T.surface, border: `1px solid ${isHover ? T.primary : T.border}`,
          borderRadius: T.r2, overflow: 'hidden', padding: 10,
          boxShadow: isHover ? T.shadowMd : T.shadowSm,
          cursor: 'pointer', transition: 'all .15s',
        }}
      >
        {/* 썸네일 */}
        <div style={{
          position: 'relative', flexShrink: 0,
          width: 168, aspectRatio: '16/9', borderRadius: T.r, overflow: 'hidden',
          background: useFallback ? T.bg : undefined,
          backgroundImage: useFallback ? `repeating-linear-gradient(135deg, transparent 0 12px, ${T.border} 12px 13px)` : undefined,
        }}>
          {!useFallback && (
            <img src={thumb!} alt={v.title}
              onError={() => setThumbFailed(m => ({ ...m, [v.id]: true }))}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          )}
          {v.isRequired && (
            <span style={{
              position: 'absolute', top: 6, left: 6,
              background: '#E11D2E', color: '#FFD400', fontSize: 10, fontWeight: 700,
              padding: '2px 6px', borderRadius: 999, whiteSpace: 'nowrap',
            }}>필수</span>
          )}
          {v.duration && (
            <span style={{
              position: 'absolute', bottom: 6, right: 6,
              background: 'rgba(0,0,0,0.72)', color: '#fff', fontSize: 10, fontWeight: 600,
              padding: '2px 5px', borderRadius: 3, fontFamily: T.fontEn,
            }}>{v.duration}</span>
          )}
        </div>

        {/* 내용 */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingRight: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            {sessionNo != null && (
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: T.primary, fontFamily: T.fontEn }}>
                SESSION {String(sessionNo).padStart(2, '0')}
              </span>
            )}
            <span style={{
              display: 'inline-flex', alignItems: 'center', height: 18,
              padding: '0 7px', fontSize: 10, background: badge.bg, color: badge.fg,
              borderRadius: 999, fontWeight: 600,
            }}>{v.level}</span>
            {v.stages && v.stages.length > 0 && (
              <span style={{ fontSize: 10, color: T.primary, background: T.primaryLight, padding: '1px 6px', borderRadius: 999, fontWeight: 600 }}>
                {v.stages.length}단계
              </span>
            )}
          </div>
          <div style={{
            fontSize: 15, fontWeight: 700, color: T.text, letterSpacing: '-0.02em',
            lineHeight: 1.35, marginBottom: 3, fontFamily: T.fontKo,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{v.title}</div>
          {summary && (
            <p style={{
              margin: 0, fontSize: 12.5, color: T.textMuted, lineHeight: 1.4,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{summary}</p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 6, fontSize: 11.5, color: T.textFaint }}>
            <span>조회 {v.viewCount.toLocaleString()}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill={s.liked ? T.danger : 'none'} stroke={s.liked ? T.danger : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
              {s.likes_count}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              {s.comments_count}
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

            {/* 강의 요청 버튼 — 찾는 강의가 없을 때 요청 */}
            <button
              onClick={() => setShowRequest(true)}
              style={{
                width: '100%', height: 38, marginBottom: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                border: `1px solid ${T.primary}`, borderRadius: T.r,
                background: T.primaryLight, color: T.primary,
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                fontFamily: T.fontKo, transition: 'background .12s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#DCE8F6')}
              onMouseLeave={e => (e.currentTarget.style.background = T.primaryLight)}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              강의 요청
            </button>

            {/* 레벨 필터 (동적) */}
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
              레벨
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {sidebarItems.map(lv => {
                const on = levelFilter === lv.id;
                const isReco = lv.id === '추천';
                return (
                  <button
                    key={lv.id}
                    onClick={() => setLevelFilter(lv.id)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 12px', borderRadius: T.r,
                      border: isReco ? `1px solid ${on ? T.primary : T.secondaryLight}` : 'none',
                      background: on ? T.primaryLight : (isReco ? T.secondaryLight : 'transparent'),
                      color: on ? T.primary : (isReco ? T.secondaryDark : T.textBody),
                      cursor: 'pointer', fontSize: 14, fontWeight: on || isReco ? 600 : 500,
                      fontFamily: T.fontKo, transition: 'background .12s',
                    }}
                  >
                    <span>{isReco ? `⭐ 추천${userLevel ? ` (${userLevel})` : ''}` : lv.id}</span>
                    <span style={{ fontSize: 12, color: on ? T.primary : T.textFaint, fontWeight: 600 }}>{lv.count}</span>
                  </button>
                );
              })}
            </div>

            {/* 레벨 테스트 다시하기 */}
            <button
              onClick={() => setShowLevelTest(true)}
              style={{
                marginTop: 10, width: '100%', padding: '8px 12px',
                border: `1px dashed ${T.border}`, borderRadius: T.r, background: 'transparent',
                color: T.textMuted, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                fontFamily: T.fontKo, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
              </svg>
              레벨 테스트 다시하기
            </button>

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
            {/* 보기 모드 토글 */}
            <div style={{ display: 'flex', gap: 4, background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.r, padding: 3 }}>
              {([
                { key: 'grid' as const, label: '그리드', icon: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></> },
                { key: 'list' as const, label: '리스트', icon: <><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></> },
              ]).map(m => {
                const on = viewMode === m.key;
                return (
                  <button
                    key={m.key}
                    onClick={() => setViewMode(m.key)}
                    aria-label={`${m.label} 보기`}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                      background: on ? T.surface : 'transparent',
                      color: on ? T.primary : T.textMuted,
                      fontSize: 12, fontWeight: 600, fontFamily: T.fontKo,
                      boxShadow: on ? T.shadowSm : 'none', transition: 'all .12s',
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {m.icon}
                    </svg>
                    {m.label}
                  </button>
                );
              })}
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
                    {/* 해당 레벨 — 세션 순번 부여 (그리드/리스트) */}
                    {viewMode === 'grid' ? (
                      <div style={{
                        display: 'grid', gap: 16,
                        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                      }}>
                        {items.map((v, vidx) => {
                          const idx = filtered.indexOf(v);
                          return renderVideoCard(v, idx, vidx, vidx + 1);
                        })}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {items.map((v, vidx) => renderVideoListItem(v, vidx + 1))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : viewMode === 'grid' ? (
            <div style={{
              display: 'grid', gap: 16,
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            }}>
              {filtered.map((v, idx) => renderVideoCard(v, idx, idx))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.map(v => renderVideoListItem(v))}
            </div>
          )}
        </div>
      </div>

      {/* 레벨 테스트 모달 */}
      {showLevelTest && (
        <LevelTest onComplete={handleLevelComplete} onSkip={handleLevelSkip} />
      )}

      {/* 강의 요청 모달 */}
      {showRequest && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1100,
            background: 'rgba(15,30,51,0.55)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
          onClick={closeRequest}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: T.surface, borderRadius: T.r3,
              boxShadow: '0 16px 48px rgba(15,30,51,0.22)',
              width: '100%', maxWidth: 460, padding: 28,
              fontFamily: T.fontKo, maxHeight: '90vh', overflowY: 'auto',
            }}
          >
            {reqDone ? (
              // 완료 상태
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div style={{
                  width: 52, height: 52, borderRadius: '50%', margin: '0 auto 16px',
                  background: T.successBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={T.success} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
                <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: T.text }}>
                  요청이 접수되었습니다
                </h3>
                <p style={{ margin: '0 0 24px', fontSize: 13.5, color: T.textMuted, lineHeight: 1.6 }}>
                  소중한 의견 감사합니다.<br />검토 후 강의 제작에 반영하겠습니다.
                </p>
                <button
                  onClick={closeRequest}
                  style={{
                    width: '100%', height: 44, borderRadius: T.r, border: 'none',
                    background: T.primary, color: '#fff', fontSize: 14, fontWeight: 600,
                    cursor: 'pointer', fontFamily: T.fontKo,
                  }}
                >
                  확인
                </button>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 20 }}>
                  <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: T.text }}>
                    강의 요청
                  </h3>
                  <p style={{ margin: 0, fontSize: 13, color: T.textMuted, lineHeight: 1.6 }}>
                    듣고 싶은 강의 주제를 알려주세요. 관리자가 검토 후 제작에 반영합니다.
                  </p>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: T.textBody, marginBottom: 6 }}>
                    요청 제목 <span style={{ color: T.danger }}>*</span>
                  </label>
                  <input
                    value={reqTitle}
                    onChange={e => setReqTitle(e.target.value)}
                    maxLength={200}
                    placeholder="예: ChatGPT로 매장 재고관리 자동화하기"
                    style={{
                      width: '100%', height: 42, padding: '0 12px', boxSizing: 'border-box',
                      border: `1px solid ${T.border}`, borderRadius: T.r,
                      fontSize: 14, color: T.text, outline: 'none', fontFamily: T.fontKo,
                    }}
                    onFocus={e => { e.target.style.borderColor = T.primary; e.target.style.boxShadow = `0 0 0 3px ${T.primaryLight}`; }}
                    onBlur={e => { e.target.style.borderColor = T.border; e.target.style.boxShadow = 'none'; }}
                  />
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: T.textBody, marginBottom: 6 }}>
                    요청 내용 <span style={{ color: T.danger }}>*</span>
                  </label>
                  <textarea
                    value={reqContent}
                    onChange={e => setReqContent(e.target.value)}
                    maxLength={2000}
                    rows={5}
                    placeholder="어떤 내용을 배우고 싶으신지 구체적으로 작성해주세요."
                    style={{
                      width: '100%', padding: '10px 12px', boxSizing: 'border-box',
                      border: `1px solid ${T.border}`, borderRadius: T.r, resize: 'vertical',
                      fontSize: 14, color: T.text, outline: 'none', fontFamily: T.fontKo, lineHeight: 1.6,
                    }}
                    onFocus={e => { e.target.style.borderColor = T.primary; e.target.style.boxShadow = `0 0 0 3px ${T.primaryLight}`; }}
                    onBlur={e => { e.target.style.borderColor = T.border; e.target.style.boxShadow = 'none'; }}
                  />
                  <div style={{ textAlign: 'right', fontSize: 11, color: T.textFaint, marginTop: 4 }}>
                    {reqContent.length}/2000
                  </div>
                </div>

                {reqUser.email && (
                  <p style={{ margin: '0 0 14px', fontSize: 12, color: T.textFaint }}>
                    요청자: {reqUser.name ? `${reqUser.name} · ` : ''}{reqUser.email}
                  </p>
                )}

                {reqError && (
                  <p style={{ margin: '0 0 14px', fontSize: 12.5, color: T.danger }}>{reqError}</p>
                )}

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={submitRequest}
                    disabled={!reqTitle.trim() || !reqContent.trim() || reqSubmitting}
                    style={{
                      flex: 1, height: 44, borderRadius: T.r, border: 'none',
                      background: (!reqTitle.trim() || !reqContent.trim() || reqSubmitting) ? '#AFC0D6' : T.primary,
                      color: '#fff', fontSize: 14, fontWeight: 600,
                      cursor: (!reqTitle.trim() || !reqContent.trim() || reqSubmitting) ? 'not-allowed' : 'pointer',
                      fontFamily: T.fontKo,
                    }}
                  >
                    {reqSubmitting ? '제출 중…' : '요청 제출'}
                  </button>
                  <button
                    onClick={closeRequest}
                    style={{
                      flex: '0 0 90px', height: 44, borderRadius: T.r,
                      border: `1px solid ${T.border}`, background: 'transparent',
                      color: T.textMuted, fontSize: 14, fontWeight: 500,
                      cursor: 'pointer', fontFamily: T.fontKo,
                    }}
                  >
                    취소
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
