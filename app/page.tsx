"use client";

import { useState, useEffect } from 'react';
import { TabType } from '../lib/types';
import { getUserInfo, clearUserInfo, UserInfo } from '../lib/utils';
import WelcomePopup from '../components/WelcomePopup';
import BookmarkPrompt, { BeforeInstallPromptEvent } from '../components/BookmarkPrompt';
import MyPageModal from '../components/MyPageModal';
import MainPage from '../components/MainPage';
import AiLevelTest from '../components/AiLevelTest';
import AiLevelPrompt from '../components/AiLevelPrompt';
import VideoPage from '../components/VideoPage';
import MeetingPage from '../components/MeetingPage';
import BoardPage from '../components/BoardPage';
import SharePage from '../components/SharePage';
import AdminDashboard from '../components/AdminDashboard';
import GuidePage from '../components/GuidePage';
import FloatingActions from '../components/FloatingActions';
import LegalModal from '../components/LegalModal';
import PrivacyContent from '../components/policy/PrivacyContent';
import TermsContent from '../components/policy/TermsContent';
import BrandMark from '../components/BrandMark';
import { addClickLog } from '../lib/utils';
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
  const [policyModal, setPolicyModal] = useState<'privacy' | 'terms' | null>(null);
  const [showBookmark, setShowBookmark] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showMyPage, setShowMyPage] = useState(false);
  // AI 레벨테스트 — 선택형 진입 (PRD: docs/prd/2026-06-22-level-test-entry-choice.md)
  const [levelTestNeeded, setLevelTestNeeded] = useState(false);
  const [aiLevelInfo, setAiLevelInfo] = useState<{ level: number; autoScore: number } | null>(null);
  const [levelPromptOpen, setLevelPromptOpen] = useState(false);
  const [promptMode, setPromptMode] = useState<'first' | 'retake'>('first');
  const [retakeToast, setRetakeToast] = useState(false);

  // ── 하루 1회 dismiss 헬퍼 (localStorage, 미가용 시 try/catch 안전) ──
  const getTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const dismissedToday = (): boolean => {
    try {
      return localStorage.getItem('aiLevelPromptDismissedAt') === getTodayStr();
    } catch { return false; }
  };
  const dismissToday = () => {
    try { localStorage.setItem('aiLevelPromptDismissedAt', getTodayStr()); } catch { /* ignore */ }
  };

  // ── 레벨테스트 완료 마커 (localStorage, 30일 재측정 주기) ──
  // 서버 결과 영속이 베스트에포트라 조용히 실패할 수 있음 → 완료 시각을 로컬에도 남겨
  // 30일 이내면 팝업을 억제(과노출 방지). 서버 completed:true면 서버 시각으로 동기화.
  const RETAKE_DAYS = 30;
  const markLevelDone = (atMs?: number) => {
    try { localStorage.setItem('aiLevelCompletedAt', String(atMs ?? Date.now())); } catch { /* ignore */ }
  };
  const localCompletedAtMs = (): number | null => {
    try {
      const at = Number(localStorage.getItem('aiLevelCompletedAt'));
      return Number.isFinite(at) && at > 0 ? at : null;
    } catch { return null; }
  };

  // ── '30일간 보지 않기' 스누즈 (미진단자가 팝업을 30일 미루기) ──
  const snoozePromptFor30Days = () => {
    try { localStorage.setItem('aiLevelPromptSnoozedUntil', String(Date.now() + RETAKE_DAYS * 86400000)); } catch { /* ignore */ }
  };
  const promptSnoozed = (): boolean => {
    try {
      const until = Number(localStorage.getItem('aiLevelPromptSnoozedUntil'));
      return Number.isFinite(until) && until > Date.now();
    } catch { return false; }
  };

  // ── 재측정 토스트 하루 1회 제한 (이미 진단한 사용자 대상 가벼운 알림) ──
  const retakeToastShownToday = (): boolean => {
    try { return localStorage.getItem('aiLevelRetakeToastShownAt') === getTodayStr(); } catch { return false; }
  };
  const markRetakeToastShown = () => {
    try { localStorage.setItem('aiLevelRetakeToastShownAt', getTodayStr()); } catch { /* ignore */ }
  };

  const handleAdminEntry = () => {
    if (hasAdminAccess) setIsAdmin(true);
    else setShowAdminLogin(true);
  };

  const handleAdminInquiry = () => {
    addClickLog('관리자 문의');
    window.open('https://open.kakao.com/o/ssiKWcTf', '_blank', 'noopener,noreferrer');
  };

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
    // WelcomePopup이 닫히고 1.5초 후 즐겨찾기 안내 표시
    if (!localStorage.getItem('bookmark_prompted')) {
      setTimeout(() => setShowBookmark(true), 1500);
    }
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

  // 회원 탈퇴 완료 — 서버 세션은 DELETE에서 이미 정리됨, 클라이언트만 정리
  const handleAccountDeleted = () => {
    clearUserInfo();
    setUserInfo(null);
    setShowMyPage(false);
    setActiveTab('home');
    setShowWelcome(true);
  };

  // ── beforeinstallprompt 캡처 (Chrome/Edge PWA 설치 다이얼로그) ──
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault(); // 브라우저 기본 미니 배너 숨김
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // ── AI 레벨테스트 완료 여부 확인 (로그인 + 환영팝업 닫힌 뒤) ──
  useEffect(() => {
    if (!userInfo || showWelcome) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/ai-level-test/status', { credentials: 'include', cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        // 레벨 정보 갱신 (기존 유지)
        if (!cancelled && data?.latest) setAiLevelInfo({ level: data.latest.level, autoScore: data.latest.autoScore });
        // 서버에 응시기록이 있으면 로컬 완료 마커를 서버 시각으로 동기화(소스 오브 트루스)
        if (!cancelled && data?.completed && data?.latest?.at) {
          const atMs = new Date(data.latest.at).getTime();
          if (Number.isFinite(atMs)) markLevelDone(atMs);
        }
        // ── 진단 안내 정책 ──
        // ① 이미 진단한 사용자(서버 completed:true 또는 로컬 완료 마커 보유): 모달 영구 미노출.
        //    재측정 시기(30일 경과)면 토스트로만 가볍게 안내(하루 1회).
        // ② 미진단 사용자(서버가 명시적으로 completed:false): 선택 팝업 노출.
        //    단 '30일간 보지 않기' 스누즈 또는 오늘 dismiss면 미노출. (모호/파싱실패 시엔 안 띄움)
        const localAt = localCompletedAtMs();
        const hasTested = data?.completed === true || localAt !== null;
        if (!cancelled && hasTested) {
          const overdue = data?.dueForRetake === true
            || (localAt !== null && (Date.now() - localAt) >= RETAKE_DAYS * 86400000);
          if (overdue && !retakeToastShownToday()) {
            setRetakeToast(true);
            markRetakeToastShown();
          }
        } else if (!cancelled && data?.completed === false) {
          if (!promptSnoozed() && !dismissedToday()) {
            setPromptMode('first');
            setLevelPromptOpen(true);
          }
        }
      } catch { /* 실패 시 팝업 안 띄움(앱 차단 방지, fail-open) */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userInfo, showWelcome]);

  // ── 재측정 토스트 자동 숨김 (9초) ──
  useEffect(() => {
    if (!retakeToast) return;
    const t = setTimeout(() => setRetakeToast(false), 9000);
    return () => clearTimeout(t);
  }, [retakeToast]);

  // ── 재방문자 즐겨찾기 안내 (최초 방문자는 WelcomePopup 닫힌 후 표시) ──
  useEffect(() => {
    if (localStorage.getItem('bookmark_prompted')) return;
    const info = getUserInfo();
    if (!info || !info.visited) return; // 최초 방문자: handleWelcomeClose에서 처리
    const t = setTimeout(() => setShowBookmark(true), 2000);
    return () => clearTimeout(t);
  }, []);

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
      case 'home':    return <MainPage onNavigate={navigateTo} levelInfo={aiLevelInfo} onRetake={() => setLevelTestNeeded(true)} />;
      case 'videos':  return <VideoPage />;
      case 'meeting': return <MeetingPage />;
      case 'board':   return <BoardPage />;
      case 'share':   return <SharePage />;
      case 'guide':   return <GuidePage isAdmin={isAdmin} onNavigate={navigateTo} />;
      default:        return <MainPage onNavigate={navigateTo} levelInfo={aiLevelInfo} onRetake={() => setLevelTestNeeded(true)} />;
    }
  };

  const avatarLetter = userInfo?.name ? userInfo.name[0] : '게';
  const displayName  = userInfo?.name ? `${userInfo.name}` : '게스트';

  // ── AI 레벨테스트 응시 화면 ("지금 진단하기" 선택 후 또는 배너 onRetake 경로) ──
  if (levelTestNeeded && userInfo && !isAdmin && !showWelcome) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--color-bg)', overflowY: 'auto' }}>
        <AiLevelTest
          onComplete={(r) => { setLevelTestNeeded(false); markLevelDone(); if (r) setAiLevelInfo({ level: r.level, autoScore: r.autoScore }); }}
          onExit={() => { setLevelTestNeeded(false); dismissToday(); }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)', color: 'var(--color-ink)', fontFamily: 'var(--font-sans)' }}>

      {/* ── 웰컴 팝업 ── */}
      {showWelcome && <WelcomePopup onClose={handleWelcomeClose} />}

      {/* ── AI 레벨 진단 선택 팝업 (미진단자 전용, 완전 선택형) ── */}
      {levelPromptOpen && userInfo && !isAdmin && !showWelcome && (
        <AiLevelPrompt
          mode={promptMode}
          onStart={() => { setLevelPromptOpen(false); setLevelTestNeeded(true); }}
          onLater={() => { setLevelPromptOpen(false); dismissToday(); }}
          onSnooze={() => { setLevelPromptOpen(false); snoozePromptFor30Days(); }}
        />
      )}

      {/* ── 재측정 토스트 (이미 진단한 사용자 — 30일 경과 시 가벼운 알림, 모달 아님) ── */}
      {retakeToast && userInfo && !isAdmin && !showWelcome && (
        <div
          role="status"
          style={{
            position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)',
            zIndex: 55, maxWidth: 'calc(100vw - 32px)',
            display: 'flex', alignItems: 'center', gap: 14,
            background: 'var(--color-ink, #0F1E33)', color: '#fff',
            padding: '13px 16px 13px 18px', borderRadius: 12,
            boxShadow: '0 8px 28px rgba(0,0,0,0.22)',
            fontFamily: 'var(--font-sans, "Noto Sans KR", system-ui, sans-serif)',
            fontSize: 13.5, lineHeight: 1.4,
          }}
        >
          <span style={{ fontWeight: 500 }}>AI 레벨 진단 후 30일이 지났어요. 다시 진단해볼까요?</span>
          <button
            onClick={() => { setRetakeToast(false); setLevelTestNeeded(true); }}
            style={{
              flexShrink: 0, border: 'none', background: 'rgba(255,255,255,0.16)',
              color: '#fff', fontWeight: 700, fontSize: 13, padding: '7px 12px',
              borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            진단하기
          </button>
          <button
            onClick={() => setRetakeToast(false)}
            aria-label="닫기"
            style={{
              flexShrink: 0, border: 'none', background: 'transparent',
              color: 'rgba(255,255,255,0.6)', fontSize: 16, lineHeight: 1,
              cursor: 'pointer', padding: '4px', fontFamily: 'inherit',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── 즐겨찾기 추가 안내 토스트 ── */}
      <BookmarkPrompt
        show={showBookmark}
        deferredPrompt={deferredPrompt}
        onDismiss={() => {
          setShowBookmark(false);
          localStorage.setItem('bookmark_prompted', '1');
        }}
      />

      {/* ── 마이페이지 (비밀번호 변경 / 회원 탈퇴) ── */}
      {showMyPage && userInfo && (
        <MyPageModal
          user={userInfo}
          onClose={() => setShowMyPage(false)}
          onAccountDeleted={handleAccountDeleted}
        />
      )}

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
            <BrandMark size={36} />
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
            {/* User chip — 로그인 시 클릭하면 마이페이지 */}
            <button
              onClick={() => userInfo && setShowMyPage(true)}
              title={userInfo ? '마이페이지' : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '4px 12px 4px 4px', borderRadius: 999,
                border: '1px solid var(--color-line)', background: 'var(--color-surface)',
                cursor: userInfo ? 'pointer' : 'default',
              }}
            >
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
            </button>

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

            {/* (관리자 버튼은 푸터로 이동) */}

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
            {/* (관리자 모드는 푸터로 이동) */}
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
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            {([
              { label: '개인정보처리방침', onClick: () => setPolicyModal('privacy') },
              { label: '이용약관',          onClick: () => setPolicyModal('terms') },
              { label: '관리자 문의',       onClick: handleAdminInquiry },
              { label: '관리자 모드',       onClick: handleAdminEntry, color: 'var(--color-ink-2)' },
            ] as { label: string; onClick: () => void; color?: string }[]).map(l => (
              <button key={l.label}
                onClick={l.onClick}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 12, color: l.color || 'var(--color-ink-3)',
                  padding: 0, fontFamily: 'var(--font-sans)',
                  fontWeight: l.color ? 600 : 500,
                }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--color-ink)')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = l.color || 'var(--color-ink-3)')}
              >{l.label}</button>
            ))}
          </div>
        </div>
      </footer>

      {/* 정책 모달 */}
      {policyModal === 'privacy' && (
        <LegalModal
          title="개인정보처리방침"
          effectiveDate="2026.05.26"
          onClose={() => setPolicyModal(null)}
        >
          <PrivacyContent />
        </LegalModal>
      )}
      {policyModal === 'terms' && (
        <LegalModal
          title="이용약관"
          effectiveDate="2026.05.26"
          onClose={() => setPolicyModal(null)}
        >
          <TermsContent />
        </LegalModal>
      )}

      {/* 우측 하단 플로팅 액션 (미팅요청 + 안드로이드 앱 + 카톡 오픈채팅방) */}
      <FloatingActions onNavigate={navigateTo} />
    </div>
  );
}
