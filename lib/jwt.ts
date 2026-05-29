// JWT 발급/검증 (jose 사용, Edge runtime 호환)
import { SignJWT, jwtVerify } from 'jose';

const ALG = 'HS256';

function getSecret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) {
    // 개발용 폴백 — production에서는 환경변수 필수
    return new TextEncoder().encode('dev-only-secret-CHANGE-ME-CHANGE-ME-32+');
  }
  return new TextEncoder().encode(s);
}

export interface UserSessionPayload {
  uid: string;
  email: string;
  exp?: number;
}

export interface AdminSessionPayload {
  admin: true;
  exp?: number;
}

export interface SignupTokenPayload {
  email: string;
  verified: true;
  exp?: number;
}

/** 사용자 세션 JWT 발급 */
export async function signUserSession(uid: string, email: string, ttlSeconds: number): Promise<string> {
  return await new SignJWT({ uid, email })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds)
    .sign(getSecret());
}

export async function verifyUserSession(token: string): Promise<UserSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: [ALG] });
    if (typeof payload.uid !== 'string' || typeof payload.email !== 'string') return null;
    return { uid: payload.uid, email: payload.email, exp: payload.exp as number };
  } catch { return null; }
}

/** 관리자 세션 JWT 발급 */
export async function signAdminSession(ttlSeconds: number): Promise<string> {
  return await new SignJWT({ admin: true })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds)
    .sign(getSecret());
}

export async function verifyAdminSession(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: [ALG] });
    return payload.admin === true;
  } catch { return false; }
}

/** 이메일 인증 통과 후 가입 완료 단계용 짧은 토큰 */
export async function signSignupToken(email: string, ttlSeconds: number = 900): Promise<string> {
  return await new SignJWT({ email, verified: true })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds)
    .sign(getSecret());
}

export async function verifySignupToken(token: string): Promise<SignupTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: [ALG] });
    if (payload.verified !== true || typeof payload.email !== 'string') return null;
    return { email: payload.email, verified: true, exp: payload.exp as number };
  } catch { return null; }
}
