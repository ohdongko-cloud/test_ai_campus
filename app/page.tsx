"use client";

import { useState, useEffect } from 'react';
import { TabType } from '../lib/types';
import { getUserInfo, UserInfo } from '../lib/utils';
import WelcomePopup from '../components/WelcomePopup';
import MainPage from '../components/MainPage';
import VideoPage from '../components/VideoPage';
import MeetingPage from '../components/MeetingPage';
import BoardPage from '../components/BoardPage';
import SharePage from '../components/SharePage';
import AdminDashboard from '../components/AdminDashboard';
import GuidePage from '../components/GuidePage';

const ADMIN_PASSWORD = 'admin2026';

const TAB_LABELS: { key: TabType; label: string }[] = [
  { key: 'home', label: '홈' },
  { key: 'videos', label: '강의 영상' },
  { key: 'meeting', label: '미팅 요청' },
  { key: 'board', label: '게시판' },
  { key: 'share', label: '서비스 공유' },
  { key: 'guide', label: '핵심 서비스 목록' },
];

export default function Page() {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPw, setAdminPw] = useState('');
  const [adminError, setAdminError] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  useEffect(() => {
    const info = getUserInfo();
    if (!info || !info.visited) {
      setShowWelcome(true);
    } else {
      setUserInfo(info);
    }
  }, []);

  const handleAdminLogin = () => {
    if (adminPw === ADMIN_PASSWORD) {
      setIsAdmin(true);
      setShowAdminLogin(false);
      setAdminPw('');
      setAdminError('');
      setShowPw(false);
    } else {
      setAdminError('비밀번호가 올바르지 않습니다.');
    }
  };

  const handleWelcomeClose = () => {
    setShowWelcome(false);
    setUserInfo(getUserInfo());
  };

  const navigateTo = (tab: TabType) => {
    setActiveTab(tab);
    setMobileNav(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (isAdmin) {
    return <AdminDashboard onExit={() => setIsAdmin(false)} />;
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'home': return <MainPage onNavigate={navigateTo} />;
      case 'videos': return <VideoPage />;
      case 'meeting': return <MeetingPage />;
      case 'board': return <BoardPage />;
      case 'share': return <SharePage />;
      case 'guide': return <GuidePage />;
      default: return <MainPage onNavigate={navigateTo} />;
    }
  };

  const avatarLetter = userInfo?.name ? userInfo.name[0] : '게';
  const displayName = userInfo?.name || '게스트';

  return (
    <div className="min-h-screen font-sans" style={{ background: '#F5F7FA', color: '#0F1E33' }}>
      {/* 웰컴 팝업 */}
      {showWelcome && <WelcomePopup onClose={handleWelcomeClose} />}

      {/* 관리자 로그인 모달 */}
      {showAdminLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-8">
            <h2 className="text-lg font-bold mb-1" style={{ color: '#0F1E33' }}>관리자 인증</h2>
            <p className="text-xs mb-5" style={{ color: '#8A96A8' }}>관리자 비밀번호를 입력하세요</p>
            <div className="relative mb-2">
              <input
                type={showPw ? 'text' : 'password'}
                value={adminPw}
                onChange={e => { setAdminPw(e.target.value); setAdminError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
                placeholder="비밀번호"
                className="w-full rounded-lg px-4 py-2.5 pr-16 text-sm focus:outline-none"
                style={{ border: '1.5px solid #E2E8F0', background: '#F8FAFC', color: '#0F1E33' }}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium transition-colors"
                style={{ color: '#8A96A8' }}
              >
                {showPw ? '숨기기' : '보기'}
              </button>
            </div>
            {adminError && <p className="text-xs text-red-500 mb-2">{adminError}</p>}
            <div className="flex gap-3 mt-5">
              <button
                onClick={handleAdminLogin}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                style={{ background: '#2563EB', color: '#fff' }}
              >
                확인
              </button>
              <button
                onClick={() => { setShowAdminLogin(false); setAdminPw(''); setAdminError(''); setShowPw(false); }}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors"
                style={{ background: '#F1F5F9', color: '#0F1E33' }}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 상단 헤더 — 유리효과 sticky */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(12px) saturate(180%)',
        WebkitBackdropFilter: 'blur(12px) saturate(180%)',
        borderBottom: '1px solid #E8EDF5',
      }}>
        <div style={{
          maxWidth: 1280, margin: '0 auto',
          padding: '0 24px', height: 64,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        }}>
          {/* 로고 */}
          <button
            onClick={() => navigateTo('home')}
            style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'linear-gradient(135deg, #2563EB 0%, #1E40AF 100%)',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(37,99,235,0.25)',
              fontSize: 16, fontWeight: 700,
            }}>A</div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0F1E33', letterSpacing: '-0.02em', lineHeight: 1 }}>
                이랜드리테일 AI 캠퍼스
              </div>
              <div style={{ fontSize: 10, color: '#8A96A8', fontWeight: 500, letterSpacing: '0.08em', marginTop: 2 }}>
                AI LEARNING HUB
              </div>
            </div>
          </button>

          {/* 데스크탑 네비 */}
          <nav className="hidden lg:flex items-center gap-1">
            {TAB_LABELS.map(t => (
              <button
                key={t.key}
                onClick={() => navigateTo(t.key)}
                className="transition-all"
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: 13.5, fontWeight: activeTab === t.key ? 600 : 500,
                  background: activeTab === t.key ? '#EFF4FF' : 'transparent',
                  color: activeTab === t.key ? '#2563EB' : '#4A5568',
                  letterSpacing: '-0.01em', whiteSpace: 'nowrap',
                }}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {/* 우측 — 유저 칩 + 관리자 버튼 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* 유저 아바타 칩 */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '4px 12px 4px 4px', borderRadius: 999,
              background: '#F1F5F9', cursor: 'default',
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
              }}>{avatarLetter}</div>
              <span className="hidden sm:block" style={{ fontSize: 13, fontWeight: 600, color: '#0F1E33' }}>
                {displayName}
              </span>
            </div>

            {/* 관리자 버튼 */}
            <button
              onClick={() => setShowAdminLogin(true)}
              className="transition-colors"
              style={{
                padding: '7px 14px', borderRadius: 8, border: '1.5px solid #E2E8F0',
                background: 'white', color: '#4A5568', fontSize: 13, fontWeight: 500, cursor: 'pointer',
              }}
            >
              관리자
            </button>

            {/* 모바일 햄버거 */}
            <button
              onClick={() => setMobileNav(v => !v)}
              className="lg:hidden transition-colors"
              style={{
                width: 36, height: 36, borderRadius: 8, border: 'none',
                background: mobileNav ? '#EFF4FF' : 'transparent',
                color: mobileNav ? '#2563EB' : '#4A5568', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: 700,
              }}
            >
              {mobileNav ? '✕' : '≡'}
            </button>
          </div>
        </div>

        {/* 모바일 드로어 */}
        {mobileNav && (
          <div style={{
            borderTop: '1px solid #E8EDF5', background: 'rgba(255,255,255,0.98)',
            padding: '8px 16px 16px',
          }}>
            {TAB_LABELS.map(t => (
              <button
                key={t.key}
                onClick={() => navigateTo(t.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '12px 14px', borderRadius: 8,
                  background: activeTab === t.key ? '#EFF4FF' : 'transparent',
                  color: activeTab === t.key ? '#2563EB' : '#4A5568',
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                  fontSize: 14, fontWeight: activeTab === t.key ? 600 : 500,
                  marginBottom: 2,
                }}
              >
                {t.label}
              </button>
            ))}
            <button
              onClick={() => { setMobileNav(false); setShowAdminLogin(true); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '12px 14px', borderRadius: 8,
                background: 'transparent', color: '#8A96A8',
                border: 'none', cursor: 'pointer', textAlign: 'left',
                fontSize: 14, fontWeight: 500, borderTop: '1px solid #F1F5F9', marginTop: 4,
              }}
            >
              관리자 모드
            </button>
          </div>
        )}
      </header>

      {/* 메인 콘텐츠 */}
      <main style={{ minHeight: 'calc(100vh - 64px)' }}>
        {renderTab()}
      </main>

      {/* 푸터 */}
      <footer style={{
        borderTop: '1px solid #E8EDF5', background: 'white',
        padding: '20px 24px', textAlign: 'center',
        fontSize: 12, color: '#8A96A8',
      }}>
        © 2026 이랜드리테일 AI 캠퍼스 · 함께 만들어가는 AI 학습 커뮤니티
      </footer>
    </div>
  );
}
