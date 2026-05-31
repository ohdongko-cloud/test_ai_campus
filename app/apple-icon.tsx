import { ImageResponse } from 'next/og';

// iOS 홈 화면 아이콘 (180×180). 첨부 풀 디자인 재현:
// 파란 그라데이션 + 큰 흰 "AI" + 우상단 오렌지 점 + "CAMPUS" + "ELAND · 사내 AI 학습"
// iOS 가 자동으로 추가 마스킹하므로 borderRadius 는 안전 마진.
export const runtime = 'edge';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1647A8 0%, #0B2664 100%)',
          color: '#fff',
          borderRadius: 36,
          fontFamily: 'sans-serif',
          padding: '24px 16px',
        }}
      >
        {/* 우상단 오렌지 점 */}
        <div
          style={{
            position: 'absolute',
            top: 28,
            right: 36,
            width: 20,
            height: 20,
            borderRadius: 999,
            background: '#FF914D',
          }}
        />
        {/* 메인 AI */}
        <div
          style={{
            fontSize: 90,
            fontWeight: 800,
            letterSpacing: '-0.06em',
            lineHeight: 1,
            display: 'flex',
          }}
        >
          AI
        </div>
        {/* CAMPUS */}
        <div
          style={{
            marginTop: 12,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: '0.1em',
            color: 'rgba(255,255,255,0.95)',
            display: 'flex',
          }}
        >
          CAMPUS
        </div>
        {/* ELAND · 사내 AI 학습 */}
        <div
          style={{
            marginTop: 10,
            fontSize: 11,
            fontWeight: 500,
            color: 'rgba(255,255,255,0.55)',
            letterSpacing: '0.04em',
            display: 'flex',
          }}
        >
          ELAND · 사내 AI 학습
        </div>
      </div>
    ),
    { ...size }
  );
}
