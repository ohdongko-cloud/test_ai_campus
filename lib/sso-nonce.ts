// SSO nonce 1회성 스토어 (Neon `sso_nonces`).
// PRD §4.3 / Q7: Upstash 미사용, Neon 테이블만 사용.
//
// 테이블 생성(M00x)은 migration-guard가 병행. 여기서는 쿼리만 수행하며,
// 테이블 미존재/오류 시에도 authorize 흐름을 막지 않도록 방어적으로 처리한다.
import { after } from 'next/server';
import { sql } from './db';

/** 발급 시 nonce 유효시간(초). PRD §4.3: 발급+90초 여유. */
export const NONCE_TTL_SECONDS = 90;

/**
 * 만료 행 정리(블루프린트 G5 해소). `sso_nonces`에는 삭제 경로가 전혀 없어
 * 발급분이 영구 누적된다(M011의 `sso_nonces_expires_at_idx`도 사용처가 없었다).
 * 삽입 500회당 1회 확률로 만료분만 정리 — 신규 테이블·cron·env 0개
 * (lib/audit.ts `logSsoEvent`의 90일 보존 폴백과 동일 패턴·확률).
 * v1.5의 cron(sso-daily §4.3③)이 도입되면 그쪽이 주 경로가 되고 이건 폴백으로 남는다.
 *
 * 지연을 늘리지 않는 이유: storeNonce는 authorize의 `await storeNonce(nonce, app)`에서
 * 토큰 서명 직전에 동기 대기되므로, 여기서 DELETE까지 기다리면 그 요청의 302가 그만큼
 * 늦어진다. issue 이벤트 로깅이 after()로 응답 뒤로 미뤄지는 것과 같은 이유로 정리도
 * after()로 응답 이후에 실행한다(발급 경로 지연 증가 0).
 */
function scheduleExpiredNonceCleanup(): void {
  if (Math.random() >= 0.002) return;
  try {
    after(async () => {
      try {
        // WHERE 필수 — 이미 만료된 행만. TTL 90초이므로 만료분은 consumeNonce가
        // 어차피 거르는(expires_at > now()) 재사용 불가 쓰레기다.
        await sql`DELETE FROM sso_nonces WHERE expires_at < now()`;
      } catch {
        // 정리 실패는 삼킨다 — 다음 발급이 다시 시도하고, 실패해도 인증에는 영향이 없다
        // (상단의 "authorize 흐름을 막지 않도록 방어적으로 처리한다" 원칙).
      }
    });
  } catch {
    // after()는 요청 스코프 밖(스크립트·테스트)에서 호출되면 throw한다.
    // 정리는 best-effort이므로 그 경우 조용히 건너뛴다(호출부로 예외를 올리지 않음).
  }
}

/**
 * nonce 1회성 기록(발급 시점). expires_at = now + 90s.
 * 동일 nonce 충돌 시 무시(ON CONFLICT DO NOTHING).
 */
export async function storeNonce(nonce: string, app: string): Promise<void> {
  await sql`
    INSERT INTO sso_nonces (nonce, app, expires_at)
    VALUES (${nonce}, ${app}, now() + (${NONCE_TTL_SECONDS} * interval '1 second'))
    ON CONFLICT (nonce) DO NOTHING`;
  // INSERT 성공 시에만 스케줄(테이블 미존재 등으로 위가 throw하면 정리도 무의미).
  scheduleExpiredNonceCleanup();
}

/**
 * nonce 1회성 소비. 아직 소비되지 않았고 만료되지 않은 경우에만 true.
 * 만료분은 조회에서 무시된다(expires_at > now()).
 * (허브 측 1차 방어 — 스포크도 자기 쪽에서 nonce를 1회 소비함, §6.1)
 *
 * 호출처: app/sso/userinfo/route.ts — id_token 1회성 조회 가드(§6-B1②).
 * (G4 해소: 더 이상 "호출처 없는 예비 코드"가 아니다. authorize는 storeNonce만
 *  호출하고 consumed를 바꾸지 않으므로, 정상 스포크의 첫 userinfo 호출은 항상 통과한다.)
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
