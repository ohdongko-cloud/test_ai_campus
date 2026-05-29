// 사용자 세션 관리 (JWT 쿠키)
import { cookies } from 'next/headers';
import { signUserSession, verifyUserSession, UserSessionPayload } from './jwt';

export const USER_COOKIE = 'user_session';

export const SESSION_TTL_SHORT = 60 * 60 * 6;        // 6시간 (기본)
export const SESSION_TTL_LONG  = 60 * 60 * 24 * 30;  // 30일 (자동로그인)

export async function setUserSessionCookie(uid: string, email: string, rememberMe: boolean): Promise<void> {
  const ttl = rememberMe ? SESSION_TTL_LONG : SESSION_TTL_SHORT;
  const token = await signUserSession(uid, email, ttl);
  const cookieStore = await cookies();
  cookieStore.set(USER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    // rememberMe면 maxAge 명시 → 영구 쿠키. 미체크면 maxAge 생략 → 세션 쿠키.
    ...(rememberMe ? { maxAge: ttl } : {}),
  });
}

export async function clearUserSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(USER_COOKIE);
}

export async function getCurrentUser(): Promise<UserSessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(USER_COOKIE)?.value;
    if (!token) return null;
    return await verifyUserSession(token);
  } catch { return null; }
}
