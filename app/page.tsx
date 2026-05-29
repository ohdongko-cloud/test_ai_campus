"use client";

import { useState, useEffect } from 'react';
import { TabType } from '../lib/types';
import { getUserInfo, clearUserInfo, UserInfo } from '../lib/utils';
import WelcomePopup from '../components/WelcomePopup';
import MainPage from '../components/MainPage';
import VideoPage from '../components/VideoPage';
import MeetingPage from '../components/MeetingPage';
import BoardPage from '../components/BoardPage';
import SharePage from '../components/SharePage';
import AdminDashboard from '../components/AdminDashboard';
import GuidePage from '../components/GuidePage';
import FloatingActions from '../components/FloatingActions';
import { adminLogin, adminLogout, isAdminAuthenticated } from '../lib/admin-client';

const TAB_LABELS: { key: TabType; label: string }[] = [
  { key: 'home',    label: '홈' },
  { key: 'videos',  label: '강의' },
  { key: 'meeting', label: '미팅' },
  { key: 'board',   label: '게시판' },
  { key: 'share',   label: '공유' },
  { key: 'guide',   label: '서비스 가이드' },
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
  const [hasAdminAccess, setHasAdminAccess] = useState(false); // 권한 보유 (회원 기반)

  useEffect(() => {
    const info = getUserInfo();
    if (!info || !info.visited) {
      setShowWelcome(true);
    } else {
      setUserInfo(info);
    }
    // 같은 탭에서 새로고침해도 어드민 세션 유지 (legacy admin_session 쿠키)
    (async () => {
      if (await isAdminAuthenticated()) setIsAdmin(true);
    })();
    // 회원 세션이면 /me로 권한 확인
    (async () => {
      try {
        const res = await fetch('/api/users/me', { credentials: 'include' });
        const data = await res.json().catch(() => ({}));
        if (data?.user?.isAdmin) setHasAdminAccess(true);
      } catch { /* ignore */ }
    })();
  }, []);

  const handleAdminLogin = async () => {
    const { ok, error } = await adminLogin(adminPw);
    if (!ok) {
      setAdminError(error || '비밀번호가 올바르지 않습니다.');
      return;
    }
    setIsAdmin(true);
    setShowAdminLogin(false);
    setAdminPw('');
    setAdminError('');
    setShowPw(false);
  };

  const handleWelcomeClose = (target?: 'home' | 'videos') => {
    setShowWelcome(false);
    setUserInfo(getUserInfo());
    if (target === 'videos') {
      setActiveTab('videos');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (target === 'home') {
      setActiveTab('home');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleLogout = async () => {
    // 서버 세션 쿠키 삭제 (실패해도 클라이언트 정리 진행)
    try {
      await fetch('/api/users/logout', { method: 'POST', credentials: 'include' });
    } catch { /* ignore */ }
    clearUserInfo();
    setUserInfo(null);
    setActiveTab('home');
    setMobileNav(false);
    setShowWelcome(true);
  };

  // ── Hash 라우팅: 탭 클릭 시 URL hash 갱신 + 브라우저 뒤로/앞으로 동기화 ──
  const VALID_TABS: TabType[] = ['home', 'videos', 'meeting', 'board', 'share', 'guide'];
  const tabFromHash = (h: string): TabType => {
    const t = (h || '').replace(/^#/, '') as TabType;
    return VALID_TABS.includes(t) ? t : 'home';
  };

  // 초기 진입 시 URL hash 반영
  useEffect(() => {
    const initial = tabFromHash(window.location.hash);
    if (initial !== 'home') setActiveTab(initial);
    const onPop = () => {
      setActiveTab(tabFromHash(window.location.hash));
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const navigateTo = (tab: TabType) => {
    if (tab !== activeTab) {
      const newHash = tab === 'home' ? ' ' : '#' + tab;
      // pushState로 history 등록 → 뒤로가기 동작
      window.history.pushState(null, '', newHash === ' ' ? window.location.pathname : newHash);
    }
    setActiveTab(tab);
    setMobileNav(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (isAdmin) {
    return <AdminDashboard onExit={async () => { await adminLogout(); setIsAdmin(false); }} />;
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'home':    return <MainPage onNavigate={navigateTo} />;
      case 'videos':  return <VideoPage />;
      case 'meeting': return <MeetingPage />;
      case 'board':   return <BoardPage />;
      case 'share':   return <SharePage />;
      case 'guide':   return <GuidePage isAdmin={isAdmin} onNavigate={navigateTo} />;
      default:        return <MainPage onNavigate={navigateTo} />;
    }
  };

  const avatarLetter = userInfo?.name ? userInfo.name[0] : '게';
  const displayName  = userInfo?.name ? `${userInfo.name}` : '게스트';

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)', color: 'var(--color-ink)', fontFamily: 'var(--font-sans)' }}>

      {/* ── 웰컴 팝업 ── */}
      {showWelcome && <WelcomePopup onClose={handleWelcomeClose} />}

      {/* ── 관리자 로그인 모달 ── */}
      {showAdminLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(20,24,31,0.5)' }}>
          <div style={{
            background: '#fff', borderRadius: 14,
            boxShadow: '0 16px 48px rgba(0,0,0,0.22)',
            width: '100%', maxWidth: 360, margin: '0 16px', padding: 32,
          }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-ink)', margin: '0 0 4px' }}>관리자 인증</h2>
            <p style={{ fontSize: 12, color: 'var(--color-ink-3)', margin: '0 0 20px' }}>관리자 비밀번호를 입력하세요</p>
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <input
                type={showPw ? 'text' : 'password'}
                value={adminPw}
                onChange={e => { setAdminPw(e.target.value); setAdminError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
                placeholder="비밀번호"
                style={{
                  width: '100%', padding: '10px 44px 10px 12px',
                  borderRadius: 8, fontSize: 13.5, boxSizing: 'border-box',
                  border: '1.5px solid var(--color-line)', background: 'var(--color-bg)',
                  color: 'var(--color-ink)', outline: 'none',
                }}
                autoFocus
              />
              <button type="button" onClick={() => setShowPw(v => !v)}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  fontSize: 11, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--color-ink-3)',
                }}>
                {showPw ? '숨기기' : '보기'}
              </button>
            </div>
            {adminError && <p style={{ fontSize: 12, color: '#ef4444', margin: '0 0 8px' }}>{adminError}</p>}
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                onClick={handleAdminLogin}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 8, border: 'none',
                  background: 'var(--color-primary)', color: '#fff',
                  fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
                }}
              >확인</button>
              <button
                onClick={() => { setShowAdminLogin(false); setAdminPw(''); setAdminError(''); setShowPw(false); }}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 8,
                  border: '1px solid var(--color-line)', background: 'var(--color-surface)',
                  fontSize: 13.5, fontWeight: 500, cursor: 'pointer', color: 'var(--color-ink-2)',
                }}
              >취소</button>
            </div>
          </div>
        </div>
      )}

      {/* ── TopBar ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(250,250,247,0.85)',
        backdropFilter: 'saturate(140%) blur(10px)',
        WebkitBackdropFilter: 'saturate(140%) blur(10px)',
        borderBottom: '1px solid var(--color-line)',
      }}>
        <div style={{
          maxWidth: 'var(--container-max)', margin: '0 auto',
          padding: '0 var(--container-pad)', height: 64,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        }}>

          {/* Brand */}
          <button
            onClick={() => navigateTo('home')}
            style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'var(--color-primary)',
              display: 'grid', placeItems: 'center',
              color: '#fff', fontFamily: 'var(--font-eng)', fontWeight: 700,
              fontSize: 10, letterSpacing: '-0.04em', flexShrink: 0,
            }}>
              Eland
            </div>
            <div style={{
              fontWeight: 700, fontSize: 16, letterSpacing: '-0.01em',
              color: 'var(--color-ink)', whiteSpace: 'nowrap',
            }}>
              이랜드리테일 AI 캠퍼스<span style={{ color: 'var(--color-secondary)' }}>.</span>
            </div>
          </button>

          {/* Desktop nav */}
          <nav className="hidden lg:flex" style={{ alignItems: 'center', gap: 4 }}>
            {TAB_LABELS.map(t => (
              <button
                key={t.key}
                onClick={() => navigateTo(t.key)}
                style={{
                  padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: 14, fontWeight: activeTab === t.key ? 600 : 500,
                  background: activeTab === t.key ? 'var(--color-primary-50)' : 'transparent',
                  color: activeTab === t.key ? 'var(--color-primary)' : 'var(--color-ink-2)',
                  letterSpacing: '-0.01em', whiteSpace: 'nowrap' as const,
                  transition: 'background 120ms ease, color 120ms ease',
                  fontFamily: 'var(--font-sans)',
                }}
                onMouseEnter={e => {
                  if (activeTab !== t.key) {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(0,74,153,0.06)';
                    (e.currentTarget as HTMLElement).style.color = 'var(--color-primary)';
                  }
                }}
                onMouseLeave={e => {
                  if (activeTab !== t.key) {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                    (e.currentTarget as HTMLElement).style.color = 'var(--color-ink-2)';
                  }
                }}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {/* Right: user chip + admin button + hamburger */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {/* User chip */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '4px 12px 4px 4px', borderRadius: 999,
              border: '1px solid var(--color-line)', background: 'var(--color-surface)',
              cursor: 'default',
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, var(--color-primary) 0%, #1B6CD6 100%)',
                display: 'grid', placeItems: 'center',
                color: '#fff', fontFamily: 'var(--font-eng)', fontWeight: 700, fontSize: 12,
              }}>
                {avatarLetter}
              </div>
              <span className="hidden sm:block" style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-ink-2)' }}>
                {displayName}
              </span>
            </div>

            {/* Logout button (로그인 상태일 때만) */}
            {userInfo && (
              <button
                onClick={handleLogout}
                style={{
                  padding: '8px 14px', borderRadius: 8,
                  border: '1px solid var(--color-line)', background: 'var(--color-surface)',
                  color: 'var(--color-ink-3)', fontSize: 13.5, fontWeight: 500, cursor: 'pointer',
                  transition: 'border-color 120ms ease, color 120ms ease',
                  fontFamily: 'var(--font-sans)',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-ink-2)';
                  (e.currentTarget as HTMLElement).style.color = 'var(--color-ink-2)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-line)';
                  (e.currentTarget as HTMLElement).style.color = 'var(--color-ink-3)';
                }}
              >
                로그아웃
              </button>
            )}

            {/* Admin button */}
            <button
              onClick={() => hasAdminAccess ? setIsAdmin(true) : setShowAdminLogin(true)}
              style={{
                padding: '8px 14px', borderRadius: 8,
                border: '1px solid var(--color-line)', background: 'var(--color-surface)',
                color: 'var(--color-ink-2)', fontSize: 13.5, fontWeight: 500, cursor: 'pointer',
                transition: 'border-color 120ms ease',
                fontFamily: 'var(--font-sans)',
              }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--color-ink-2)')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--color-line)')}
            >
              관리자
            </button>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileNav(v => !v)}
              className="lg:hidden"
              style={{
                width: 36, height: 36, borderRadius: 8, border: 'none',
                background: mobileNav ? 'var(--color-primary-50)' : 'transparent',
                color: mobileNav ? 'var(--color-primary)' : 'var(--color-ink-2)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: 700,
              }}
            >
              {mobileNav ? '✕' : '≡'}
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {mobileNav && (
          <div style={{
            borderTop: '1px solid var(--color-line)',
            background: 'rgba(250,250,247,0.98)',
            padding: '8px 16px 16px',
          }}>
            {TAB_LABELS.map(t => (
              <button
                key={t.key}
                onClick={() => navigateTo(t.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '12px 14px', borderRadius: 8,
                  background: activeTab === t.key ? 'var(--color-primary-50)' : 'transparent',
                  color: activeTab === t.key ? 'var(--color-primary)' : 'var(--color-ink-2)',
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                  fontSize: 14, fontWeight: activeTab === t.key ? 600 : 500,
                  marginBottom: 2, fontFamily: 'var(--font-sans)',
                }}
              >
                {t.label}
              </button>
            ))}
            {userInfo && (
              <button
                onClick={handleLogout}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '12px 14px', borderRadius: 8,
                  background: 'transparent', color: 'var(--color-ink-3)',
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                  fontSize: 14, fontWeight: 500,
                  borderTop: '1px solid var(--color-line)', marginTop: 4,
                  fontFamily: 'var(--font-sans)',
                }}
              >
                로그아웃
              </button>
            )}
            <button
              onClick={() => { setMobileNav(false); hasAdminAccess ? setIsAdmin(true) : setShowAdminLogin(true); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '12px 14px', borderRadius: 8,
                background: 'transparent', color: 'var(--color-ink-3)',
                border: 'none', cursor: 'pointer', textAlign: 'left',
                fontSize: 14, fontWeight: 500,
                borderTop: userInfo ? 'none' : '1px solid var(--color-line)', marginTop: userInfo ? 0 : 4,
                fontFamily: 'var(--font-sans)',
              }}
            >
              관리자 모드
            </button>
          </div>
        )}
      </header>

      {/* ── Main content ── */}
      <main style={{ minHeight: 'calc(100vh - 64px)' }}>
        {renderTab()}
      </main>

      {/* ── Footer ── */}
      <footer style={{ borderTop: '1px solid var(--color-line)', padding: '32px 0 48px' }}>
        <div className="ac-container" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 16,
          fontSize: 12, color: 'var(--color-ink-3)',
          fontFamily: 'var(--font-eng)',
        }}>
          <span>© 2026 이랜드리테일 AI 캠퍼스 · Internal Portal</span>
          <div style={{ display: 'flex', gap: 20 }}>
            {['개인정보처리방침', '이용약관', '관리자 문의'].map(l => (
              <button key={l}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--color-ink-3)', padding: 0, fontFamily: 'var(--font-sans)' }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--color-ink)')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--color-ink-3)')}
              >{l}</button>
            ))}
          </div>
        </div>
      </footer>

      {/* 우측 하단 플로팅 액션 (미팅요청 + 안드로이드 앱 + 카톡 오픈채팅방) */}
      <FloatingActions onNavigate={navigateTo} />
    </div>
  );
}
