// 클라이언트 측 어드민 호출 래퍼.
// 인증은 httpOnly 쿠키(admin_session)로 처리되므로 비번을 클라이언트에 보관하지 않는다.

export class AdminAuthError extends Error {
  constructor() { super('관리자 인증이 필요합니다.'); this.name = 'AdminAuthError'; }
}

/** 로그인 — POST /api/admin/login */
export async function adminLogin(password: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
    credentials: 'include',
  });
  if (res.ok) return { ok: true };
  if (res.status === 429) return { ok: false, error: '로그인 시도가 너무 잦습니다. 잠시 후 다시 시도해주세요.' };
  const data = await res.json().catch(() => ({}));
  return { ok: false, error: data?.error || '로그인에 실패했습니다.' };
}

/** 로그아웃 — POST /api/admin/logout */
export async function adminLogout(): Promise<void> {
  try {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' });
  } catch { /* ignore */ }
}

/** 세션 확인 — POST /api/admin/ping */
export async function isAdminAuthenticated(): Promise<boolean> {
  try {
    const res = await fetch('/api/admin/ping', { method: 'POST', credentials: 'include' });
    return res.ok;
  } catch { return false; }
}

/**
 * 어드민 API 호출. 쿠키 자동 포함. 401 시 AdminAuthError throw.
 */
export async function adminFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(input, { ...init, headers, credentials: 'include' });
  if (res.status === 401) throw new AdminAuthError();
  return res;
}
