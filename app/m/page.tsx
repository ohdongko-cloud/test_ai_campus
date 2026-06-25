'use client';

import { useEffect, useState } from 'react';
import { M } from './_styles/tokens';
import MobileHeader from './_components/MobileHeader';
import MobileWelcome from './_components/MobileWelcome';
import MobileHero from './_components/MobileHero';
import MobileMenuCard from './_components/MobileMenuCard';
import MobileFeaturedVideo from './_components/MobileFeaturedVideo';
import { getUserInfo, type UserInfo } from '../../lib/utils';
import type { Video } from '../../lib/types';

interface MenuCounts {
  videoCount?: number;
  postCount?: number;
  serviceCount?: number;
  resourceCount?: number;
}

interface Featured {
  id?: string;
  title: string;
  level: string;
  duration: string;
  views?: number;
  author?: string;
}

function durationFromVideo(v: Video): string {
  // YouTube URL에서 직접 길이를 못 얻으므로 기본 라벨 사용. 추후 stages 기반 추정 가능.
  return v.stages?.length ? `${v.stages.length}단계` : '강의';
}

function pickFeatured(videos: Video[]): Featured | null {
  if (!videos.length) return null;
  // 1순위: 필수시청 + 조회수 높은 순
  const required = videos
    .filter(v => v.isRequired)
    .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
  const pool = required.length ? required : videos;
  const top = pool[0];
  return {
    id: top.id,
    title: top.title,
    level: top.level || '강의',
    duration: durationFromVideo(top),
    views: top.viewCount,
    author: '운영팀',
  };
}

export default function MobileHomePage() {
  const [ready, setReady] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [counts, setCounts] = useState<MenuCounts>({});
  const [featured, setFeatured] = useState<Featured | null>(null);

  useEffect(() => {
    const info = getUserInfo();
    setUserInfo(info && info.visited ? info : null);
    setReady(true);
  }, []);

  // 사용자 인증된 뒤 실 데이터 fetch
  useEffect(() => {
    if (!userInfo) return;
    let alive = true;

    const safeFetch = async <T,>(url: string): Promise<T | null> => {
      try {
        const r = await fetch(url, { credentials: 'include' });
        if (!r.ok) return null;
        return (await r.json()) as T;
      } catch {
        return null;
      }
    };

    (async () => {
      const [videos, posts, services, resourcesData] = await Promise.all([
        safeFetch<Video[]>('/api/videos'),
        safeFetch<unknown[] | { posts?: unknown[] }>('/api/posts?limit=100'),
        safeFetch<unknown[]>('/api/services'),
        safeFetch<unknown[]>('/api/resources'),
      ]);
      if (!alive) return;

      const videoCount    = Array.isArray(videos) ? videos.length : undefined;
      const postCount     = Array.isArray(posts)
        ? posts.length
        : Array.isArray((posts as { posts?: unknown[] } | null)?.posts)
          ? (posts as { posts: unknown[] }).posts.length
          : undefined;
      const serviceCount  = Array.isArray(services) ? services.length : undefined;
      const resourceCount = Array.isArray(resourcesData) ? resourcesData.length : undefined;

      setCounts({ videoCount, postCount, serviceCount, resourceCount });
      if (Array.isArray(videos)) {
        setFeatured(pickFeatured(videos));
      }
    })();

    return () => { alive = false; };
  }, [userInfo]);

  if (!ready) return <FullPageSpinner />;

  if (!userInfo) {
    return (
      <MobileWelcome
        onSuccess={() => {
          setUserInfo(getUserInfo());
        }}
      />
    );
  }

  return (
    <>
      <MobileHeader
        title="이랜드 AI 캠퍼스"
        initial={userInfo.name?.[0] || '게'}
        notifCount={3}
      />
      <div
        style={{
          paddingTop: 16,
          paddingBottom: 24,
          maxWidth: M.maxW,
          margin: '0 auto',
          fontFamily: M.fontKo,
        }}
      >
        {/* Hero */}
        <MobileHero
          name={userInfo.name}
          subtitle="오늘도 새로운 AI를 만나보세요"
        />

        {/* 섹션: 메뉴 */}
        <SectionHeader title="메뉴" sub="원하는 학습을 시작해보세요" />
        <MobileMenuCard
          videoCount={counts.videoCount}
          postCount={counts.postCount}
          serviceCount={counts.serviceCount}
          resourceCount={counts.resourceCount}
        />

        {/* 섹션: 추천 강의 — 필수시청 영상 중 조회수 1위 */}
        <SectionHeader
          title="추천 강의"
          sub={featured ? '오늘의 필수시청' : undefined}
          right="전체 보기 ›"
        />
        {featured ? (
          <MobileFeaturedVideo
            videoId={featured.id}
            title={featured.title}
            level={featured.level}
            duration={featured.duration}
            views={featured.views}
            author={featured.author}
          />
        ) : (
          <FeaturedPlaceholder />
        )}
      </div>
    </>
  );
}

function SectionHeader({
  title, sub, right,
}: {
  title: string;
  sub?: string;
  right?: string;
}) {
  return (
    <div
      style={{
        margin: '24px 16px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
      }}
    >
      <div>
        <h3 style={{ fontSize: 16, fontWeight: 800, color: M.text, margin: 0 }}>{title}</h3>
        {sub && <p style={{ fontSize: 12, color: M.textMuted, margin: '2px 0 0' }}>{sub}</p>}
      </div>
      {right && <span style={{ fontSize: 12, fontWeight: 700, color: M.primary }}>{right}</span>}
    </div>
  );
}

function FeaturedPlaceholder() {
  return (
    <div
      style={{
        margin: '0 16px',
        padding: 24,
        borderRadius: 16,
        background: M.surface,
        border: `1px solid ${M.border}`,
        textAlign: 'center',
        color: M.textMuted,
        fontSize: 13,
      }}
    >
      추천 강의를 불러오는 중...
    </div>
  );
}

function FullPageSpinner() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: M.bg }}>
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          border: `3px solid ${M.border}`,
          borderTopColor: M.primary,
          animation: 'mspin 0.8s linear infinite',
        }}
      />
      <style>{`@keyframes mspin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
