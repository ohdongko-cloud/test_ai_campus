/**
 * `next`(복귀 경로) 검증 — 동일 오리진 `/`-prefix 경로만 허용한다.
 *
 * 오픈리다이렉트 방지(PRD §2.2·E1). 과거 dot-segment 우회로 실제 취약점이 있었던
 * 로직을 고친 버전이므로 **절대 재구현하지 말고 이 모듈을 그대로 import해서 쓴다**.
 * (원 위치: app/login/page.tsx → 공용 모듈로 추출. app/login과 app/auth/login,
 *  app/auth/callback이 모두 이 함수를 공유한다.)
 *
 * 검증: decodeURIComponent 후 더미 오리진(https://x.invalid)에 new URL(decoded, base)로
 * 해석해 origin이 유지되는지 판정. WHATWG 파서는 TAB/CR/LF를 위치 무관 제거하므로
 * '/\t/evil.com' 같은 제어문자 삽입도 '//evil.com'(프로토콜 상대)으로 드러나 차단된다.
 * 추가로 decoded가 '/'로 시작하지 않으면 거부(상대경로 의미 변화 방지, '\\evil.com' 등).
 * 허용: /sso/authorize?..., /videos, /#board 등 → 파서가 정규화한
 *       u.pathname + u.search + u.hash 반환(제어문자 제거된 안전한 형태, 쿼리·해시 보존).
 * 거부: //evil.com, /\t/evil.com, \\evil.com, https://..., javascript: 등 → '/'
 */
export function sanitizeNext(raw: string | null): string {
  if (!raw) return '/';
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return '/';
  }
  if (!decoded.startsWith('/')) return '/';
  try {
    const base = 'https://x.invalid';
    const u = new URL(decoded, base);
    if (u.origin !== base) return '/';
    const out = u.pathname + u.search + u.hash;
    // ★ 정규화 결과를 한 번 더 판정한다. 위 origin 검사는 정규화 '이전' 값에 대한 것이라
    //   dot-segment를 놓친다: '/..//evil.com' 은 origin이 base 그대로여서 통과하지만
    //   파서가 '..'를 걷어낸 pathname은 '//evil.com'(프로토콜 상대)이 되고, 이 값을
    //   리다이렉트 대상으로 쓰면 https://evil.com 으로 해석된다.
    //   ('/%2e%2e//evil.com', '/foo/..//evil.com', '/..///evil.com' 도 같은 경로)
    if (new URL(out, base).origin !== base) return '/';
    return out;
  } catch {
    return '/';
  }
}

/**
 * 클라이언트 컴포넌트("use client")에서 "지금 위치"를 SSO 로그인 복귀 경로(next)로 계산한다.
 * - 이미 `?next=`가 있으면(예: `/login?next=...` 안에서 렌더된 WelcomePopup/MobileWelcome에서
 *   「사내 계정으로 로그인」 버튼을 누른 경우) 그 값을 그대로 이어받는다.
 * - 없으면 현재 pathname+search+hash를 next로 쓴다(예: 홈 진입 게이트에서 바로 누른 경우 다시 홈으로).
 * - 어느 경로든 sanitizeNext로 한 번 더 검증해 반환한다(호출부에서 추가 검증 불필요).
 */
export function resolveClientNextPath(): string {
  if (typeof window === 'undefined') return '/';
  const params = new URLSearchParams(window.location.search);
  const existingNext = params.get('next');
  if (existingNext) return sanitizeNext(existingNext);
  return sanitizeNext(window.location.pathname + window.location.search + window.location.hash);
}
