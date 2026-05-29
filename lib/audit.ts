// 인증/관리자 작업 로그 헬퍼.
// auth_logs / admin_audit_logs 두 테이블에 INSERT.

import { sql } from './db';
import { getClientIp } from './ratelimit';

export type AuthLogType =
  | 'login_attempt' | 'login_success' | 'login_failure'
  | 'signup_request' | 'signup_verify_success' | 'signup_verify_failure' | 'signup_complete'
  | 'admin_login_success' | 'admin_login_failure'
  | 'logout'
  | 'rate_limited';

export async function logAuth(opts: {
  type: AuthLogType;
  email?: string | null;
  success: boolean;
  req: Request;
  detail?: string;
}): Promise<void> {
  try {
    const ip = getClientIp(opts.req);
    const ua = opts.req.headers.get('user-agent') || null;
    await sql`
      INSERT INTO auth_logs (type, email, ip, user_agent, success, detail)
      VALUES (${opts.type}, ${opts.email ?? null}, ${ip}, ${ua}, ${opts.success}, ${opts.detail ?? null})`;
  } catch {
    // 로깅 실패가 응답을 막지 않도록
  }
}

export async function logAdminAction(opts: {
  action: string;
  targetType?: string;
  targetId?: string;
  detail?: Record<string, unknown>;
  req: Request;
}): Promise<void> {
  try {
    const ip = getClientIp(opts.req);
    await sql`
      INSERT INTO admin_audit_logs (action, target_type, target_id, ip, detail)
      VALUES (${opts.action}, ${opts.targetType ?? null}, ${opts.targetId ?? null},
              ${ip}, ${opts.detail ? JSON.stringify(opts.detail) : null}::jsonb)`;
  } catch {
    // 로깅 실패가 응답을 막지 않도록
  }
}
