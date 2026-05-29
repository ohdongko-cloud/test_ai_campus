// 서비스 아이콘 매핑 (고정값).
// 가이드 카드의 아이콘 영역에 표시할 URL.
// 우선순위:
//   1) explicit override (이 맵)
//   2) Simple Icons CDN (https://cdn.simpleicons.org/{slug}/{color})
//   3) Google Favicon API (fallback)

const SIMPLE = (slug: string, color?: string) =>
  `https://cdn.simpleicons.org/${slug}${color ? '/' + color : ''}`;

const FAVICON = (domain: string) =>
  `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

// 서비스 ID → 아이콘 URL
export const SERVICE_ICONS: Record<string, string> = {
  // AI 코딩 도구
  'claude-code':  SIMPLE('claude', 'C15F3C'),
  'codex':        SIMPLE('openai', '000000'),
  'antigravity':  FAVICON('antigravity.google'),

  // AI 어시스턴트
  'claude':       SIMPLE('claude', 'C15F3C'),
  'chatgpt':      SIMPLE('openai', '000000'),
  'gemini':       SIMPLE('googlegemini', '8E75B2'),
  'grok':         SIMPLE('x', '000000'),

  // 개발 환경
  'github':       SIMPLE('github', '181717'),
  'codesandbox':  SIMPLE('codesandbox', '000000'),

  // 배포
  'vercel':       SIMPLE('vercel', '000000'),
  'netlify':      SIMPLE('netlify', '00C7B7'),

  // DB
  'supabase':     SIMPLE('supabase', '3FCF8E'),
  'neon':         FAVICON('neon.tech'),
  'render':       SIMPLE('render', '46E3B7'),

  // 운영 인프라
  'resend':       SIMPLE('resend', '000000'),
  'sentry':       SIMPLE('sentry', '362D59'),
  'upstash':      SIMPLE('upstash', '00E9A3'),

  // 협업
  'notion':       SIMPLE('notion', '000000'),
  'slack':        SIMPLE('slack', '4A154B'),
  'flow':         FAVICON('flow.team'),

  // 이미지/영상 AI
  'midjourney':   SIMPLE('midjourney', '000000'),
  'nano-banana':  FAVICON('gemini.google.com'),
  'kling':        FAVICON('klingai.com'),
  'suno':         FAVICON('suno.com'),
  'heygen':       FAVICON('heygen.com'),
  'capcut':       SIMPLE('capcut', '000000'),

  // 디자인
  'miricanvas':   FAVICON('miricanvas.com'),
  'canva':        SIMPLE('canva', '00C4CC'),
  'figma':        SIMPLE('figma', 'F24E1E'),

  // 앱 배포
  'google-play':       SIMPLE('googleplay', '414141'),
  'google-cloud':      SIMPLE('googlecloud', '4285F4'),
  'apple-app-store':   SIMPLE('appstore', '0D96F6'),
};

export function getServiceIcon(itemId: string): string {
  return SERVICE_ICONS[itemId] || FAVICON(itemId);
}
