import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "이랜드리테일 AI 캠퍼스",
  description: "이랜드리테일 AI 교육 허브 — 학습, 제작, 질문, 공유",
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
