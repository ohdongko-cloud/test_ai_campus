'use client';

import { M, gradient } from '../_styles/tokens';

interface Stat {
  n: string;
  unit: string;
  label: string;
}

interface Props {
  greeting?: string;
  name: string;
  subtitle?: string;
  stats?: Stat[];
}

const DEFAULT_STATS: Stat[] = [
  { n: '12', unit: '시간', label: '학습 시간' },
  { n: '8',  unit: '강',   label: '완료 강의' },
  { n: '3',  unit: '개',   label: '내 게시글' },
];

function hourGreeting() {
  const h = new Date().getHours();
  if (h < 6) return '깊은 밤이에요';
  if (h < 12) return '좋은 아침이에요';
  if (h < 18) return '오후에도 화이팅';
  return '편안한 저녁 보내세요';
}

export default function MobileHero({ greeting, name, subtitle, stats }: Props) {
  const g = greeting ?? hourGreeting();
  const s = stats ?? DEFAULT_STATS;
  return (
    <div
      style={{
        position: 'relative',
        background: gradient(M.primary, M.primaryDark, 135),
        borderRadius: M.r6,
        boxShadow: M.shadowLg,
        padding: 20,
        color: '#fff',
        overflow: 'hidden',
        margin: '0 16px',
      }}
    >
      {/* 우측 반투명 장식 원 */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: -40,
          right: -60,
          width: 200,
          height: 200,
          borderRadius: 100,
          background: 'rgba(255,255,255,0.08)',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: 60,
          right: -100,
          width: 180,
          height: 180,
          borderRadius: 90,
          background: 'rgba(255,255,255,0.06)',
        }}
      />
      {/* 우상단 오렌지 점 */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: 16,
          right: 24,
          width: 14,
          height: 14,
          borderRadius: 7,
          background: M.accent,
        }}
      />

      {/* 인사 */}
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', margin: '0 0 6px' }}>
        {g}
      </p>
      <h2
        style={{
          fontSize: 28,
          fontWeight: 800,
          color: '#fff',
          letterSpacing: '-0.02em',
          margin: '0 0 12px',
        }}
      >
        {name} 님
      </h2>
      {subtitle && (
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', margin: '0 0 16px' }}>
          {subtitle}
        </p>
      )}

      {/* 통계 박스 3개 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
          marginTop: subtitle ? 0 : 16,
          position: 'relative',
        }}
      >
        {s.map((stat, i) => (
          <div
            key={i}
            style={{
              background: 'rgba(255,255,255,0.15)',
              borderRadius: M.r3,
              padding: '12px 10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: '#fff',
                  fontFamily: M.fontEn,
                }}
              >
                {stat.n}
              </span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>
                {stat.unit}
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
