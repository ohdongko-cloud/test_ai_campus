import type { Metadata, Viewport } from "next";
import Script from "next/script";
import SwRegister from "../components/SwRegister";
import "./globals.css";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://retail-ai-campus.vercel.app";
const TITLE = "이랜드리테일 AI 캠퍼스";
const DESCRIPTION = "이랜드리테일 AI 교육 허브 — 학습, 제작, 질문, 공유";

export const viewport: Viewport = {
  themeColor: "#1647A8",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: `%s | ${TITLE}` },
  description: DESCRIPTION,
  applicationName: TITLE,
  appleWebApp: {
    capable: true,
    title: "AI 캠퍼스",
    statusBarStyle: "default",
  },
  manifest: "/manifest.webmanifest",
  keywords: [
    "이랜드리테일",
    "AI 캠퍼스",
    "AI 교육",
    "이랜드 AI",
    "사내 AI 학습",
  ],
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: SITE_URL,
    siteName: TITLE,
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+KR:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{
        fontFamily: "var(--font-sans)",
        background: "var(--color-bg)",
        color: "var(--color-ink)",
        WebkitFontSmoothing: "antialiased",
        textRendering: "optimizeLegibility",
      } as React.CSSProperties}>
        {children}
        <SwRegister />
        {/* Kakao JavaScript SDK — PC에서 안드로이드 앱 링크 공유용 */}
        <Script
          src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
