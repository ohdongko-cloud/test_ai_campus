// SSO 허브(IdP) RS256 키 로드 / JWKS 변환.
// 개인키(SSO_PRIVATE_KEY, PKCS#8 PEM)는 허브 전용 — 절대 노출 금지.
// 공개키(SSO_PUBLIC_KEY, SPKI PEM)만 JWKS로 노출.
//
// PEM은 멀티라인 그대로 또는 `\n`-escaped 단일행 둘 다 지원
// (Vercel env에 한 줄로 붙여넣은 경우 복원).
import { importPKCS8, importSPKI, exportJWK, type CryptoKey } from 'jose';

const ALG = 'RS256';

/** `\n` 이스케이프된 단일행 PEM을 멀티라인으로 복원. 이미 멀티라인이면 무변경. */
function normalizePem(pem: string): string {
  return pem.includes('\\n') ? pem.replace(/\\n/g, '\n') : pem;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} 환경변수가 설정되지 않았습니다.`);
  return v;
}

// 키/JWKS는 비싸지 않지만 import 비용을 줄이기 위해 모듈 캐시.
let privateKeyCache: Promise<CryptoKey> | null = null;
let publicJwksCache: { value: SsoJwks; kid: string } | null = null;

/** id_token 서명용 RS256 개인키. (허브 전용) */
export function getPrivateKey(): Promise<CryptoKey> {
  if (!privateKeyCache) {
    const pem = normalizePem(requireEnv('SSO_PRIVATE_KEY'));
    privateKeyCache = importPKCS8(pem, ALG);
  }
  return privateKeyCache;
}

export interface SsoJwk {
  kty: string;
  n?: string;
  e?: string;
  use: 'sig';
  alg: 'RS256';
  kid: string;
  [k: string]: unknown;
}

export interface SsoJwks {
  keys: SsoJwk[];
}

/**
 * 공개키를 JWK Set으로 변환해 반환.
 * exportJWK는 공개 컴포넌트(n,e)만 내보내므로 개인키 성분은 포함되지 않는다.
 */
export async function getPublicJwks(): Promise<SsoJwks> {
  const kid = requireEnv('SSO_KID');
  if (publicJwksCache && publicJwksCache.kid === kid) {
    return publicJwksCache.value;
  }
  const pem = normalizePem(requireEnv('SSO_PUBLIC_KEY'));
  const pub = await importSPKI(pem, ALG);
  const jwk = await exportJWK(pub);
  // 안전장치: 혹시라도 개인키 성분이 섞이지 않도록 공개 필드만 추린다.
  const { kty, n, e } = jwk as { kty?: string; n?: string; e?: string };
  const value: SsoJwks = {
    keys: [{ kty: kty ?? 'RSA', n, e, use: 'sig', alg: ALG, kid }],
  };
  publicJwksCache = { value, kid };
  return value;
}

export { ALG as SSO_ALG };
