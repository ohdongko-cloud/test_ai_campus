'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { M } from '../../_styles/tokens';
import type { Video, VideoStage } from '../../../../lib/types';
import { extractVideoId, getUserInfo, getSessionId } from '../../../../lib/utils';
import { enableSecureScreen, disableSecureScreen } from '../../../../lib/secureScreen';

interface Attachment {
  id: string;
  filename: string;
  sizeBytes: number;
  mimeType: string;
  downloadCount: number;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${units[i]}`;
}

function iconFor(name: string): string {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (['pdf'].includes(ext)) return '📄';
  if (['doc', 'docx'].includes(ext)) return '📝';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return '📊';
  if (['ppt', 'pptx'].includes(ext)) return '📽';
  if (['zip', 'rar', '7z'].includes(ext)) return '🗜';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return '🖼';
  if (['mp4', 'mov', 'avi'].includes(ext)) return '🎬';
  if (['mp3', 'wav'].includes(ext)) return '🎵';
  return '📎';
}

export default function MobileVideoWatchPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const videoId = params?.id ? decodeURIComponent(params.id) : '';

  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [wmToggle, setWmToggle] = useState(0); // 0/1 — 30초마다 위치 swap
  const [linkCopied, setLinkCopied] = useState(false);
  const [userInfo, setUserInfo] = useState<ReturnType<typeof getUserInfo>>(null);
  const [tab, setTab] = useState<'info' | 'stages' | 'files'>('info');
  const [attachments, setAttachments] = useState<Attachment[] | null>(null);
  const [attachmentsErr, setAttachmentsErr] = useState('');
  const [openStageIdx, setOpenStageIdx] = useState<number | null>(0);

  // 영상 메타 로드
  useEffect(() => {
    if (!videoId) return;
    (async () => {
      try {
        const res = await fetch('/api/videos');
        if (!res.ok) {
          setError('영상을 불러오지 못했습니다.');
          return;
        }
        const list = (await res.json()) as Video[];
        const v = list.find(x => x.id === videoId);
        if (!v) {
          setError('영상을 찾을 수 없습니다.');
          return;
        }
        setVideo(v);
        // 조회수 증가 (best effort)
        fetch(`/api/videos/${encodeURIComponent(videoId)}/view`, { method: 'POST' }).catch(() => {});
      } catch {
        setError('서버에 연결할 수 없습니다.');
      } finally {
        setLoading(false);
      }
    })();
  }, [videoId]);

  // 사용자 정보
  useEffect(() => {
    setUserInfo(getUserInfo());
  }, []);

  // 첨부파일 로드 (Files 탭 활성화 시 lazy)
  useEffect(() => {
    if (tab !== 'files' || attachments !== null || !videoId) return;
    (async () => {
      setAttachmentsErr('');
      try {
        const res = await fetch(`/api/videos/${encodeURIComponent(videoId)}/attachments`, {
          credentials: 'include',
        });
        if (res.status === 401) {
          setAttachmentsErr('로그인이 필요합니다.');
          setAttachments([]);
          return;
        }
        if (!res.ok) throw new Error(String(res.status));
        const rows = (await res.json()) as Attachment[];
        setAttachments(rows);
      } catch {
        setAttachmentsErr('첨부 자료를 불러오지 못했습니다.');
        setAttachments([]);
      }
    })();
  }, [tab, attachments, videoId]);

  // FLAG_SECURE 활성/해제
  useEffect(() => {
    if (!video) return;
    enableSecureScreen();
    return () => {
      disableSecureScreen();
    };
  }, [video]);

  // 워터마크 위치 30초마다 교체
  useEffect(() => {
    if (!video) return;
    const id = window.setInterval(() => setWmToggle(v => (v === 0 ? 1 : 0)), 30_000);
    return () => window.clearInterval(id);
  }, [video]);

  // 안드로이드 백 버튼 → 모달 닫기 (Capacitor)
  useEffect(() => {
    let unsub = () => {};
    (async () => {
      if (typeof window === 'undefined') return;
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform()) return;
        const { App } = await import('@capacitor/app');
        const handle = await App.addListener('backButton', () => {
          router.back();
        });
        unsub = () => handle.remove();
      } catch {
        /* @capacitor/app 미설치 환경 */
      }
    })();
    return () => unsub();
  }, [router]);

  const youtubeId = useMemo(() => video ? extractVideoId(video.youtubeUrl) : null, [video]);
  const watermarkText = useMemo(() => {
    const email = userInfo?.email ?? `anon · ${getSessionId().slice(-8)}`;
    const now = new Date();
    const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    return `${email} · ${ts}`;
  }, [userInfo]);

  const stages: VideoStage[] = video?.stages || [];

  // 공유 링크 복사 — canonical /video/{id} (반응형 페이지, PC·모바일 공용).
  const copyLink = async () => {
    if (!videoId) return;
    const url = typeof window !== 'undefined'
      ? `${window.location.origin}/video/${encodeURIComponent(videoId)}`
      : `/video/${encodeURIComponent(videoId)}`;
    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
        ok = true;
      }
    } catch { ok = false; }
    if (!ok) {
      try {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch { ok = false; }
    }
    if (ok) {
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 1800);
    } else {
      alert('링크 복사에 실패했습니다.');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#0A0F1E',
        color: '#fff',
        fontFamily: M.fontKo,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        paddingTop: M.safeTop,
      }}
    >
      {/* 상단 헤더 */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '12px 16px',
          background: '#050A14',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="닫기"
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            background: 'rgba(255,255,255,0.08)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            fontSize: 18,
            fontWeight: 700,
          }}
        >
          ✕
        </button>
        <div
          style={{
            flex: 1,
            textAlign: 'center',
            fontSize: 14,
            fontWeight: 700,
            color: '#fff',
            padding: '0 12px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {loading ? '불러오는 중...' : video?.title || '영상'}
        </div>
        <button
          type="button"
          onClick={copyLink}
          aria-label="이 영상 링크 복사"
          title="링크 복사"
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            background: linkCopied ? M.accent : 'rgba(255,255,255,0.08)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          {linkCopied ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          )}
        </button>
      </header>

      {/* 영상 영역 — sticky top */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16 / 9',
          background: '#0D1426',
          flexShrink: 0,
        }}
      >
        {youtubeId ? (
          <iframe
            src={`https://www.youtube.com/embed/${youtubeId}?modestbranding=1&rel=0&playsinline=1&autoplay=0&vq=hd1080`}
            title={video?.title || 'video'}
            style={{ width: '100%', height: '100%', border: 'none' }}
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-presentation"
          />
        ) : (
          <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'rgba(255,255,255,0.5)' }}>
            {error || (loading ? '불러오는 중...' : '영상 ID 없음')}
          </div>
        )}

        {/* 워터마크 — 우상단/좌하단 30초 교체 */}
        <Watermark text={watermarkText} position={wmToggle === 0 ? 'tr' : 'bl'} />
      </div>

      {/* 탭바 */}
      <div
        style={{
          display: 'flex',
          background: '#050A14',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}
      >
        <TabButton active={tab === 'info'} onClick={() => setTab('info')} label="정보" />
        <TabButton active={tab === 'stages'} onClick={() => setTab('stages')} label={`학습 단계${stages.length ? ` ${stages.length}` : ''}`} />
        <TabButton active={tab === 'files'} onClick={() => setTab('files')} label={`자료${attachments ? ` ${attachments.length}` : ''}`} />
      </div>

      {/* 콘텐츠 영역 */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 16,
          background: '#0A0F1E',
        }}
      >
        {tab === 'info' && video && (
          <>
            <div
              style={{
                background: 'rgba(255,255,255,0.04)',
                borderRadius: M.r4,
                padding: 16,
                marginBottom: 12,
              }}
            >
              <h1 style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: '0 0 6px' }}>
                {video.title}
              </h1>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: 0 }}>
                {video.level} · 조회 {video.viewCount ?? 0}
              </p>
              {video.description && (
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', margin: '10px 0 0', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {video.description}
                </p>
              )}
            </div>

            {/* 외부 공유 금지 안내 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'rgba(255,145,77,0.18)',
                color: M.accent,
                borderRadius: M.r3,
                padding: '12px 14px',
                fontSize: 12,
                fontWeight: 700,
                marginBottom: 12,
              }}
            >
              <span aria-hidden style={{ width: 8, height: 8, borderRadius: 4, background: M.accent }} />
              본 영상은 사내 한정 자료입니다 · 외부 공유 금지
            </div>

            {/* FLAG_SECURE 안내 */}
            <div
              style={{
                background: M.danger,
                borderRadius: M.r3,
                padding: '14px 16px',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
                화면 캡처·녹화 차단 중
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)' }}>
                안드로이드 FLAG_SECURE 활성화 — 영상 보호 작동 중
              </div>
            </div>
          </>
        )}

        {tab === 'stages' && (
          <>
            {stages.length === 0 ? (
              <EmptyState msg="학습 단계 정보가 없습니다." />
            ) : (
              stages.map((s, i) => (
                <StageItem
                  key={s.id || i}
                  index={i}
                  stage={s}
                  open={openStageIdx === i}
                  onToggle={() => setOpenStageIdx(openStageIdx === i ? null : i)}
                />
              ))
            )}
          </>
        )}

        {tab === 'files' && (
          <>
            {attachments === null ? (
              <Loading msg="불러오는 중..." />
            ) : attachmentsErr ? (
              <EmptyState msg={attachmentsErr} />
            ) : attachments.length === 0 ? (
              <EmptyState msg="첨부 자료가 없습니다." />
            ) : (
              attachments.map(a => (
                <a
                  key={a.id}
                  href={`/api/videos/${encodeURIComponent(videoId)}/attachments/${encodeURIComponent(a.id)}`}
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: 12,
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: M.r3,
                    color: '#fff',
                    textDecoration: 'none',
                    marginBottom: 8,
                  }}
                >
                  <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{iconFor(a.filename)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: '#fff',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {a.filename}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
                      {formatBytes(a.sizeBytes)} · 다운로드 {a.downloadCount}
                    </div>
                  </div>
                  <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.7)' }}>↓</span>
                </a>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: '14px 8px',
        background: 'transparent',
        border: 'none',
        borderBottom: active ? '2px solid #fff' : '2px solid transparent',
        color: active ? '#fff' : 'rgba(255,255,255,0.6)',
        fontSize: 13,
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: M.fontKo,
      }}
    >
      {label}
    </button>
  );
}

function StageItem({
  index, stage, open, onToggle,
}: {
  index: number;
  stage: VideoStage;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.04)',
        borderRadius: M.r3,
        marginBottom: 8,
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%',
          padding: '14px 16px',
          background: 'transparent',
          border: 'none',
          color: '#fff',
          textAlign: 'left',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontFamily: M.fontKo,
        }}
      >
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            background: M.primary,
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            fontSize: 11,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {index + 1}
        </span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#fff', textAlign: 'left' }}>
          {stage.title}
        </span>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', flexShrink: 0 }}>
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open && stage.description && (
        <div
          style={{
            padding: '0 16px 14px',
            fontSize: 13,
            color: 'rgba(255,255,255,0.85)',
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
          }}
        >
          {stage.description}
        </div>
      )}
    </div>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: 32,
        color: 'rgba(255,255,255,0.5)',
        fontSize: 13,
      }}
    >
      {msg}
    </div>
  );
}

function Loading({ msg }: { msg: string }) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: 32,
        color: 'rgba(255,255,255,0.5)',
        fontSize: 13,
      }}
    >
      {msg}
    </div>
  );
}

function Watermark({ text, position }: { text: string; position: 'tr' | 'bl' }) {
  const style: React.CSSProperties = {
    position: 'absolute',
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: '"Inter", system-ui, sans-serif',
    pointerEvents: 'none',
    background: 'rgba(0,0,0,0.25)',
    padding: '3px 8px',
    borderRadius: 4,
    transition: 'all 800ms ease',
    ...(position === 'tr'
      ? { top: 12, right: 12 }
      : { bottom: 12, left: 12 }),
  };
  return <div style={style}>{text}</div>;
}
