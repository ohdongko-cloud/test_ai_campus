import type { Metadata, Viewport } from 'next';
import MobileTabBar from './_components/MobileTabBar';
import { ToastProvider } from './_components/MobileToast';

export const metadata: Metadata = {
  title: 'Eland AI 캠퍼스',
  description: '이랜드리테일 AI 학습 — 안드로이드 앱 전용',
  robots: { index: false, follow: false }, // 모바일 라우트는 검색엔진 노출 X
  applicationName: 'Eland AI 캠퍼스',
  appleWebApp: {
    capable: true,
    title: 'AI 캠퍼스',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  themeColor: '#1647A8',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F5F7FA',
        color: '#0F1E33',
        fontFamily: '"Noto Sans KR", "Inter", system-ui, sans-serif',
        // 탭바 높이 + 안전영역 만큼 하단 패딩 (콘텐츠가 탭바에 안 가리게)
        paddingBottom: 'calc(64px + env(safe-area-inset-bottom, 0px))',
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      <ToastProvider>
        <main style={{ minHeight: '100vh' }}>{children}</main>
        <MobileTabBar />
      </ToastProvider>
    </div>
  );
}
