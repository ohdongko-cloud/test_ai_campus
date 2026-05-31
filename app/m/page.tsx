'use client';

import { useEffect, useState } from 'react';
import { M } from './_styles/tokens';
import MobileHeader from './_components/MobileHeader';
import MobileWelcome from './_components/MobileWelcome';
import MobileHero from './_components/MobileHero';
import MobileMenuCard from './_components/MobileMenuCard';
import MobileFeaturedVideo from './_components/MobileFeaturedVideo';
import { getUserInfo, type UserInfo } from '../../lib/utils';

export default function MobileHomePage() {
  const [ready, setReady] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  useEffect(() => {
    const info = getUserInfo();
    setUserInfo(info && info.visited ? info : null);
    setReady(true);
  }, []);

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
        <MobileMenuCard />

        {/* 섹션: 추천 강의 */}
        <SectionHeader title="추천 강의" right="전체 보기 ›" />
        <MobileFeaturedVideo
          title="Claude로 첫 챗봇 만들기"
          level="입문"
          duration="12:35"
          views={324}
          author="운영팀"
        />
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
