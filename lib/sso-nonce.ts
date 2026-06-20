// SSO nonce 1회성 스토어 (Neon `sso_nonces`).
// PRD §4.3 / Q7: Upstash 미사용, Neon 테이블만 사용.
//
// 테이블 생성(M00x)은 migration-guard가 병행. 여기서는 쿼리만 수행하며,
// 테이블 미존재/오류 시에도 authorize 흐름을 막지 않도록 방어적으로 처리한다.
import { sql } from './db';

/** 발급 시 nonce 유효시간(초). PRD §4.3: 발급+90초 여유. */
export const NONCE_TTL_SECONDS = 90;

/**
 * nonce 1회성 기록(발급 시점). expires_at = now + 90s.
 * 동일 nonce 충돌 시 무시(ON CONFLICT DO NOTHING).
 */
export async function storeNonce(nonce: string, app: string): Promise<void> {
  await sql`
    INSERT INTO sso_nonces (nonce, app, expires_at)
    VALUES (${nonce}, ${app}, now() + (${NONCE_TTL_SECONDS} * interval '1 second'))
    ON CONFLICT (nonce) DO NOTHING`;
}

/**
 * nonce 1회성 소비. 아직 소비되지 않았고 만료되지 않은 경우에만 true.
 * 만료분은 조회에서 무시된다(expires_at > now()).
 * (허브 측 1차 방어 — 스포크도 자기 쪽에서 nonce를 1회 소비함, §6.1)
 */
export async function consumeNonce(nonce: string): Promise<boolean> {
  const rows = await sql`
    UPDATE sso_nonces
       SET consumed = true
     WHERE nonce = ${nonce}
       AND consumed = false
       AND expires_at > now()
    RETURNING 1`;
  return rows.length > 0;
}
