// SSO 허브(IdP) 공통 헬퍼: id_token 서명, nonce 생성, issuer.
//
// 기존 lib/jwt.ts(HS256 user_session)와 무관하게 공존한다.
// 이 토큰은 "세션"이 아니라 스포크로 신원을 핸드오프하는 단명(60초) id_token.
import { SignJWT } from 'jose';
import { randomBytes } from 'crypto';
import { getPrivateKey, SSO_ALG } from './sso-keys';

/** id_token TTL — PRD §4.2: 60초 단명. */
export const ID_TOKEN_TTL_SECONDS = 60;

/** iss 클레임. env SSO_ISSUER 우선, 없으면 운영 URL 폴백. */
export function getIssuer(): string {
  return process.env.SSO_ISSUER || 'https://retail-ai-campus.vercel.app';
}

/** 1회성 nonce 난수(URL-safe). */
export function randomNonce(): string {
  return randomBytes(24).toString('base64url');
}

export interface IdTokenInput {
  /** 발급자(iss). 미지정 시 getIssuer(). */
  iss?: string;
  /** 사용자 email (lowercase). sub 클레임. */
  sub: string;
  /** 대상 클라이언트(app). aud 클레임. */
  aud: string;
  /** replay 방지 nonce. */
  nonce: string;
}

/**
 * RS256 id_token 발급.
 * 헤더 { alg:'RS256', kid:<SSO_KID>, typ:'JWT' },
 * 클레임 { iss, sub, aud, nonce, email(=sub), iat, exp(iat+60) }.
 * 역할/권한 클레임은 포함하지 않는다(N2 — 인가는 스포크 책임).
 */
export async function signIdToken(input: IdTokenInput): Promise<string> {
  const kid = process.env.SSO_KID;
  if (!kid) throw new Error('SSO_KID 환경변수가 설정되지 않았습니다.');

  const iss = input.iss || getIssuer();
  const sub = input.sub.toLowerCase();
  const now = Math.floor(Date.now() / 1000);
  const key = await getPrivateKey();

  return await new SignJWT({ email: sub, nonce: input.nonce })
    .setProtectedHeader({ alg: SSO_ALG, kid, typ: 'JWT' })
    .setIssuer(iss)
    .setSubject(sub)
    .setAudience(input.aud)
    .setIssuedAt(now)
    .setExpirationTime(now + ID_TOKEN_TTL_SECONDS)
    .sign(key);
}
