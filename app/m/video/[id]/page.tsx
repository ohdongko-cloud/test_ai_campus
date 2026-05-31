'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { M } from '../../_styles/tokens';
import type { Video } from '../../../../lib/types';
import { extractVideoId, getUserInfo, getSessionId } from '../../../../lib/utils';
import { enableSecureScreen, disableSecureScreen } from '../../../../lib/secureScreen';

export default function MobileVideoWatchPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const videoId = params?.id ? decodeURIComponent(params.id) : '';

  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [wmToggle, setWmToggle] = useState(0); // 0/1 — 30초마다 위치 swap
  const [userInfo, setUserInfo] = useState<ReturnType<typeof getUserInfo>>(null);

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

  // FLAG_SECURE 활성/해제 (모달 마운트~언마운트)
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
        <div style={{ width: 40 }} />
      </header>

      {/* 영상 영역 */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16 / 9',
          background: '#0D1426',
        }}
      >
        {youtubeId ? (
          <iframe
            src={`https://www.youtube.com/embed/${youtubeId}?modestbranding=1&rel=0&playsinline=1&autoplay=0`}
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

      {/* 영상 정보 + 보안 안내 */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 16,
          background: '#0A0F1E',
        }}
      >
        {video && (
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
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', margin: '10px 0 0', lineHeight: 1.5 }}>
                {video.description}
              </p>
            )}
          </div>
        )}

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
      </div>
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
