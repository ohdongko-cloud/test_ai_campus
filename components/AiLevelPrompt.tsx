"use client";

// AI 레벨 진단 진입 선택 팝업 (PRD: docs/prd/2026-06-22-level-test-entry-choice.md)
// 앱을 막지 않는 모달 오버레이. "지금 레벨 진단하기" / "먼저 둘러보기" 두 가지 선택.

interface AiLevelPromptProps {
  mode: 'first' | 'retake';
  onStart: () => void;
  onLater: () => void;
  onSnooze: () => void;   // '30일간 보지 않기' — 30일 스누즈
}

export default function AiLevelPrompt({ mode, onStart, onLater, onSnooze }: AiLevelPromptProps) {
  const isRetake = mode === 'retake';

  const icon = isRetake
    ? (
      // 달력 아이콘(재측정)
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#004A99" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
        <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/>
      </svg>
    )
    : (
      // 차트/레벨 아이콘(최초)
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#004A99" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    );

  const title = isRetake
    ? '이번 달 AI 레벨 재측정 시기예요'
    : '내 AI 활용 레벨을 진단해보세요';

  const desc = isRetake
    ? '지난달 이후 AI 활용 능력이 얼마나 성장했는지 확인해보세요.'
    : '1~2분이면 완료돼요. 진단 후 맞춤 강의를 추천해드려요.';

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(15, 30, 51, 0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 16px',
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 18,
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          width: '100%',
          maxWidth: 420,
          padding: '32px 28px 28px',
          fontFamily: 'var(--font-sans, "Noto Sans KR", system-ui, sans-serif)',
        }}
      >
        {/* 아이콘 */}
        <div
          style={{
            width: 64, height: 64,
            borderRadius: '50%',
            background: 'var(--color-primary-50, #E6EEF7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 20,
          }}
        >
          {icon}
        </div>

        {/* 제목 */}
        <h2
          style={{
            fontSize: 19, fontWeight: 800,
            color: 'var(--color-ink, #0F1E33)',
            margin: '0 0 8px',
            lineHeight: 1.35,
            letterSpacing: '-0.02em',
          }}
        >
          {title}
        </h2>

        {/* 설명 */}
        <p
          style={{
            fontSize: 14, color: 'var(--color-ink-2, #5B6B7E)',
            margin: '0 0 28px',
            lineHeight: 1.65,
          }}
        >
          {desc}
        </p>

        {/* 버튼 영역 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Primary: 지금 진단 */}
          <button
            onClick={onStart}
            style={{
              width: '100%', padding: '13px 0',
              borderRadius: 10, border: 'none',
              background: 'var(--color-primary, #004A99)',
              color: '#fff',
              fontSize: 15, fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: '-0.01em',
              fontFamily: 'inherit',
              transition: 'opacity 120ms ease',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.88'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
          >
            지금 레벨 진단하기
          </button>

          {/* Secondary: 먼저 둘러보기 */}
          <button
            onClick={onLater}
            style={{
              width: '100%', padding: '12px 0',
              borderRadius: 10,
              border: '1.5px solid var(--color-line, #E5EAF1)',
              background: 'var(--color-surface, #FAFAF7)',
              color: 'var(--color-ink-2, #5B6B7E)',
              fontSize: 14, fontWeight: 600,
              cursor: 'pointer',
              letterSpacing: '-0.01em',
              fontFamily: 'inherit',
              transition: 'border-color 120ms ease, color 120ms ease',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-ink-2, #5B6B7E)';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-ink, #0F1E33)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-line, #E5EAF1)';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-ink-2, #5B6B7E)';
            }}
          >
            먼저 둘러보기
          </button>
        </div>

        {/* 30일간 보지 않기 (스누즈) */}
        <button
          onClick={onSnooze}
          style={{
            display: 'block', width: '100%',
            marginTop: 14, padding: '4px 0',
            border: 'none', background: 'transparent',
            color: 'var(--color-ink-3, #9BA7BC)',
            fontSize: 12.5, fontWeight: 500,
            textDecoration: 'underline', textUnderlineOffset: 3,
            cursor: 'pointer', fontFamily: 'inherit',
            transition: 'color 120ms ease',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-ink-2, #5B6B7E)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-ink-3, #9BA7BC)'; }}
        >
          30일간 보지 않기
        </button>

        {/* 안내 문구 */}
        <p
          style={{
            fontSize: 11.5, color: 'var(--color-ink-3, #9BA7BC)',
            textAlign: 'center', marginTop: 10, marginBottom: 0,
            lineHeight: 1.5,
          }}
        >
          언제든 홈 배너에서 다시 진단할 수 있어요
        </p>
      </div>
    </div>
  );
}
