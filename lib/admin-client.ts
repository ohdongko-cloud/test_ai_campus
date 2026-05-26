// 클라이언트 측 어드민 비번 핸들링 + 어드민 API 호출 래퍼.
//
// - 로그인 시 `setAdminPassword(pw)` 로 sessionStorage에 저장.
// - 모든 `/api/admin/*` 호출은 `adminFetch(...)` 로 가서 자동으로
//   `X-Admin-Password` 헤더를 부착.
// - 401 응답 시 자동으로 비번을 비우고 호출자에게 throw.

const KEY = '_admin_pw';

export function getAdminPassword(): string {
  if (typeof window === 'undefined') return '';
  try { return sessionStorage.getItem(KEY) || ''; } catch { return ''; }
}

export function setAdminPassword(pw: string): void {
  if (typeof window === 'undefined') return;
  try { sessionStorage.setItem(KEY, pw); } catch { /* ignore */ }
}

export function clearAdminPassword(): void {
  if (typeof window === 'undefined') return;
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}

export function isAdminAuthenticated(): boolean {
  return !!getAdminPassword();
}

export class AdminAuthError extends Error {
  constructor() { super('관리자 인증이 필요합니다.'); this.name = 'AdminAuthError'; }
}

/**
 * 어드민 API 호출. `X-Admin-Password` 헤더를 자동 부착.
 * 401 응답 시 sessionStorage 비번을 지우고 `AdminAuthError` throw.
 */
export async function adminFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const pw = getAdminPassword();
  const headers = new Headers(init.headers);
  if (pw) headers.set('X-Admin-Password', pw);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(input, { ...init, headers });
  if (res.status === 401) {
    clearAdminPassword();
    throw new AdminAuthError();
  }
  return res;
}
