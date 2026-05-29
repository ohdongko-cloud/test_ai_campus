// 서버 측 어드민 인증 헬퍼.
// 우선순위:
//   1) httpOnly 쿠키 `admin_session` (JWT) 검증 — 신규 권장
//   2) (레거시 fallback) `X-Admin-Password` 헤더 검증 — 배포 직후 호환용, 곧 제거 예정
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminSession } from './jwt';

export const DEFAULT_ADMIN_PASSWORD = 'admin2026';
export const ADMIN_COOKIE = 'admin_session';
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 24; // 24h

export function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
}

/**
 * 운영 환경에서 ADMIN_PASSWORD가 미설정/기본값이면 즉시 503 반환.
 * 라우트 진입 시 호출.
 */
export function checkAdminConfig(): NextResponse | null {
  const env = process.env.NODE_ENV;
  const pw = process.env.ADMIN_PASSWORD;
  if (env === 'production' && (!pw || pw === DEFAULT_ADMIN_PASSWORD)) {
    return NextResponse.json(
      { error: 'ADMIN_PASSWORD 환경변수가 미설정되었거나 기본값입니다. 운영자는 Vercel 환경변수를 확인하세요.' },
      { status: 503 }
    );
  }
  return null;
}

/** constant-time string compare */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

/**
 * 어드민 검증. 다음 순서로 검사:
 *   1) admin_session 쿠키 (JWT)
 *   2) X-Admin-Password 헤더 (레거시)
 * 통과하면 null, 실패하면 401.
 */
export async function requireAdmin(req: Request): Promise<NextResponse | null> {
  // 1. JWT 쿠키
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_COOKIE)?.value;
    if (token && await verifyAdminSession(token)) return null;
  } catch { /* ignore */ }

  // 2. 헤더 fallback
  const sent = req.headers.get('x-admin-password') || '';
  const expected = getAdminPassword();
  if (sent && safeEqual(sent, expected)) return null;

  return NextResponse.json({ error: '관리자 인증이 필요합니다.' }, { status: 401 });
}
