import { ImageResponse } from 'next/og';

export const runtime = 'edge';
// Skip build-time prerender; render on demand at request time so the font
// fetch (and any transient network hiccup) doesn't break `next build`.
export const dynamic = 'force-dynamic';
export const alt = '이랜드리테일 AI 캠퍼스';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

async function loadKoreanFont(weight: 400 | 700, text: string) {
  // Use an old Firefox UA so Google Fonts returns the WOFF format. Satori
  // (powering next/og) supports TTF/OTF/WOFF but NOT WOFF2, which is what
  // modern UAs would receive.
  const url = `https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@${weight}&text=${encodeURIComponent(text)}`;
  const css = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 6.1; rv:6.0) Gecko/20110814 Firefox/6.0a2',
    },
  }).then(r => r.text());
  const match = css.match(/url\((https:\/\/[^)]+)\)/);
  if (!match) throw new Error('font url parse failed');
  return fetch(match[1]).then(r => r.arrayBuffer());
}

export default async function OGImage() {
  const koText = '이랜드리테일 AI 캠퍼스 학습 제작 질문 공유 지금 시작하기';
  // At least one font must be loaded for satori to compute layout.
  // If the subset fetch fails (network blocked), fall back to a basic
  // Latin-only render — better than a 500.
  const bold = await loadKoreanFont(700, koText).catch(() => null);
  const regular = await loadKoreanFont(400, koText).catch(() => null);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 80px',
          background:
            'linear-gradient(135deg, #0A1530 0%, #102855 45%, #1647A8 100%)',
          fontFamily: 'NotoKR, sans-serif',
          color: '#fff',
          position: 'relative',
        }}
      >
        {/* Accent blobs */}
        <div
          style={{
            position: 'absolute',
            top: -160,
            right: -120,
            width: 460,
            height: 460,
            borderRadius: '50%',
            background:
              'radial-gradient(circle at 30% 30%, rgba(94,160,255,0.55), rgba(94,160,255,0))',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -200,
            left: -160,
            width: 520,
            height: 520,
            borderRadius: '50%',
            background:
              'radial-gradient(circle at 70% 70%, rgba(255,145,77,0.35), rgba(255,145,77,0))',
          }}
        />

        {/* Top row: brand mark + chip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0F1E33',
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: '-0.04em',
            }}
          >
            Eland
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.25)',
              fontSize: 22,
              fontWeight: 600,
              color: '#E8F0FF',
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#FF914D',
                display: 'block',
              }}
            />
            E-Land Retail AI Campus
          </div>
        </div>

        {/* Center: title block */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div
            style={{
              fontSize: 92,
              fontWeight: 700,
              letterSpacing: '-0.04em',
              lineHeight: 1.1,
              display: 'flex',
            }}
          >
            이랜드리테일 AI 캠퍼스
            <span style={{ color: '#FF914D' }}>.</span>
          </div>
          <div
            style={{
              fontSize: 32,
              fontWeight: 400,
              color: 'rgba(255,255,255,0.78)',
              letterSpacing: '-0.01em',
              display: 'flex',
            }}
          >
            학습 · 제작 · 질문 · 공유 — 한 곳에서
          </div>
        </div>

        {/* Bottom: domain + accent */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              fontSize: 24,
              color: 'rgba(255,255,255,0.6)',
              fontWeight: 500,
              fontFamily: 'sans-serif',
            }}
          >
            test-ai-campus.vercel.app
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 22,
              fontWeight: 600,
              padding: '12px 22px',
              borderRadius: 999,
              background: '#fff',
              color: '#0F1E33',
            }}
          >
            지금 시작하기 →
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        ...(bold
          ? [{ name: 'NotoKR', data: bold, weight: 700 as const, style: 'normal' as const }]
          : []),
        ...(regular
          ? [{ name: 'NotoKR', data: regular, weight: 400 as const, style: 'normal' as const }]
          : []),
      ],
    }
  );
}
