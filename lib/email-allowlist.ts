// 회원가입 이메일 도메인 허용 정책.
//
// 기본 정책: '@eland.co.kr' 도메인만 허용.
// 예외 허용 이메일 목록(쉼표 구분)을 환경변수로 오버라이드 가능 — 운영자 도구.
//
// 환경변수: NEXT_PUBLIC_EMAIL_DOMAIN_EXCEPTIONS
//   예) "tester1@gmail.com,tester2@gmail.com"
//
// `NEXT_PUBLIC_` 접두사로 클라이언트 측 사전 검증과 서버 측 최종 검증이 같은
// 목록을 공유. 서버는 어차피 재검증하므로 보안 모델 위반 아님.

// 하드코딩된 기본 예외는 두지 않는다 (소스에 개인 이메일 노출 방지).
// 한시적 예외가 필요하면 NEXT_PUBLIC_EMAIL_DOMAIN_EXCEPTIONS 환경변수로 관리.
const DEFAULT_EXCEPTIONS: string[] = [];

function readExceptions(): Set<string> {
  const raw = process.env.NEXT_PUBLIC_EMAIL_DOMAIN_EXCEPTIONS || '';
  const fromEnv = raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  return new Set([...DEFAULT_EXCEPTIONS, ...fromEnv]);
}

/** 가입 허용 이메일인가? @eland.co.kr 또는 예외 목록에 포함. */
export function isAllowedSignupEmail(email: string): boolean {
  const e = (email || '').trim().toLowerCase();
  if (!e) return false;
  if (/^[a-z0-9._%+-]+@eland\.co\.kr$/.test(e)) return true;
  return readExceptions().has(e);
}

/** 거부 사유 메시지 (UI에 직접 노출 가능) */
export const DOMAIN_REJECT_MESSAGE = '@eland.co.kr 이메일만 사용할 수 있습니다.';
