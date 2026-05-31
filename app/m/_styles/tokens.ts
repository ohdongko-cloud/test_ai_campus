// 모바일 전용 디자인 토큰
// app/m/* 하위 컴포넌트에서만 사용. 데스크톱 컴포넌트는 기존 globals.css 변수 유지.

export const M = {
  // ── 컬러 (이랜드 블루 + 보조) ──
  bg:           '#F5F7FA',
  surface:      '#FFFFFF',
  surfaceAlt:   '#FAFBFD',
  primary:      '#1647A8',
  primaryDark:  '#0B2664',
  primaryLight: '#E6EEF7',
  accent:       '#FF914D',
  accentDark:   '#CC7432',
  accentLight:  '#FFF1E6',
  purple:       '#6940C9',
  purpleDark:   '#462A8C',
  success:      '#1E9E6A',
  successDark:  '#157A4F',
  info:         '#2563EB',
  infoLight:    '#E8EEFB',
  danger:       '#D8364C',
  dangerBg:     '#FCE6EA',
  warn:         '#9C7100',
  warnBg:       '#FFF6DB',

  // ── 텍스트 ──
  text:         '#0F1E33',
  textBody:     '#3B4A63',
  textMuted:    '#6B7A91',
  textFaint:    '#9BA7BC',

  // ── 라인 ──
  border:       '#E5EAF1',
  borderStrong: '#D4DBE6',

  // ── 폰트 ──
  fontKo:       '"Noto Sans KR", "Inter", system-ui, sans-serif',
  fontEn:       '"Inter", system-ui, sans-serif',

  // ── 라운드 ──
  r1: 8,
  r2: 12,
  r3: 16,
  r4: 20,
  r5: 24,
  r6: 28,

  // ── 그림자 ──
  shadowSm: '0 1px 2px rgba(15,30,51,0.04)',
  shadowMd: '0 2px 6px rgba(15,30,51,0.04), 0 8px 24px rgba(15,30,51,0.06)',
  shadowLg: '0 4px 12px rgba(15,30,51,0.08), 0 16px 32px rgba(15,30,51,0.08)',

  // ── 안전 영역 ──
  safeTop:    'env(safe-area-inset-top, 0px)',
  safeBottom: 'env(safe-area-inset-bottom, 0px)',
  safeLeft:   'env(safe-area-inset-left, 0px)',
  safeRight:  'env(safe-area-inset-right, 0px)',

  // ── 탭바 고정 높이 (안드로이드 안전영역 포함 계산용) ──
  tabBarH: 64,

  // ── 컨테이너 ──
  maxW: 720, // 7~10인치 태블릿 가독성 최대 너비
} as const;

// 그라데이션 카드 컬러 셋 (4 메뉴 카드용)
export const MENU_GRADIENTS = {
  learn:   { from: M.primary, to: M.primaryDark },
  make:    { from: M.accent,  to: M.accentDark },
  ask:     { from: M.purple,  to: M.purpleDark },
  share:   { from: M.success, to: M.successDark },
} as const;

export type MenuKind = keyof typeof MENU_GRADIENTS;

// 그라데이션 헬퍼
export function gradient(from: string, to: string, angle = 135) {
  return `linear-gradient(${angle}deg, ${from} 0%, ${to} 100%)`;
}
