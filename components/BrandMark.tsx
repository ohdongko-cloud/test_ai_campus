// 공용 브랜드 마크 — 파란 그라데이션 배경 + 흰 "AI" + 우상단 오렌지 점 + 둥근 모서리.
// 사용처: 메인/관리자/모바일 헤더 좌측 상단.
// favicon/apple-icon/OG 이미지는 ImageResponse 기반이라 본 컴포넌트와 별개로 인라인 적용
// (시각 일관성은 유지) — 색상/비율은 모두 동일.

interface Props {
  /** 마크 한 변 크기(px). 기본 32. */
  size?: number;
  /** 둥근 모서리 반경(px). 기본 size * 0.25 — 부드러운 squircle 느낌. */
  radius?: number;
}

export default function BrandMark({ size = 32, radius }: Props) {
  const r = radius ?? Math.round(size * 0.25);
  // 글자/점 크기를 size 비율로 스케일
  const fontSize = Math.round(size * 0.5);     // 32 → 16
  const dotSize = Math.max(4, Math.round(size * 0.18));   // 32 → 6
  const dotOffset = Math.round(size * 0.14);   // 32 → 4

  return (
    <div
      aria-label="AI 캠퍼스"
      style={{
        position: 'relative',
        width: size, height: size, borderRadius: r,
        background: 'linear-gradient(135deg, #1647A8 0%, #0B2664 100%)',
        boxShadow: `0 ${Math.round(size * 0.06)}px ${Math.round(size * 0.18)}px rgba(11, 38, 100, 0.28)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff',
        fontFamily: 'var(--font-eng, "Inter"), system-ui, sans-serif',
        fontWeight: 800,
        fontSize,
        letterSpacing: '-0.04em',
        lineHeight: 1,
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      AI
      {/* 우상단 오렌지 점 */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: dotOffset, right: dotOffset,
          width: dotSize, height: dotSize, borderRadius: '50%',
          background: '#FF914D',
          boxShadow: '0 1px 3px rgba(255,145,77,0.45)',
        }}
      />
    </div>
  );
}
