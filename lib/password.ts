// 비밀번호 해시/검증.
// bcrypt 우선, SHA-256 레거시도 검증만 가능 (마이그레이션 중에 사용).

import bcrypt from 'bcryptjs';

const BCRYPT_COST = 10;
const BCRYPT_PREFIXES = ['$2a$', '$2b$', '$2y$'];

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 비밀번호 일치 여부 검증. bcrypt 해시는 직접 비교, 레거시 SHA-256은 옛 해시도 비교.
 * @returns { matched: boolean, isLegacy: boolean }  isLegacy=true면 호출 측이 bcrypt로 재저장해야 함.
 */
export async function verifyPassword(plain: string, stored: string): Promise<{ matched: boolean; isLegacy: boolean }> {
  if (!stored) return { matched: false, isLegacy: false };
  const isBcrypt = BCRYPT_PREFIXES.some(p => stored.startsWith(p));
  if (isBcrypt) {
    try {
      const ok = await bcrypt.compare(plain, stored);
      return { matched: ok, isLegacy: false };
    } catch { return { matched: false, isLegacy: false }; }
  }
  // 레거시 SHA-256
  const candidate = await sha256(plain);
  return { matched: candidate === stored, isLegacy: true };
}

/**
 * 비번 정책 검증 — 8~16자, 영문/숫자/특수문자 각 1개 이상.
 * (함수명은 호환성을 위해 그대로 유지)
 */
export function isValidSimplePassword(p: string): boolean {
  if (typeof p !== 'string') return false;
  if (p.length < 8 || p.length > 16) return false;
  if (!/[A-Za-z]/.test(p)) return false;
  if (!/\d/.test(p)) return false;
  // 특수문자: 키보드에서 흔히 쓰이는 ASCII 특수문자
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(p)) return false;
  return true;
}

export const PASSWORD_POLICY_MESSAGE =
  '비밀번호는 8~16자로 영문/숫자/특수문자를 각 1개 이상 포함해야 합니다.';
