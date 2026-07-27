// 인증/관리자 작업 로그 헬퍼.
// auth_logs / admin_audit_logs 두 테이블에 INSERT.

import { sql } from './db';
import { getClientIp } from './ratelimit';

export type AuthLogType =
  | 'login_attempt' | 'login_success' | 'login_failure'
  | 'signup_request' | 'signup_verify_success' | 'signup_verify_failure' | 'signup_complete'
  | 'reset_request' | 'reset_verify_success' | 'reset_verify_failure' | 'reset_password_success'
  | 'change_password_success' | 'change_password_failure'
  | 'account_delete'
  | 'admin_login_success' | 'admin_login_failure'
  | 'logout'
  | 'rate_limited'
  | 'attachment_download';

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

// SSO 관측(Tier1) 이벤트 타입. 블루프린트 §4.1.
//   issue                  : id_token 발급 성공
//   deny_unknown_app       : 미등록 app
//   deny_redirect_mismatch : redirect_uri 화이트리스트 불일치
//   deny_state_missing     : state 파라미터 누락(CSRF 방어)
//   login_required         : 미로그인(허브 세션 없음) — v1은 원시 행 미기록(§4.1, 로그인 관련 판단 근거는
//                             app/sso/authorize/route.ts 주석 참조), 타입만 예약.
//   rate_limited           : authorize IP 레이트리밋 초과
//   logout                 : /sso/logout 호출
export type SsoEventType =
  | 'issue' | 'deny_unknown_app' | 'deny_redirect_mismatch'
  | 'deny_state_missing' | 'login_required' | 'rate_limited' | 'logout';

const SSO_EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[\w.-]+/g;

/** 로그 인젝션·PII 방지: 제어문자 제거 + 이메일 패턴 마스킹 + 길이 상한(§4.4/§6-M2). */
function sanitizeSsoLogText(input: string, maxLen: number): string {
  const masked = input.replace(SSO_EMAIL_PATTERN, '[email]');
  // eslint-disable-next-line no-control-regex
  const stripped = masked.replace(/[\x00-\x1f\x7f]/g, '');
  return stripped.length > maxLen ? stripped.slice(0, maxLen) : stripped;
}

/**
 * SSO 이벤트 기록(sso_events). 기존 logAuth와 동일 패턴 — getClientIp 재사용, 실패는 삼킴(가용성 우선).
 * detail에는 kit 버전 등 최소 정보만. 토큰 원문·전체 쿼리스트링은 호출부에서 절대 넘기지 않을 것.
 */
export async function logSsoEvent(opts: {
  event: SsoEventType;
  app: string;
  email?: string | null;
  req: Request;
  detail?: string;
}): Promise<void> {
  try {
    const ip = getClientIp(opts.req);
    // UA도 공격자 제어값(헤더 상한 ~8~16KB) — 원문 저장 시 행 크기가 증폭되므로 255자로 절단.
    const uaRaw = opts.req.headers.get('user-agent');
    const ua = uaRaw ? sanitizeSsoLogText(uaRaw, 255) : null;
    // app은 미등록 요청의 원문 그대로가 들어올 수 있으므로(공격 시도 관측 목적) 새니타이즈만 하고 거부하지 않는다.
    const app = sanitizeSsoLogText(opts.app || '', 64);
    const detail = opts.detail ? sanitizeSsoLogText(opts.detail, 500) : null;
    // issue/logout만 이메일 저장(소문자). 거부·미로그인은 NULL(§4.5).
    const email = opts.email ? opts.email.toLowerCase() : null;
    await sql`
      INSERT INTO sso_events (app, event, email, ip, user_agent, detail)
      VALUES (${app}, ${opts.event}, ${email}, ${ip}, ${ua}, ${detail})`;

    // 90일 보존 자가방어(§4.5): overview(관리자 탭 방문) 시점의 lazy 정리만으로는
    // "아무도 탭을 안 여는 기간"에 무한 누적된다. SSO 미활성 기간에도 deny_* 이벤트는
    // 쌓이므로(검증 분기는 키 env와 무관하게 동작) 그 구간이 특히 위험하다.
    // 삽입 500회당 1회 확률로 만료분을 정리 — 신규 테이블·cron·의존성 0.
    // v1.5의 cron(sso-daily)이 도입되면 그쪽이 주 경로가 되고 이건 폴백으로 남는다.
    if (Math.random() < 0.002) {
      await sql`DELETE FROM sso_events WHERE created_at < now() - interval '90 days'`;
    }
  } catch {
    // 로깅 실패가 응답을 막지 않도록(기존 logAuth와 동일 — 가용성 우선)
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
