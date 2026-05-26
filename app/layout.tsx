import type { Metadata } from "next";
import "./globals.css";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://test-ai-campus.vercel.app";
const TITLE = "이랜드리테일 AI 캠퍼스";
const DESCRIPTION = "이랜드리테일 AI 교육 허브 — 학습, 제작, 질문, 공유";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: `%s | ${TITLE}` },
  description: DESCRIPTION,
  applicationName: TITLE,
  keywords: [
    "이랜드리테일",
    "AI 캠퍼스",
    "AI 교육",
    "이랜드 AI",
    "사내 AI 학습",
  ],
  themeColor: "#1647A8",
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
      </body>
    </html>
  );
}
