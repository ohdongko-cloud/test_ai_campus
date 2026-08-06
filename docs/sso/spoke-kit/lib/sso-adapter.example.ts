// SSO 스포크 킷 v2.0.0 (contract v2) — 어댑터 템플릿 (편집 가능, "불변 킷"이 아님)
// ------------------------------------------------------------------------
// 이 파일은 그대로 쓰지 않는다. `lib/sso-adapter.ts`로 복사한 뒤 TODO를 자기 앱의
// DB·세션 발급 코드에 맞게 고친다. 계약은 이 파일이 아니라 SpokeAdapter 인터페이스
// (lib/sso-spoke.ts, DO NOT EDIT)다 — 시그니처는 바꾸지 않는다.
//
// 필수 2메서드: provisionUser · establishSession (없으면 세션 발급 자체가 불가능하므로
// 아래 기본 구현은 일부러 throw한다 — TODO를 채우지 않고 배포하면 즉시·시끄럽게 실패한다).
// 선택 메서드는 전부 주석 처리돼 있다 — 코어(app/sso/callback/route.ts,
// app/api/sso/stats/route.ts)는 `typeof adapter.xxx === 'function'` 가드로 확인 후에만
// 호출하므로, 주석을 풀지 않아도 필수 2메서드만으로 정상 동작한다.
// ------------------------------------------------------------------------
import type { NextResponse } from 'next/server';
import type { SpokeAdapter, SpokeUser } from '@/lib/sso-spoke';

// TODO: 자기 프로젝트의 DB 클라이언트로 교체한다.
// 예) Neon(@neondatabase/serverless) · @vercel/postgres · postgres.js 등 태그 템플릿 SQL.
// import { sql } from '@/lib/db';

// TODO: 자기 프로젝트의 "기존 자체 로그인"이 쓰는 세션 발급 함수로 교체한다.
// 예) web/fashion → setCuSession · measure-web → setMeasureSession · OPR → setOprSession
// import { setMeasureSession } from '@/lib/session';

export const ssoAdapter: SpokeAdapter = {
  /**
   * [필수] email로 사용자 조회 → 없으면 최소 권한(viewer)으로 자동 생성.
   *
   * ★ 반드시 대소문자 무시(`LOWER(email)`) 조회 — 계약 §3.1 5단계 normative.
   *   기존 자체가입이 email을 원문 저장한 레포에서 정확매칭을 쓰면 같은 사람에게
   *   자체 계정(예: role=editor)과 SSO 계정(role=viewer)이 이중 생성된다
   *   ("SSO로 들어가면 권한이 사라진다" / "비번 재설정이 안 먹힌다"의 실제 원인).
   *
   * 정책상 이 사용자를 받아들이지 않으려면(예: 퇴사자 블랙리스트) null을 반환한다 —
   * 콜백(불변)은 null을 §2.3 실패 UX(`sso_error=provision_refused`)로 처리한다.
   *
   * 권고 DDL(경쟁 조건 차단):
   *   CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (LOWER(email));
   * 선행 확인: `users.password`가 NOT NULL이면 이 INSERT가 실패한다 → nullable 마이그레이션 선행.
   */
  async provisionUser(email: string): Promise<SpokeUser | null> {
    // TODO: 아래는 예시 SQL이다. 실제 컬럼명(users 테이블 스키마)에 맞게 고친다.
    // const rows = await sql`
    //   SELECT id, email, role FROM users WHERE LOWER(email) = LOWER(${email})`;
    // if (rows.length > 0) return rows[0] as SpokeUser;
    //
    // const created = await sql`
    //   INSERT INTO users (email, role) VALUES (${email}, 'viewer')
    //   RETURNING id, email, role`;
    // return created[0] as SpokeUser;
    throw new Error('TODO: provisionUser 구현 필요 — lib/sso-adapter.ts');
  },

  /**
   * [필수] SSO로 신원이 확인된 사용자에게 "자기" 세션 쿠키를 발급한다.
   *
   * ★ 새 세션 로직을 새로 만들지 말고, 기존 자체 로그인(이메일+비번)이 이미 쓰는 세션
   *   발급 함수를 그대로 재사용한다(하이브리드 유지 — 계약 §4 어댑팅 표의 "자기" 행).
   *   기존 로그인 라우트에 인라인으로 박혀 있다면 먼저 함수로 추출한다
   *   (SSO-SPOKE-KIT.md 체크리스트 A-3, 첫 스포크에서 +30분 소요 예상).
   *
   * 앱별 클레임 키는 계약 §4 표를 그대로 따른다(README §5의 어댑팅 표 참조):
   *   web/fashion  → cu_session      { uid, email, role }
   *   measure-web  → measure_session { userId, email, role }
   *   OPR          → opr_sess        { email } (역할 개념 없음)
   */
  async establishSession(
    user: SpokeUser,
    res: NextResponse,
    _req: Request,
  ): Promise<void> {
    // TODO: 예시(measure-web 기준) — 실제 세션 발급 함수와 클레임 키로 교체한다.
    // await setMeasureSession(res, { userId: user.id, email: user.email, role: user.role });
    throw new Error('TODO: establishSession 구현 필요 — lib/sso-adapter.ts');
  },

  // ------------------------------------------------------------------------
  // 아래는 전부 선택(optional) 구현이다. 지워도 필수 2메서드만으로 콜백은 정상 동작한다.
  // 활성화하려면 위 import에 필요한 타입을 추가한다:
  //   import type { SpokeAdapter, SpokeUser, SsoDailyStat, UserinfoProfile } from '@/lib/sso-spoke';
  // ------------------------------------------------------------------------

  /**
   * [선택] nonce 영속 1회 소비(DB 등) — httpOnly 쿠키 바인딩(코어 기본값)에 더하는
   * 심층 방어. 이미 소비됐거나 존재하지 않으면 false를 반환한다.
   */
  // async consumeNonce(nonce: string): Promise<boolean> {
  //   const rows = await sql`
  //     UPDATE sso_nonces_seen SET consumed_at = now()
  //     WHERE nonce = ${nonce} AND consumed_at IS NULL RETURNING nonce`;
  //   return rows.length > 0;
  // },

  /**
   * [선택] SSO 로그인 1건 기록(stats 원천). 실패해도 로그인 자체를 막지 않아야 한다
   * (콜백은 best-effort로 호출한다). getDailyStats도 함께 구현할 계획이면 **자체 로그인
   * 라우트에도 동일한 계측 1줄**을 추가해야 selfLogins가 채워진다 — 그게 Tier2 stats의
   * 존재 이유(허브가 못 보는 값)다.
   */
  // async recordSsoLogin(user: SpokeUser, _req: Request): Promise<void> {
  //   await sql`INSERT INTO sso_logins (email, via) VALUES (${user.email}, 'sso')`;
  // },

  /**
   * [선택, Tier2] 최근 days일 일별 집계(KST 기준) — app/api/sso/stats/route.ts가 호출한다.
   * 미구현이면 그 라우트는 404로 존재 자체를 숨긴다(opt-in). email 등 PII를 절대 포함하지 않는다.
   */
  // async getDailyStats(days: number): Promise<SsoDailyStat[]> {
  //   const rows = await sql`
  //     SELECT to_char(created_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS date,
  //            count(*) FILTER (WHERE via = 'sso')  AS sso_logins,
  //            count(*) FILTER (WHERE via = 'self') AS self_logins,
  //            count(DISTINCT email) AS unique_users
  //       FROM sso_logins
  //      WHERE created_at >= now() - (${days}::text || ' days')::interval
  //   GROUP BY 1 ORDER BY 1`;
  //   return rows.map((r: Record<string, unknown>) => ({
  //     date: String(r.date),
  //     ssoLogins: Number(r.sso_logins),
  //     selfLogins: Number(r.self_logins),
  //     uniqueUsers: Number(r.unique_users),
  //   })) as SsoDailyStat[];
  // },

  /**
   * [선택] `/sso/userinfo` 프로필 보강 — 정의하면 콜백(불변)이 트랜잭션 내 동기 1회만
   * fetchUserinfoOnce()를 호출해 결과를 이 함수로 넘긴다. 재시도·캐싱은 코어가 이미
   * 금지한다. 기본(아래 userinfoRequired 미설정/false)은 이 호출이 실패해도 id_token
   * 클레임만으로 세션 발급을 계속한다(무재진입, MUST) — 즉 이 함수 자체는 실패해도
   * 안전하게 두는 것을 권장한다(예외를 던지면 provision_refused와 별개로 처리되지 않음
   * — 필수 프로필 정책이 있다면 userinfoRequired를 true로 두고 여기서 검증한다).
   */
  // async mergeUserinfo(profile: UserinfoProfile, user: SpokeUser): Promise<SpokeUser> {
  //   return { ...user, name: profile.name ?? (user as Record<string, unknown>).name };
  // },

  /**
   * [선택] true로 두면 mergeUserinfo 실패를 치명적으로 다뤄 §2.3 실패 UX
   * (`sso_error=userinfo_failed`, 사용자가 직접 클릭해야 재개)로 보낸다. 기본은 false(권장).
   * mergeUserinfo를 정의하지 않았다면 이 값은 읽히지 않는다.
   */
  // userinfoRequired: false,
};
