// 데모용 테스트 계정 — 이메일 인증 우회.
//
// 모든 설정은 환경변수로만 동작 (env 없으면 비활성).
// 만료 시각(TEST_ACCOUNT_EXPIRES_AT) 경과 시 자동 비활성 + cron이 user row 삭제.
//
// 환경변수:
//   TEST_ACCOUNT_EMAIL=test@eland.co.kr
//   TEST_ACCOUNT_CODE=000000
//   TEST_ACCOUNT_EXPIRES_AT=2026-06-02T23:59:59Z   (ISO 8601, UTC)

export function getTestAccountEmail(): string | null {
  const e = (process.env.TEST_ACCOUNT_EMAIL || '').trim().toLowerCase();
  return e || null;
}

export function getTestAccountCode(): string | null {
  const c = (process.env.TEST_ACCOUNT_CODE || '').trim();
  return c || null;
}

export function getTestAccountExpiresAt(): Date | null {
  const raw = process.env.TEST_ACCOUNT_EXPIRES_AT;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isTestAccountActive(): boolean {
  const email = getTestAccountEmail();
  const code = getTestAccountCode();
  const exp = getTestAccountExpiresAt();
  if (!email || !code || !exp) return false;
  return new Date() < exp;
}

export function isTestAccountEmail(email: string): boolean {
  const t = getTestAccountEmail();
  if (!t) return false;
  return email.trim().toLowerCase() === t;
}

/** 입력된 코드가 테스트 계정 고정 코드와 일치하는지 */
export function isTestAccountCode(code: string): boolean {
  const t = getTestAccountCode();
  if (!t) return false;
  return code.trim() === t;
}
