// 관리자 권한 시스템.
//
// 역할:
//   - master  : MASTER_ADMIN_EMAILS env에 회원 이메일이 포함됨
//   - admin   : DB users.role = 'admin'
//   - legacy  : ADMIN_PASSWORD 비번으로 발급된 admin_session 쿠키 보유 (마스터 동등)
//   - null    : 권한 없음
//
// 권한 키 (10개):
//   videos, meetings, services, chatroom, board, guide, stats, logs, import, admins
//
// master/legacy 는 모든 권한 통과. admin 은 permissions JSON에 키 = true 일 때만 통과.

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { sql } from './db';
import { verifyAdminSession } from './jwt';
import { getCurrentUser } from './session';

export const DEFAULT_ADMIN_PASSWORD = 'admin2026';
export const ADMIN_COOKIE = 'admin_session';
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 24; // 24h

export type AdminRole = 'master' | 'admin' | 'legacy';

export type PermissionKey =
  | 'videos' | 'meetings' | 'services' | 'chatroom'
  | 'board' | 'guide' | 'stats' | 'logs' | 'import' | 'admins';

export const PERMISSION_KEYS: PermissionKey[] = [
  'videos', 'meetings', 'services', 'chatroom',
  'board', 'guide', 'stats', 'logs', 'import', 'admins',
];

export interface AdminContext {
  role: AdminRole;
  email?: string;        // master/admin인 경우
  userId?: string;       // admin인 경우 DB id
  permissions?: Record<string, boolean>;
}

export function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
}

export function checkAdminConfig(): NextResponse | null {
  const env = process.env.NODE_ENV;
  const pw = process.env.ADMIN_PASSWORD;
  if (env === 'production' && (!pw || pw === DEFAULT_ADMIN_PASSWORD)) {
    return NextResponse.json(
      { error: 'ADMIN_PASSWORD 환경변수가 미설정되었거나 기본값입니다.' },
      { status: 503 }
    );
  }
  return null;
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

/** env의 마스터 이메일 리스트 (lowercase) */
export function getMasterEmails(): Set<string> {
  const raw = process.env.MASTER_ADMIN_EMAILS || '';
  return new Set(
    raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  );
}

/**
 * 현재 요청의 어드민 컨텍스트 계산.
 * 우선순위: legacy 쿠키 → master(env) → DB admin → null
 */
export async function getAdminContext(req: Request): Promise<AdminContext | null> {
  void req;
  // 1) legacy: admin_session 쿠키
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_COOKIE)?.value;
    if (token && await verifyAdminSession(token)) {
      return { role: 'legacy' };
    }
  } catch { /* ignore */ }

  // 2) 회원 세션
  const user = await getCurrentUser();
  if (!user) return null;

  const email = user.email.toLowerCase();
  const masters = getMasterEmails();
  if (masters.has(email)) {
    return { role: 'master', email, userId: user.uid };
  }

  // 3) DB role
  try {
    const rows = await sql`
      SELECT id, role, permissions FROM users
      WHERE id = ${user.uid} LIMIT 1`;
    const r = rows[0];
    if (r && r.role === 'admin') {
      return {
        role: 'admin',
        email,
        userId: r.id,
        permissions: (r.permissions || {}) as Record<string, boolean>,
      };
    }
  } catch { /* ignore */ }

  return null;
}

/**
 * 어드민 검증.
 * permission 인자가 주어지면 master/legacy 는 자동 통과, admin은 permissions[key]=true 필요.
 * 통과 시 AdminContext, 실패 시 NextResponse (401/403).
 */
export async function requireAdmin(
  req: Request,
  permission?: PermissionKey,
): Promise<AdminContext | NextResponse> {
  const ctx = await getAdminContext(req);
  if (!ctx) {
    return NextResponse.json({ error: '관리자 인증이 필요합니다.' }, { status: 401 });
  }
  if (permission) {
    if (ctx.role === 'master' || ctx.role === 'legacy') return ctx;
    if (ctx.permissions?.[permission]) return ctx;
    return NextResponse.json({ error: `'${permission}' 권한이 없습니다.` }, { status: 403 });
  }
  return ctx;
}

/** master/legacy 만 통과 (관리자 관리 작업용) */
export async function requireMaster(req: Request): Promise<AdminContext | NextResponse> {
  const ctx = await getAdminContext(req);
  if (!ctx) {
    return NextResponse.json({ error: '관리자 인증이 필요합니다.' }, { status: 401 });
  }
  if (ctx.role === 'master' || ctx.role === 'legacy') return ctx;
  return NextResponse.json({ error: '마스터 관리자 권한이 필요합니다.' }, { status: 403 });
}

/** 응답 시 helper — denied가 NextResponse이면 그것을 그대로 반환 */
export function isDenied(result: AdminContext | NextResponse): result is NextResponse {
  return result instanceof NextResponse;
}

/**
 * 기존 패턴(`const denied = await checkAdmin(req); if (denied) return denied;`) 호환 헬퍼.
 * 통과 시 null, 실패 시 NextResponse 반환.
 */
export async function checkAdmin(req: Request, permission?: PermissionKey): Promise<NextResponse | null> {
  const r = await requireAdmin(req, permission);
  return isDenied(r) ? r : null;
}

/** 감사 로그용 actor 표시 ('legacy' | 이메일) */
export function getActorLabel(ctx: AdminContext): string {
  if (ctx.role === 'legacy') return 'legacy';
  return ctx.email || 'unknown';
}
