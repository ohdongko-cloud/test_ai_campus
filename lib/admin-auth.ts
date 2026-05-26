// 서버 측 어드민 인증 헬퍼.
// `X-Admin-Password` 헤더가 환경변수 ADMIN_PASSWORD 와 일치할 때만 통과.
import { NextResponse } from 'next/server';

export const DEFAULT_ADMIN_PASSWORD = 'admin2026';

export function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
}

/**
 * 요청에서 어드민 비번을 검증한다.
 * 통과하면 null 반환. 실패하면 401 NextResponse 반환.
 *
 * 사용 예:
 *   const denied = requireAdmin(req);
 *   if (denied) return denied;
 */
export function requireAdmin(req: Request): NextResponse | null {
  const sent = req.headers.get('x-admin-password') || '';
  const expected = getAdminPassword();
  if (!sent || sent !== expected) {
    return NextResponse.json({ error: '관리자 인증이 필요합니다.' }, { status: 401 });
  }
  return null;
}
