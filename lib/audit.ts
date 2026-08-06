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
//   deny_state_missing     : state 파라미터 누락(CSRF 방어) — 필수 파라미터 형식 위반도 겸한다.
//                            nonce 형식 위반은 detail='nonce_invalid'로 구분(app/sso/authorize/route.ts).
//   login_required         : 미로그인(허브 세션 없음) — v1은 원시 행 미기록(§4.1, 로그인 관련 판단 근거는
//                             app/sso/authorize/route.ts 주석 참조), 타입만 예약.
//   rate_limited           : authorize IP 레이트리밋 초과
//   logout                 : /sso/logout 호출
export type SsoEventType =
  | 'issue' | 'deny_unknown_app' | 'deny_redirect_mismatch'
  | 'deny_state_missing' | 'login_required' | 'rate_limited' | 'logout';

const SSO_EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[\w.-]+/g;

// 관리자 화면 스푸핑 방어: 아래 코드포인트는 app 이름·UA 같은 필드에 정당하게 쓰일 일이 없고
// 남겨두면 로그를 화면에 표시할 때 문자 순서를 뒤집거나(bidi 오버라이드/격리) 문자열을 숨기는
// 데(제로폭 문자) 악용될 수 있다. 코드포인트 비교로 판정해 정규식에 리터럴 제어/비가시 문자를
// 직접 넣지 않는다(소스에 눈에 안 보이는 문자가 섞여 들어가는 것 자체를 방지).
function isStrippedCodePoint(cp: number): boolean {
  if (cp <= 0x1f || cp === 0x7f) return true; // C0 제어문자 + DEL
  if (cp >= 0x80 && cp <= 0x9f) return true; // C1 제어문자
  if (cp === 0x61c) return true; // ARABIC LETTER MARK(비가시 bidi)
  if (cp >= 0x200b && cp <= 0x200f) return true; // 제로폭(ZWSP/ZWNJ/ZWJ) + LRM/RLM
  if (cp >= 0x202a && cp <= 0x202e) return true; // bidi 오버라이드(LRE/RLE/PDF/LRO/RLO)
  if (cp >= 0x2060 && cp <= 0x2064) return true; // WORD JOINER + 비가시 연산자
  if (cp >= 0x2066 && cp <= 0x2069) return true; // bidi 격리(LRI/RLI/FSI/PDI)
  if (cp === 0x3164 || cp === 0xffa0) return true; // 한글 필러(비가시 — 이름 위장에 쓰임)
  if (cp === 0xfeff) return true; // BOM/ZWNBSP
  return false;
}

/** 로그 인젝션·PII 방지: 제어문자·bidi·제로폭 제거 + 이메일 패턴 마스킹 + 길이 상한(§4.4/§6-M2). */
function sanitizeSsoLogText(input: string, maxLen: number): string {
  const masked = input.replace(SSO_EMAIL_PATTERN, '[email]');
  let stripped = '';
  for (const ch of masked) {
    const cp = ch.codePointAt(0) ?? 0;
    if (!isStrippedCodePoint(cp)) stripped += ch;
  }
  if (stripped.length <= maxLen) return stripped;
  // 코드포인트 단위로 자른다 — UTF-16 코드유닛 slice는 서러게이트 페어(이모지 등) 중간을 잘라
  // 고립 서러게이트를 만들고, 그 값이 관리자 화면에서 U+FFFD로 렌더된다(한글 인코딩 가드).
  return Array.from(stripped).slice(0, maxLen).join('');
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
