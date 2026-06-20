"use client";

/**
 * /login — SSO authorize 복귀 게이트.
 *
 * authorize 라우트(/sso/authorize)는 허브 세션 없을 때
 *   /login?next=<encodeURIComponent(authorize pathname+search)>
 * 로 302 리다이렉트한다(PRD §2.2).
 *
 * 이 페이지는:
 *  1. next 쿼리를 읽어 동일 오리진 `/`-prefix 경로인지 검증 (오픈리다이렉트 방지 §7.1/E1).
 *  2. 이미 로그인 상태면 next(또는 /)로 즉시 이동.
 *  3. 미로그인이면 기기에 따라 UI 분기:
 *     - 모바일(max-width 640px): MobileWelcome (app/m/_components)
 *     - 데스크톱: WelcomePopup (기존)
 *  4. 로그인·가입 완료 콜백에서 sanitizeNext(next)로 검증된 경로로 router.replace.
 *
 * 모바일 감지(B안): 클라이언트 마운트 후 window.matchMedia('(max-width: 640px)') 1회 평가.
 * SSR에서는 미결정(null) → 동일 로딩 화면 유지 → 하이드레이션 미스매치 없음.
 */

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import WelcomePopup from '../../components/WelcomePopup';
import MobileWelcome from '../m/_components/MobileWelcome';
import { getUserInfo } from '../../lib/utils';

// ── 동일 오리진 /‑prefix 경로만 허용 (오픈리다이렉트 방지) ──────────────────
// 허용: /sso/authorize?..., /videos, /#board 등 / 로 시작하는 경로
// 거부: //evil.com, http://..., \\ 로 시작 등 외부/프로토콜 상대 경로
function sanitizeNext(raw: string | null): string {
  if (!raw) return '/';
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return '/';
  }
  // 반드시 /로 시작, // 또는 \로 시작하면 거부, http(s):// 등 프로토콜 거부
  if (
    !decoded.startsWith('/') ||
    decoded.startsWith('//') ||
    decoded.startsWith('/\\') ||
    /^\/[a-zA-Z][a-zA-Z0-9+\-.]*:/.test(decoded)
  ) {
    return '/';
  }
  return decoded;
}

// ── 내부 컴포넌트: useSearchParams 사용 (Suspense 경계 필요) ─────────────────
function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextRaw = searchParams.get('next');
  const nextPath = sanitizeNext(nextRaw);

  const [checked, setChecked] = useState(false);    // 세션 확인 완료 여부
  const [showPopup, setShowPopup] = useState(false); // 로그인 UI 표시 여부
  // null = SSR/마운트 전 미결정, true/false = 클라이언트 판정 완료
  // → SSR과 초기 클라이언트 렌더가 동일 null 상태를 가지므로 하이드레이션 미스매치 없음
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  // 언마운트 후 비동기 setState/router 호출 방지 (렌더 루프 가드)
  const mountedRef = useRef(true);

  // 클라이언트 마운트 시 모바일 여부 판정 (matchMedia 1회 평가, 이벤트 리스너 없음)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsMobile(window.matchMedia('(max-width: 640px)').matches);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    // 이미 로그인 상태인지 확인 (로컬스토리지 + 서버 세션)
    const localInfo = getUserInfo();
    const localLoggedIn = !!(localInfo && localInfo.visited);

    if (!localLoggedIn) {
      // 미로그인 → 로그인 UI 즉시 표시
      setChecked(true);
      setShowPopup(true);
      return;
    }

    // 로컬은 있지만 서버 세션도 살아있는지 확인
    fetch('/api/users/me', { credentials: 'include' })
      .then(r => r.json())
      .catch(() => ({}))
      .then((data: { user?: { id?: string } }) => {
        if (!mountedRef.current) return;
        if (data?.user?.id) {
          // 서버 세션 정상 → next로 바로 이동
          router.replace(nextPath);
        } else {
          // 서버 세션 만료 → 재로그인 UI 표시
          setChecked(true);
          setShowPopup(true);
        }
      });

    return () => { mountedRef.current = false; };
    // nextPath는 마운트 시 1회만 필요 — deps 의도적 생략
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 로그인/가입 완료 콜백 — WelcomePopup(onClose) 전용: target 파라미터 무시하고 next로 이동
  const handleDesktopClose = (_target?: 'home' | 'videos') => {
    setShowPopup(false);
    router.replace(nextPath);
  };

  // MobileWelcome(onSuccess) 콜백 — 로그인 성공 시 next로 이동
  const handleMobileSuccess = () => {
    setShowPopup(false);
    router.replace(nextPath);
  };

  // 세션 확인 중 또는 모바일 판정 전 — 빈 배경만 표시(flash 방지)
  if (!checked && !showPopup) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--color-bg, #F5F7FA)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      />
    );
  }

  if (showPopup) {
    // 모바일 판정 전(null)이면 로딩 화면 유지 — 깜빡임 없이 판정 후 분기
    if (isMobile === null) {
      return (
        <div
          style={{
            minHeight: '100vh',
            background: 'var(--color-bg, #F5F7FA)',
          }}
        />
      );
    }
    // 모바일: MobileWelcome 전체화면
    if (isMobile) {
      return <MobileWelcome onSuccess={handleMobileSuccess} />;
    }
    // 데스크톱: 기존 WelcomePopup
    return <WelcomePopup onClose={handleDesktopClose} />;
  }

  // 이미 로그인 + router.replace 진행 중 — 빈 화면 유지
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--color-bg, #F5F7FA)',
      }}
    />
  );
}

// ── 페이지 루트: Suspense로 useSearchParams 경계 감쌈 ─────────────────────────
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: '100vh',
            background: 'var(--color-bg, #F5F7FA)',
          }}
        />
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}
