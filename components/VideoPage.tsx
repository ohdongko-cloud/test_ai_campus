"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { Video, VideoLevel, VideoStats, VideoComment } from '../lib/types';
import { extractVideoId, getSessionId } from '../lib/utils';
import { enableSecureScreen, disableSecureScreen } from '../lib/secureScreen';
import LevelTest, { LevelResult } from './LevelTest';

// 레벨 테스트 결과와 무관하게 항상 추천에 포함되는 콘텐츠 레벨
const ALWAYS_RECOMMENDED = ['공통', '레퍼런스'];
import StageImageLightbox from './StageImageLightbox';

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
  const [videos, setVideosState] = useState<Video[]>([]);
  const [levels, setLevels] = useState<VideoLevel[]>([]);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('전체');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  // 레벨 테스트
  const [userLevel, setUserLevel] = useState<string | null>(null);
  const [showLevelTest, setShowLevelTest] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [hoverCard, setHoverCard] = useState<string | null>(null);
  const [openStageIdx, setOpenStageIdx] = useState<number | null>(null);
  const [copiedStageIdx, setCopiedStageIdx] = useState<number | null>(null);
  // 영상 모달 크기 — 사용자가 토글로 변경. 기본은 '표준'.
  //   compact: 영상 작게 + 스테이지/스크립트 위주
  //   normal : 영상 + 정보 균형 (기본)
  //   wide   : 영상 위주 (와이드 모니터)
  const [modalSize, setModalSize] = useState<'compact' | 'normal' | 'wide'>('normal');
  // 전체화면
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoAreaRef = useRef<HTMLDivElement>(null);
  // 스테이지 사이드바 — 데스크탑 펼침/접힘, 모바일 오버레이.
  // 모바일은 항상 false 시작. selectedVideo 가 바뀌면 (다른 영상) 신규 stages 기반 재계산.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'stages' | 'comments' | 'attachments'>('stages');
  // 스테이지 인라인 이미지 라이트박스
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // ── 영상 보호용 워터마크 ──
  const [watermarkEmail, setWatermarkEmail] = useState<string>('anon');
  const [wmPosToggle, setWmPosToggle] = useState(0); // 0/1 — 30초마다 위치 swap
  const [externalLinkBlocked, setExternalLinkBlocked] = useState(false);

  // ── 강의 요청 ──
  const [reqUser, setReqUser] = useState<{ name: string; email: string }>({ name: '', email: '' });
  const [showRequest, setShowRequest] = useState(false);
  const [reqTitle, setReqTitle] = useState('');
  const [reqContent, setReqContent] = useState('');
  const [reqSubmitting, setReqSubmitting] = useState(false);
  const [reqDone, setReqDone] = useState(false);
  const [reqError, setReqError] = useState('');

  useEffect(() => {
    fetch('/api/users/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : { user: null })
      .then(d => {
        if (d?.user?.email) {
          setWatermarkEmail(d.user.email);
          setReqUser({ name: d.user.nickname || '', email: d.user.email });
        } else {
          const sid = getSessionId();
          setWatermarkEmail(`anon · ${sid.slice(-8)}`);
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

  useEffect(() => {
    if (!selectedVideo) return;
    const id = setInterval(() => setWmPosToggle(v => v === 0 ? 1 : 0), 30_000);
    return () => clearInterval(id);
  }, [selectedVideo]);

  // 안드로이드 앱: 영상 재생 중 스크린샷/녹화 차단 (FLAG_SECURE)
  useEffect(() => {
    if (!selectedVideo) return;
    enableSecureScreen();
    return () => { disableSecureScreen(); };
  }, [selectedVideo]);

  // 모바일 / 데스크탑 분기 (viewport width 768px 기준).
  // resize 시 모바일 ↔ 데스크탑 전환되면 사이드바 자동 접힘.
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(prev => {
        if (prev !== mobile) {
          // 모드 전환 시 사이드바는 접힘으로 시작
          setSidebarOpen(false);
        }
        return mobile;
      });
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 영상이 바뀔 때마다(모달 열기/다른 영상 선택) 사이드바 초기 상태 재계산.
  // 데스크탑 → 항상 펼침 (stages 유무 무관). 모바일 → 접힘.
  useEffect(() => {
    if (!selectedVideo) return;
    setSidebarOpen(!isMobile);
  }, [selectedVideo?.id, isMobile]); // eslint-disable-line react-hooks/exhaustive-deps

  // YouTube IFrame API — onReady 수신 시 hd1080 품질 요청
  const iframeRef = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
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
  }, []);

  // 전체화면 toggle + fullscreenchange 동기화
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      videoAreaRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // 우클릭/단축키 차단 (모달 내부)
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
    // optimistic 시청수 +1, 서버에는 view 증가 요청 (fail-and-forget)
    const updated = videos.map(v =>
      v.id === video.id ? { ...v, viewCount: v.viewCount + 1 } : v
    );
    setVideosState(updated);
    setSelectedVideo({ ...video, viewCount: video.viewCount + 1 });
    setOpenStageIdx(null);
    setSidebarTab('stages'); // 새 영상은 학습 단계 탭부터
    fetch(`/api/videos/${encodeURIComponent(video.id)}/view`, { method: 'POST' })
      .catch(() => { /* ignore */ });
  };

  // ── 첨부파일 (영상 모달의 학습 자료 섹션 + 카드 뱃지용) ──
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({});
  interface AttachmentItem {
    id: string; filename: string; sizeBytes: number; mimeType: string;
    downloadCount: number; createdAt: string;
  }
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);

  // ── 댓글 ──
  const [comments, setComments] = useState<VideoComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!selectedVideo) {
      setComments([]);
      setAttachments([]);
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
    // 학습 자료 (첨부파일) — 로그인 회원만 응답 받음. 비로그인은 401 → 빈 배열.
    fetch(`/api/videos/${encodeURIComponent(selectedVideo.id)}/attachments`, {
      credentials: 'include',
    })
      .then(r => r.ok ? r.json() : [])
      .then((rows: AttachmentItem[]) => setAttachments(Array.isArray(rows) ? rows : []))
      .catch(() => setAttachments([]));
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
          {/* 항상 보이는 고정 닫기 버튼 (뷰포트 우상단) — 전체화면 시 숨김 */}
          {!isFullscreen && (
            <button
              onClick={e => { e.stopPropagation(); setSelectedVideo(null); }}
              aria-label="닫기"
              title="닫기"
              style={{
                position: 'fixed', top: 14, right: 16, zIndex: 1010,
                width: 40, height: 40, borderRadius: '50%', border: 'none',
                background: 'rgba(15,30,51,0.72)', color: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 6l12 12M18 6l-12 12"/>
              </svg>
            </button>
          )}
          {(() => {
            // 사이즈별 모달/영상 한계 — 한 곳에서 관리.
            const sizeConfig = {
              compact: { maxWidth: 720,  videoMaxVh: 45 },
              normal:  { maxWidth: 960,  videoMaxVh: 55 },
              wide:    { maxWidth: 1280, videoMaxVh: 70 },
            }[modalSize];
            const hasStages = (selectedVideo.stages?.length ?? 0) > 0;
            // 사이드바 폭(데스크탑) — stages 유무 무관하게 항상 포함.
            // 모바일은 오버레이 방식이라 너비 가산 0.
            const sidebarW = !isMobile ? (sidebarOpen ? 320 : 36) : 0;
            // 우측 사이드바 안에 들어갈 학습 단계 카드 리스트.
            // stages 없으면 플레이스홀더 노출. 항상 렌더.
            const stagesPanel = (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 16 }}>
                {!hasStages ? (
                  <div style={{
                    textAlign: 'center', padding: '40px 16px',
                    color: T.textFaint, fontSize: 13, lineHeight: 1.7,
                  }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                      stroke={T.borderStrong} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                      style={{ marginBottom: 10, display: 'block', margin: '0 auto 10px' }}>
                      <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
                    </svg>
                    등록된 학습 단계가<br/>없습니다.
                  </div>
                ) : selectedVideo.stages!.map((stage, idx) => {
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
                        }}>{idx + 1}</span>
                        <span style={{
                          flex: 1, fontSize: 13, fontWeight: 600,
                          color: isOpen ? T.primary : T.text,
                        }}>{stage.title}</span>
                        <svg
                          width="14" height="14" viewBox="0 0 24 24"
                          fill="none" stroke={isOpen ? T.primary : T.textMuted}
                          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                          style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s', flexShrink: 0 }}
                        ><path d="M6 9l6 6 6-6"/></svg>
                      </button>
                      {isOpen && (stage.description || (stage.images && stage.images.length > 0)) && (
                        <div style={{ padding: '10px 14px 12px 14px', background: T.primarySoft }}>
                          {stage.description && (
                            <>
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
                                  }}
                                  aria-label="스테이지 설명 전체 복사"
                                >
                                  {copiedStageIdx === idx ? (
                                    <>
                                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7"/></svg>
                                      복사됨
                                    </>
                                  ) : (
                                    <>
                                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/></svg>
                                      전체 복사
                                    </>
                                  )}
                                </button>
                              </div>
                              <div style={{
                                fontSize: 13, color: T.textBody, lineHeight: 1.65,
                                whiteSpace: 'pre-wrap',
                              }}>{stage.description}</div>
                            </>
                          )}
                          {/* ── 인라인 이미지 그리드 — 클릭 시 라이트박스 ── */}
                          {stage.images && stage.images.length > 0 && (
                            <div style={{
                              marginTop: stage.description ? 12 : 0,
                              display: 'grid', gap: 8,
                              gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                            }}>
                              {stage.images.map((url, ii) => (
                                <button
                                  key={url}
                                  type="button"
                                  onClick={() => setLightbox({ images: stage.images || [], index: ii })}
                                  onContextMenu={e => e.preventDefault()}
                                  style={{
                                    padding: 0, border: 'none', background: 'transparent',
                                    cursor: 'zoom-in', overflow: 'hidden', borderRadius: 8,
                                    aspectRatio: '1 / 1',
                                  }}
                                  aria-label={`스테이지 이미지 ${ii + 1} 확대 보기`}
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={url}
                                    alt={`스테이지 ${idx + 1} 이미지 ${ii + 1}`}
                                    draggable={false}
                                    onDragStart={e => e.preventDefault()}
                                    style={{
                                      width: '100%', height: '100%', objectFit: 'cover',
                                      display: 'block', border: `1px solid ${T.border}`,
                                      borderRadius: 8, userSelect: 'none',
                                      transition: 'transform .2s',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                                  />
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
            );

            // 사이드바 '학습 자료(첨부파일)' 탭 내용.
            const attachmentsPanel = (
              <div style={{ padding: 16 }}>
                {attachments.length === 0 ? (
                  <p style={{ fontSize: 12, color: T.textMuted, textAlign: 'center', padding: '24px 0' }}>
                    등록된 학습 자료가 없습니다.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {attachments.map(att => {
                      const ext = (att.filename.split('.').pop() || '').toLowerCase();
                      const icon = ['pdf'].includes(ext) ? '📄'
                                  : ['ppt','pptx'].includes(ext) ? '📊'
                                  : ['doc','docx'].includes(ext) ? '📝'
                                  : ['xls','xlsx','csv'].includes(ext) ? '📈'
                                  : ['zip','rar','7z'].includes(ext) ? '🗜️'
                                  : ['png','jpg','jpeg','gif','webp'].includes(ext) ? '🖼️'
                                  : ['txt','md'].includes(ext) ? '📃'
                                  : '📎';
                      const sizeStr = att.sizeBytes < 1024 ? `${att.sizeBytes} B`
                                    : att.sizeBytes < 1024*1024 ? `${(att.sizeBytes/1024).toFixed(1)} KB`
                                    : `${(att.sizeBytes/1024/1024).toFixed(1)} MB`;
                      return (
                        <a
                          key={att.id}
                          href={`/api/videos/${encodeURIComponent(selectedVideo.id)}/attachments/${encodeURIComponent(att.id)}/download`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '10px 12px', borderRadius: T.r2,
                            border: `1px solid ${T.border}`, background: T.surface,
                            textDecoration: 'none', color: T.text,
                            transition: 'all .15s',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.borderColor = T.primary;
                            e.currentTarget.style.background = T.primarySoft;
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.borderColor = T.border;
                            e.currentTarget.style.background = T.surface;
                          }}
                        >
                          <span style={{ fontSize: 22 }}>{icon}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {att.filename}
                            </div>
                            <div style={{ fontSize: 10.5, color: T.textMuted, marginTop: 2 }}>
                              {sizeStr} · 다운로드 {att.downloadCount}회
                            </div>
                          </div>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                          </svg>
                        </a>
                      );
                    })}
                    <p style={{ fontSize: 10, color: T.textFaint, marginTop: 6, lineHeight: 1.5 }}>
                      🔒 본 자료는 이랜드리테일 사내 한정입니다. 외부 공유 시 다운로드 이력이 추적됩니다.
                    </p>
                  </div>
                )}
              </div>
            );

            // 사이드바 '댓글' 탭 내용 — 작성 폼 + 목록.
            const commentsPanel = (
              <div style={{ padding: 16 }}>
                {/* 작성 폼 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  <textarea
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    maxLength={1000}
                    rows={3}
                    placeholder="이 영상에 대한 의견을 남겨주세요."
                    style={{
                      width: '100%', padding: '8px 12px',
                      border: `1px solid ${T.border}`, borderRadius: T.r,
                      fontSize: 13, color: T.text, fontFamily: T.fontKo,
                      resize: 'vertical', outline: 'none', background: T.surface,
                      boxSizing: 'border-box',
                    }}
                  />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="삭제용 비밀번호 (선택)"
                    style={{
                      width: '100%', padding: '7px 12px', boxSizing: 'border-box',
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
                      padding: '8px 18px', borderRadius: T.r, border: 'none',
                      background: !newComment.trim() || submitting ? T.borderStrong : T.primary,
                      color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: T.fontKo,
                      cursor: !newComment.trim() || submitting ? 'not-allowed' : 'pointer',
                    }}>
                    {submitting ? '등록 중...' : '댓글 등록'}
                  </button>
                </div>

                {/* 목록 */}
                {commentsLoading ? (
                  <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 13, color: T.textMuted }}>
                    댓글을 불러오는 중...
                  </div>
                ) : comments.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 13, color: T.textFaint }}>
                    아직 댓글이 없습니다.<br/>가장 먼저 의견을 남겨보세요.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {comments.map(c => (
                      <div key={c.id} style={{
                        padding: '10px 12px', background: T.surfaceAlt,
                        border: `1px solid ${T.border}`, borderRadius: T.r,
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
                            <button type="button" onClick={() => deleteComment(c.id)}
                              style={{
                                background: 'transparent', border: 'none', color: T.textFaint,
                                fontSize: 11, cursor: 'pointer', fontFamily: T.fontKo, padding: '2px 6px',
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
            );
            return (

          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: T.surface, borderRadius: T.r3,
              // 모달 폭 = 본문 폭(sizeConfig) + 사이드바 폭(영상 옆에 같이 보이도록).
              // 작은 화면에서는 viewport 95% 가 우선.
              width: '100%',
              maxWidth: `min(${sizeConfig.maxWidth + sidebarW}px, 95vw)`,
              maxHeight: 'calc(100vh - 32px)',
              boxShadow: '0 4px 12px rgba(15,30,51,0.06), 0 16px 40px rgba(15,30,51,0.10)',
              overflow: 'hidden',
              // 모달 자체를 가로 2분할 (좌: 영상+토글+안내+영상정보+댓글 / 우: 사이드바).
              display: 'flex', flexDirection: 'row',
              position: 'relative', // 모바일 사이드바 absolute 기준
              transition: 'max-width .2s ease',
            }}
          >
            {/* 좌측 패널 — 영상 + 토글 + 안내 + 본문(영상정보+댓글). flex column. */}
            <div style={{
              flex: '1 1 0', minWidth: 0,
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}>
            {/* 유튜브 플레이어 + 보호 레이어 */}
            {/* 영상 영역: 16:9 비율 자동 유지 + maxHeight 로 정보 영역 공간 확보.
                전체화면 시: 브라우저 fullscreen API 로 이 div 가 화면 전체를 채움. */}
            <div
              ref={videoAreaRef}
              style={{
                background: '#000', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                // 전체화면: 브라우저가 이 div를 100vw×100vh로 확장. 일반: maxHeight 제한.
                maxHeight: isFullscreen ? '100vh' : `${sizeConfig.videoMaxVh}vh`,
                width: isFullscreen ? '100%' : undefined,
                height: isFullscreen ? '100%' : undefined,
              }}
            >
            <div
              style={{
                aspectRatio: '16/9',
                // 전체화면: 화면 전체를 16:9로 꽉 채움 (contain). 일반: sizeConfig 제한.
                width: isFullscreen ? 'min(100vw, calc(100vh * 16 / 9))' : '100%',
                height: isFullscreen ? 'min(100vh, calc(100vw * 9 / 16))' : undefined,
                maxHeight: isFullscreen ? '100vh' : `${sizeConfig.videoMaxVh}vh`,
                maxWidth: isFullscreen ? 'calc(100vh * 16 / 9)' : `calc(${sizeConfig.videoMaxVh}vh * 16 / 9)`,
                position: 'relative',
              }}
              onContextMenu={blockContext}
              onKeyDown={blockShortcuts}
            >
              <iframe
                ref={iframeRef}
                width="100%" height="100%"
                // 풀스크린·관련영상·자막 자동·키보드 조작 등 외부 노출 경로 최소화.
                // fs=0 → 풀스크린 버튼 숨김. allow 에서도 fullscreen 제거 + allowFullScreen 미지정.
                // enablejsapi=1 → IFrame API 활성화 (고화질 기본값 설정용)
                src={`https://www.youtube.com/embed/${extractVideoId(selectedVideo.youtubeUrl)}?autoplay=1&rel=0&modestbranding=1&iv_load_policy=3&disablekb=1&playsinline=1&fs=0&enablejsapi=1`}
                title={selectedVideo.title}
                allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                style={{ display: 'block', border: 'none' }}
              />
              {/* ── 외부 이동 차단 오버레이 (% 단위 — 영상 크기 무관 동일 비율 유지) ── */}
              {/* 상단 전체 너비: 영상 제목 + 채널 아바타(YouTube 채널로 이동) 클릭 차단.
                  영상 컨트롤은 상단에 없으므로 UX 영향 없음. */}
              <div
                onClick={handleExternalLinkBlock}
                style={{
                  position: 'absolute', top: 0, left: 0,
                  width: '100%', height: '12%', zIndex: 5,
                  cursor: 'not-allowed',
                }}
                aria-hidden="true"
              />
              {/* 우상단 메뉴(공유/저장) 차단 — 상단 차단과 겹쳐도 안전. */}
              <div
                onClick={handleExternalLinkBlock}
                style={{
                  position: 'absolute', top: 0, right: 0,
                  width: '12%', height: '14%', zIndex: 5,
                  cursor: 'not-allowed',
                }}
                aria-hidden="true"
              />
              {/* 우하단 YouTube 로고 + 우측 컨트롤(자막/설정/미니/극장) 일괄 차단.
                  영상 크기 비례로 가려 모달 크기 변경에도 안전. 풀스크린은 fs=0 으로
                  이미 숨김. 재생/일시정지/볼륨/진행바는 좌측에 있어 시청 정상. */}
              <div
                onClick={handleExternalLinkBlock}
                style={{
                  position: 'absolute', bottom: 0, right: 0,
                  width: '22%', height: '14%', zIndex: 5,
                  cursor: 'not-allowed',
                }}
                aria-hidden="true"
              />
              {/* 좌하단 — YouTube 일시정지 시 표시되는 공유하기(화살표) + 저장하기(시계)
                  콜투액션 버튼 차단. 영상 한가운데에 있는 큰 재생/일시정지 버튼과는
                  겹치지 않음. */}
              <div
                onClick={handleExternalLinkBlock}
                style={{
                  position: 'absolute', bottom: 0, left: 0,
                  width: '14%', height: '14%', zIndex: 5,
                  cursor: 'not-allowed',
                }}
                aria-hidden="true"
              />
              {/* 워터마크 — 4 모서리 중 2개씩 표시, 30초마다 swap */}
              {[
                wmPosToggle === 0 ? { top: 10, left: 12 }   : { top: 10, right: 12 },
                wmPosToggle === 0 ? { bottom: 10, right: 12 } : { bottom: 10, left: 12 },
              ].map((pos, i) => (
                <div key={i} aria-hidden="true" style={{
                  position: 'absolute', ...pos, zIndex: 4,
                  pointerEvents: 'none',
                  fontSize: 11, fontWeight: 600, fontFamily: 'sans-serif',
                  color: 'rgba(255,255,255,0.55)',
                  textShadow: '0 0 4px rgba(0,0,0,0.8)',
                  letterSpacing: 0.3, userSelect: 'none',
                }}>
                  {watermarkEmail} · {nowLabel()}
                </div>
              ))}
              {/* 외부 링크 차단 토스트 */}
              {externalLinkBlocked && (
                <div style={{
                  position: 'absolute', bottom: 64, left: '50%', transform: 'translateX(-50%)',
                  zIndex: 10, padding: '8px 14px', borderRadius: 6,
                  background: 'rgba(216,54,76,0.95)', color: '#fff',
                  fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
                }}>
                  외부 사이트로 이동할 수 없습니다.
                </div>
              )}
              {/* 전체화면 나가기 버튼 — fullscreen 진입 시에만 표시 */}
              {isFullscreen && (
                <button
                  onClick={toggleFullscreen}
                  style={{
                    position: 'absolute', top: 12, right: 12, zIndex: 20,
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px', borderRadius: 6, border: 'none',
                    background: 'rgba(0,0,0,0.6)', color: '#fff',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    backdropFilter: 'blur(4px)',
                  }}
                  title="전체화면 나가기"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3"/>
                  </svg>
                  나가기
                </button>
              )}
            </div>
            </div>
            {/* ── 사이즈 토글 바 — 영상 직후, 정보 영역 위. 전체화면 시 숨김. ── */}
            {!isFullscreen && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 4, padding: '8px 12px',
              background: T.surfaceAlt, borderBottom: `1px solid ${T.border}`,
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 11, color: T.textMuted, marginRight: 6, fontWeight: 500 }}>
                창 크기
              </span>
              {([
                { key: 'compact' as const, label: '컴팩트', hint: '스크립트 위주' },
                { key: 'normal'  as const, label: '표준',   hint: '균형' },
                { key: 'wide'    as const, label: '와이드', hint: '영상 위주' },
              ]).map(opt => {
                const active = modalSize === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => setModalSize(opt.key)}
                    title={opt.hint}
                    style={{
                      padding: '4px 12px', borderRadius: 999,
                      border: active ? `1.5px solid ${T.primary}` : `1px solid ${T.border}`,
                      background: active ? T.primaryLight : T.surface,
                      color: active ? T.primary : T.textBody,
                      fontSize: 12, fontWeight: active ? 700 : 500,
                      cursor: 'pointer',
                      transition: 'all .15s',
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
              {/* 전체화면 버튼 */}
              <div style={{ width: 1, height: 16, background: T.border, margin: '0 4px' }} />
              <button
                onClick={toggleFullscreen}
                title="전체화면"
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '4px 12px', borderRadius: 999,
                  border: `1px solid ${T.border}`,
                  background: T.surface, color: T.textBody,
                  fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  transition: 'all .15s',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/>
                </svg>
                전체화면
              </button>
            </div>
            )}
            {/* 사내 한정 자료 안내 */}
            <div style={{
              padding: '8px 16px', background: '#FDF2F4', borderBottom: `1px solid ${T.border}`,
              fontSize: 11, color: T.danger, fontWeight: 600, textAlign: 'center',
              flexShrink: 0,
            }}>
              🔒 본 영상은 이랜드리테일 사내 한정 자료입니다. 외부 공유·녹화·캡처를 금지합니다.
            </div>

            {/* 좌측 패널 close */}
            </div>
            {/* ── 우측 스테이지 사이드바 — stages 유무 무관, 항상 렌더. 전체화면 시 숨김. ── */}
            {/* 모바일 펼침 시 백드롭 */}
            {!isFullscreen && isMobile && sidebarOpen && (
              <div
                onClick={() => setSidebarOpen(false)}
                style={{
                  position: 'absolute', inset: 0, zIndex: 6,
                  background: 'rgba(15,30,51,0.35)',
                }}
                aria-hidden="true"
              />
            )}
            <aside
              id="video-stage-sidebar"
              role="complementary"
              aria-label="학습 단계"
              style={{
                display: isFullscreen ? 'none' : 'flex',
                flexDirection: 'column',
                position: isMobile ? 'absolute' : 'relative',
                top: 0, right: 0, bottom: 0, zIndex: 7,
                width: sidebarOpen ? (isMobile ? '85%' : 320) : 36,
                background: T.surface,
                borderLeft: `1px solid ${T.border}`,
                transition: 'width .2s ease',
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              {/* 토글 핸들 — 사이드바 좌측 가장자리 */}
              <button
                onClick={() => setSidebarOpen(o => !o)}
                aria-expanded={sidebarOpen}
                aria-controls="video-stage-sidebar"
                title={sidebarOpen ? '사이드바 접기' : '학습 단계 펼치기'}
                style={{
                  position: 'absolute', top: 8, left: 0,
                  width: 36, height: 36, borderRadius: 6,
                  background: 'transparent', border: 'none',
                  color: T.textBody, cursor: 'pointer', zIndex: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: sidebarOpen ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform .2s' }}>
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </button>
              {/* 접힘 상태 — 좁은 띠에 세로 라벨 */}
              {!sidebarOpen && (
                <div style={{
                  position: 'absolute', top: 56, left: 0, right: 0,
                  writingMode: 'vertical-rl' as const, textOrientation: 'mixed' as const,
                  transform: 'rotate(180deg)', transformOrigin: 'center',
                  fontSize: 12, fontWeight: 700, color: T.primary,
                  letterSpacing: '0.04em', textAlign: 'center',
                  paddingTop: 8, userSelect: 'none',
                }}>
                  {hasStages ? `학습 단계 (${selectedVideo.stages?.length})` : '학습 단계'}
                </div>
              )}
              {/* 펼침 상태 — stats + 학습단계 헤더 + 카드 리스트 */}
              {sidebarOpen && (() => {
                const s = getStats(selectedVideo.id);
                const badge = getBadgeStyle(selectedVideo.level, levels);
                return (
                  <>
                    {/* ── 작은 영상 제목 (맥락 유지) ── */}
                    <div style={{ padding: '12px 16px 10px 48px', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
                      <div style={{
                        fontSize: 13.5, fontWeight: 700, color: T.text, lineHeight: 1.4,
                        display: '-webkit-box', WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical' as const, overflow: 'hidden',
                      }}>{selectedVideo.title}</div>
                    </div>

                    {/* ── stats 바: 레벨 · 조회수 · 좋아요 · 댓글(버튼) ── */}
                    <div style={{
                      padding: '10px 16px',
                      borderBottom: `1px solid ${T.border}`,
                      background: T.surface, flexShrink: 0,
                      display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                    }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 8px',
                        fontSize: 11, background: badge.bg, color: badge.fg,
                        borderRadius: 999, fontWeight: 600,
                      }}>{selectedVideo.level}</span>
                      <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 500 }}>
                        조회 {selectedVideo.viewCount.toLocaleString()}
                      </span>
                      <div style={{ flex: 1 }} />
                      {/* 좋아요 */}
                      <button
                        type="button"
                        onClick={() => handleToggleLike(selectedVideo.id)}
                        disabled={!!likeBusy[selectedVideo.id]}
                        aria-pressed={!!s.liked}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '3px 8px', borderRadius: 999, cursor: 'pointer',
                          background: s.liked ? T.dangerBg : T.surface,
                          border: `1px solid ${s.liked ? '#FBCBD2' : T.border}`,
                          color: s.liked ? T.danger : T.textBody,
                          fontSize: 11, fontWeight: 600, fontFamily: T.fontKo,
                          opacity: likeBusy[selectedVideo.id] ? 0.6 : 1,
                        }}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24"
                          fill={s.liked ? T.danger : 'none'}
                          stroke={s.liked ? T.danger : T.textMuted}
                          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                        </svg>
                        {s.likes_count}
                      </button>
                      {/* 댓글 버튼 → 댓글 탭 전환 */}
                      <button
                        type="button"
                        onClick={() => setSidebarTab('comments')}
                        aria-label="댓글 보기"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '3px 8px', borderRadius: 999, cursor: 'pointer',
                          background: sidebarTab === 'comments' ? T.primaryLight : T.surface,
                          border: `1px solid ${sidebarTab === 'comments' ? T.primary : T.border}`,
                          color: sidebarTab === 'comments' ? T.primary : T.textBody,
                          fontSize: 11, fontWeight: 600, fontFamily: T.fontKo,
                        }}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                        {s.comments_count}
                      </button>
                    </div>

                    {/* ── 탭 헤더: 학습 단계 | 댓글 | 자료 ── */}
                    <div style={{ display: 'flex', flexShrink: 0, borderBottom: `1px solid ${T.border}` }}>
                      {([
                        { key: 'stages' as const, label: hasStages ? `학습 단계 (${selectedVideo.stages?.length})` : '학습 단계' },
                        { key: 'attachments' as const, label: `📎 자료 (${attachments.length})` },
                        { key: 'comments' as const, label: `댓글 (${s.comments_count})` },
                      ]).map(t => {
                        const on = sidebarTab === t.key;
                        return (
                          <button
                            key={t.key}
                            onClick={() => setSidebarTab(t.key)}
                            style={{
                              flex: 1, padding: '11px 8px', border: 'none', cursor: 'pointer',
                              background: on ? T.surface : T.surfaceAlt,
                              color: on ? T.primary : T.textMuted,
                              fontSize: 12.5, fontWeight: on ? 700 : 500, fontFamily: T.fontKo,
                              borderBottom: on ? `2px solid ${T.primary}` : '2px solid transparent',
                              marginBottom: -1, transition: 'all .12s',
                            }}
                          >
                            {t.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* ── 탭 콘텐츠 ── */}
                    <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                      {sidebarTab === 'stages' ? stagesPanel
                        : sidebarTab === 'attachments' ? attachmentsPanel
                        : commentsPanel}
                    </div>
                  </>
                );
              })()}
            </aside>
          </div>
            );
          })()}
        </div>
      )}

      {/* 스테이지 인라인 이미지 라이트박스 — 모달 위에 표시 */}
      {lightbox && (
        <StageImageLightbox
          images={lightbox.images}
          index={lightbox.index}
          onChangeIndex={(next) => setLightbox(prev => prev ? { ...prev, index: next } : null)}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
