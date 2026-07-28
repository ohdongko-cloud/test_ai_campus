# SSO 스포크 킷 v2.0.0 — 연결되는 서비스용 구현 패키지 (설계)

- 작성일: 2026-07-27 · 상태: **설계(제안) — 구현 전**
- 상위 문서: [`docs/sso/SSO-HUB-BLUEPRINT.md`](SSO-HUB-BLUEPRINT.md)(허브 설계도 v2) · [`docs/sso-spoke-integration-contract.md`](../sso-spoke-integration-contract.md)(계약 v1.1 → **v2로 개정 예정**, §7)
- 목적: 계약 v1.1(의사코드 문서)을 **드롭인 킷**으로 승격 — 복사하면 동작하는 실코드 + 앱별로는 어댑터 1파일만 작성. 허브 설계도 §4의 Tier 2(일별 통계 제공)도 킷에 내장.
- 원칙: **계약 = 프로토콜 스펙(normative)**, **킷 = 참조 구현(informative·교체 가능)**. 충돌 시 계약이 이긴다. 킷 없이 계약만 보고 자체 구현하는 것도 유효한 경로(비 Next.js 스포크 대비).

---

## 1. 배포 형태: copy-paste 킷 (vendored)

| 기준 | (a) copy-paste 킷 ★채택 | (b) private npm (`@eland/sso-spoke`) | (c) git subtree |
|---|---|---|---|
| 비용 | 0 | npmjs private = 유료(npm Pro $7/월). GitHub Packages는 무료 한도 내 가능하나 **설치·빌드에 PAT 인증 필수** | 0 |
| 설치 | 파일 5개 복사 + `npm i jose` | 스포크 Vercel마다 `.npmrc`+`NPM_TOKEN` 등록·로테이션 — **토큰 만료 = 배포 불능**(1인 운영 최악의 부채) | 명령 난이도·히스토리 오염 |
| 업데이트 전파 | 수동 재복사(스포크당 ~5분) | `npm update` | subtree pull 충돌 빈발 |
| 드리프트 관측 | **`kit=` 텔레메트리로 허브가 자동 관측**(§5.2) | 레지스트리 버전 | 커밋 해시(불편) |

**채택 근거**: 킷은 ~5파일·저빈도 변경·스포크 3~5개 규모라 복사 비용이 레지스트리 유지 비용보다 항상 작고, copy-paste의 유일한 약점(드리프트)은 텔레메트리로 자동 관측된다. 스포크 10개+ 또는 월 1회+ 변경으로 성장하면 GH Packages 승격(코드 경계가 이미 패키지형이라 이관 비용 낮음).

**원본 위치**: 허브 레포 `docs/sso/spoke-kit/`에 **실제 .ts 파일**로 배치(마크다운 코드블록 아님 — 복사=설치, diff 가능). **동반 필수 작업**: 허브 `tsconfig.json` `exclude`에 `"docs/sso/spoke-kit"` + eslint ignore 등록 — 킷의 `@/lib/sso-adapter` import는 허브에 존재하지 않아 방치하면 허브 `npx tsc --noEmit` 게이트가 깨진다.

---

## 2. 킷 파일 구성

### 2.0 파일 맵 (스포크 레포 기준)

```
lib/sso-spoke.ts              ← 킷 코어 (불변 — DO NOT EDIT)
lib/sso-adapter.ts            ← ★앱별 작성 (example 복사 후 수정)
app/sso/login/route.ts        ← 킷 (불변)
app/sso/callback/route.ts     ← 킷 (불변)
app/api/sso/stats/route.ts    ← 킷 (불변, Tier 2 참여 시)
middleware 스니펫·로그아웃 헬퍼 ← README 패턴 (§2.7)
```

- 의존성: **`jose` 1개만 추가**. 모든 라우트 `runtime='nodejs'`(허브 F8과 동일 근거).
- import는 전부 **`@/lib/sso-spoke` 별칭**(검증 반영 — `src/` 레이아웃·경로 별칭 레포에서 상대경로 하드코딩이 "복사=설치"를 깨뜨림). README 설치 항목에 "tsconfig `paths`에 `@/*` 필요(없으면 추가)" 명시. 별칭 불가 레포는 import 줄만 수정 허용(DO NOT EDIT의 유일한 예외로 헤더에 명문화).
- 불변 파일 공통 헤더(드리프트 grep 지점):

```ts
// === ELAND SSO SPOKE KIT v2.0.0 (contract v2) — DO NOT EDIT ===
// 원본: retail_ai_campus repo docs/sso/spoke-kit/ — 수정은 허브 레포에서만. 스포크는 복사만.
// 유일한 수정 허용: import 경로 별칭(@/*)이 없는 레포의 import 줄.
// 앱별 커스터마이징은 lib/sso-adapter.ts 에서만.
```

### 2.1 `lib/sso-spoke.ts` — 킷 코어 (요지)

```ts
import { jwtVerify, createRemoteJWKSet, type JWTPayload } from 'jose';
import { randomBytes, timingSafeEqual, createHash } from 'crypto';
import type { NextResponse } from 'next/server';

export const SSO_KIT_VERSION = '2.0.0';
export const SSO_CONTRACT_VERSION = '2';

// ---- config: env 주입 (SSO_APP_ID·SSO_SELF_URL 필수 — 미설정 시 throw)
export interface SsoSpokeConfig {
  hubUrl: string;               // 기본 https://retail-ai-campus.vercel.app
  issuer: string;               // 기본 = hubUrl. 허브 SSO_ISSUER와 바이트 일치
  appId: string;                // = 토큰 aud
  selfUrl: string;              // redirect_uri = `${selfUrl}/sso/callback` (Host 헤더 유도 금지)
  allowedEmailDomains: string[];// 기본 ['eland.co.kr']
  errorPath: string;            // 실패 시 복귀 경로. 기본 '/login' (SSO_ERROR_PATH로 변경 가능)
}
export function getSsoConfig(): SsoSpokeConfig { /* env 파싱 — 생략 */ }

// ---- JWKS: 모듈 레벨 1회 생성. cacheMaxAge 600s(허브 max-age=600 정렬), cooldown 30s
export async function verifyHubToken(token: string): Promise<HubIdentity> {
  const cfg = getSsoConfig();
  const { payload } = await jwtVerify(token, getJwks(cfg.hubUrl), {
    issuer: cfg.issuer,
    audience: cfg.appId,
    algorithms: ['RS256'],      // alg confusion 방지 — 필수 명시
    clockTolerance: 5,
  });
  // sub·nonce 타입 검사 + email 도메인 재검증(allowedEmailDomains) → 실패 시 throw
  return { email: String(payload.sub).toLowerCase(), nonce: String(payload.nonce), payload };
}

// ---- Tier2 stats 요청 검증 (계약 v2 §9 — 허브 RS256 요청 토큰, 신규 시크릿 0)
export async function verifyStatsRequest(bearer: string): Promise<void> {
  const cfg = getSsoConfig();
  const { payload } = await jwtVerify(bearer, getJwks(cfg.hubUrl), {
    issuer: cfg.issuer, audience: cfg.appId, algorithms: ['RS256'],
  });
  // ★ 필수: 같은 키·같은 aud로 서명되는 SSO id_token 탈취분의 오용 차단
  if (payload.scope !== 'stats:read' || payload.sub !== 'sso-hub') {
    throw new Error('not a stats token');
  }
}

// ---- 임시 쿠키: sameSite는 반드시 'lax' — 콜백은 허브(타 사이트)발 top-level GET
//      리다이렉트로 진입하므로 'strict'면 쿠키 미동봉 → state 검증 항상 실패.
export const SSO_TEMP_COOKIE_MAX_AGE = 1200; // 20분 — 신규 입사자의 허브 가입+OTP 왕복 감안(검증 반영)

// ---- returnTo 새니타이즈: URL 파서 기반 (검증 반영 — prefix 문자열 검사는
//      WHATWG 파서의 탭/CR/LF 위치 무관 제거로 우회됨: '/\t/evil.com' → '//evil.com')
export function sanitizeReturnTo(raw: string | null | undefined): string {
  if (!raw) return '/';
  let v: string;
  try { v = decodeURIComponent(raw); } catch { return '/'; }
  if (!v.startsWith('/')) return '/';
  try {
    const t = new URL(v, 'http://sentinel.invalid');
    if (t.origin !== 'http://sentinel.invalid') return '/'; // 오리진 이탈 = 오픈리다이렉트 시도
    return t.pathname + t.search + t.hash;
  } catch { return '/'; }
}
// ※ 같은 취약 패턴이 허브 app/login/page.tsx sanitizeNext에도 존재 —
//   허브 설계도 §6-B3에 따라 허브·킷 동시 패치 + '/\t/evil.com' 류 회귀 테스트가 선행 조건.

// ---- 어댑터 계약: 앱별 가변부의 유일한 경계
export interface SpokeAdapter {
  /** [필수] email lookup(★대소문자 무시) → 없으면 최소권한 자동 생성. 정책 거부 시 null. */
  provisionUser(email: string): Promise<SpokeUser | null>;
  /** [필수] 기존 자체 로그인과 동일한 세션 발급 함수 재사용(httpOnly 쿠키). */
  establishSession(user: SpokeUser, res: NextResponse, req: Request): Promise<void>;
  /** [선택] nonce 영속 1회 소비(DB 등) — 쿠키 바인딩(기본)에 더하는 심층 방어. */
  consumeNonce?(nonce: string): Promise<boolean>;
  /** [선택] SSO 로그인 1건 기록(stats 원천). 실패해도 로그인을 막지 않음. */
  recordSsoLogin?(user: SpokeUser, req: Request): Promise<void>;
  /** [선택] 최근 days일 일별 집계(KST 기준 — 계약 v2 §9). */
  getDailyStats?(days: number): Promise<SsoDailyStat[]>;
}
export interface SsoDailyStat {
  date: string;         // 'YYYY-MM-DD' KST(Asia/Seoul) — 허브 집계와 동일 기준
  ssoLogins: number;
  selfLogins?: number;  // ★자체 로그인 수 — Tier2의 존재 이유(허브가 못 보는 값)
  uniqueUsers: number;
  activeUsers?: number; // 스포크 정의 DAU — "어제 몇 명 썼나"의 실제 답
  pageviews?: number;
}
```

### 2.2 `app/sso/login/route.ts` — SSO 시작점

```ts
// GET /sso/login?returnTo=/path — state·nonce 생성, httpOnly 쿠키 저장 후 허브 authorize로 302.
// 로그인 버튼: <a href="/sso/login?returnTo=현재경로">AI캠퍼스로 로그인</a>
export async function GET(req: NextRequest) {
  const cfg = getSsoConfig();
  const returnTo = sanitizeReturnTo(new URL(req.url).searchParams.get('returnTo'));
  const state = randomToken();   // CSRF
  const nonce = randomToken();   // 허브가 id_token nonce 클레임에 그대로 반영(허브 코드 확인됨)

  const authorize = new URL('/sso/authorize', cfg.hubUrl);
  authorize.searchParams.set('app', cfg.appId);
  authorize.searchParams.set('redirect_uri', `${cfg.selfUrl}/sso/callback`);
  authorize.searchParams.set('state', state);
  authorize.searchParams.set('nonce', nonce);
  authorize.searchParams.set('kit', SSO_KIT_VERSION); // ★텔레메트리 — 허브가 sso_events.detail에 기록.
                                                      //   stats 미참여 스포크 포함 전체의 킷 버전을
                                                      //   로그인 트래픽만으로 자동 관측(검증 반영)
  if (url.searchParams.get('prompt') === 'none') authorize.searchParams.set('prompt', 'none');

  const res = NextResponse.redirect(authorize.toString(), 302);
  // state/nonce/returnTo를 httpOnly·lax·20분 쿠키로 저장
  return res;
}
```

### 2.3 `app/sso/callback/route.ts` — 콜백 (계약 §3 실코드화)

처리 순서(계약 §3.1의 7단계 그대로): ⓪ 허브 에러 패스스루(`error=login_required` 등 → returnTo로 조용히 복귀) → ① state CSRF(httpOnly 쿠키 vs 쿼리, timing-safe) → ② RS256/iss/aud/exp 검증 + 도메인 재검증(`verifyHubToken`) → ③ nonce 1회성 → ④ provision → ⑤ 세션 발급(어댑터) → ⑥ returnTo 302 + 임시 쿠키 소거.

**실패 UX(검증 반영)** — 콜백 실패 경로는 공격자만 오는 곳이 아니다(임시 쿠키 만료·이중 탭·뒤로가기 재진입이 정상 사용자를 보낸다). 1,800명 비개발 직원이 raw JSON을 보고 멈추지 않도록:

```ts
// 사용자 도달 가능 실패(state_mismatch·nonce_mismatch·token_invalid·provision_refused·userinfo_failed):
//   302 → `${errorPath}?sso_error=<code>` (기본 /login) — 스포크 로그인 페이지는
//   sso_error 존재 시 "AI캠퍼스로 다시 로그인" 버튼 + 실패 안내를 보여준다(README 규약).
// 서버 오류(server_error)만 500 JSON 유지. 어느 쪽이든 토큰 원문·email 미포함(§6-7·§6-8).
```

**nonce 1회성 기본 = httpOnly 쿠키 바인딩**: 토큰의 nonce ↔ 시작 브라우저의 `sso_nonce` 쿠키 일치 검사 + 성공 시 쿠키 삭제. (1) URL/로그로 유출된 토큰의 제3자 재사용 차단(쿠키 없음), (2) 동일 브라우저의 콜백 URL 재실행 차단(쿠키 소거됨). DB 없는 스포크(OPR류)도 드롭인 가능. 영속 스토어 소비는 `adapter.consumeNonce` 선택 심층 방어. 계약 v2 §3.1에 이 기본값을 명문화.

**`/sso/userinfo` 확장 시 단일 사용 + 실패 시 무재진입(MUST)**: 어댑터가 email 외 추가 프로필(`corporation_name`·`organization_name`·`position` 등)이 필요해 `/sso/userinfo` 호출을 콜백에 추가하는 경우, **콜백 트랜잭션 안에서 동기적으로 정확히 1회만** 호출한다(계약 §2.1 normative). 허브 nonce는 그 호출 시점에 원자적으로 1회 소비되므로 재시도(백오프·병렬 중복 호출·이후 재호출)는 2회차부터 반드시 실패하며, 실패 코드(200/401/404/429/500 — 계약 §2.1.1 응답 코드표)는 발생 조건이 서로 다르지만 문자열만으로는 원인을 구분할 수 없다. 네트워크 타임아웃·커넥션 리셋처럼 응답 자체를 받지 못한 경우도 동일하게 실패로 처리하고, 이 호출에 쓰는 HTTP 클라이언트의 자동 재시도 옵션(undici `RetryAgent`·`axios-retry` 등)은 반드시 비활성화한다(MUST). **실패 시 `/sso/login`이나 `/sso/authorize`로 자동 재진입시키지 않는다(MUST NOT)** — 허브 세션이 살아 있으면 상호작용 없이 즉시 새 토큰이 발급되어 콜백→userinfo 실패→재진입의 무한 루프가 되며, 이는 §2.7이 막으려는 자동 리다이렉트 루프와 근본원인이 동일하다. 기본 처리는 이미 검증된 id_token 클레임(email)만으로 콜백을 계속 진행해 세션을 발급하고, 프로필 필드는 비워두거나 다음 로그인에서 보강하는 것이다(계약 §2.1). 프로필 필드가 세션 발급의 필수 전제조건인 어댑터만 예외로, §2.3의 실패 UX(`302 → ${errorPath}?sso_error=userinfo_failed`, 사용자가 직접 클릭해야 재개)로 처리한다 — 이 경우도 `/sso/login`·`/sso/authorize`로의 자동 재진입은 아니다. 응답 값은 그 트랜잭션 안에서 즉시 소비하고 저장·로깅하지 않는다(`Cache-Control: no-store`).

### 2.4 `lib/sso-adapter.ts` — 앱별 작성 (example 동봉)

```ts
export const ssoAdapter: SpokeAdapter = {
  async provisionUser(email) {
    // ★ 대소문자 무시 조회(검증 반영) — 기존 자체가입이 email을 원문 저장한 레포에서
    //   정확매칭을 쓰면 같은 사람에게 자체 계정(role=editor)과 SSO 계정(role=viewer)이
    //   이중 생성된다("SSO로 들어가면 권한이 사라진다" / "비번 재설정이 안 먹힌다"의 원인).
    const rows = await sql`SELECT id, email, role FROM users WHERE LOWER(email) = ${email}`;
    if (rows.length > 0) return rows[0] as SpokeUser;
    const created = await sql`
      INSERT INTO users (email, role) VALUES (${email}, 'viewer') RETURNING id, email, role`;
    return created[0] as SpokeUser;
  },
  async establishSession(user, res) {
    // 기존 자체 로그인과 "동일한" 세션 발급 함수를 그대로 재사용(계약 §4 어댑팅 표의 자기 행).
    // 예: await setMeasureSession(res, { userId: user.id, email: user.email, role: user.role });
  },
  // [선택] stats 원천 — 자체 로그인 라우트에도 같은 계측 1줄을 넣어야 selfLogins가 채워진다.
  // async recordSsoLogin(user) { await sql`INSERT INTO sso_logins (email, via) VALUES (${user.email}, 'sso')`; },
  // async getDailyStats(days) { /* KST 기준 GROUP BY — 계약 v2 §9 스키마 반환 */ },
};
```

권고 DDL(어댑터 구현 시 동봉): `CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (LOWER(email));` — 이중 생성 경쟁 조건 차단. **선행 확인**: 스포크 `users.password`가 NOT NULL이면 SSO provision INSERT가 실패한다 → nullable 마이그레이션 선행(체크리스트 C).

### 2.5 `app/api/sso/stats/route.ts` — 일별 집계 제공 (Tier 2, 계약 v2 §9)

```ts
// GET /api/sso/stats?days=7 — 허브 cron이 일 1회 호출.
// 인증: 허브 RS256 요청 토큰(verifyStatsRequest — scope='stats:read' && sub='sso-hub').
//   정적 시크릿 없음(SSO_STATS_SECRET 폐기 — 허브 설계도 §6-B2 확정).
// opt-in: adapter.getDailyStats 미구현이면 404(존재 자체를 숨김).
// 응답: PII 없음 — { app, kitVersion, contractVersion, statsImplemented, days,
//        stats: [{date, ssoLogins, selfLogins?, uniqueUsers, activeUsers?, pageviews?}] }
//        Cache-Control: no-store. days는 1~31로 클램프.
```

### 2.6 .env 추가 항목

| 변수 | 필수 | 기본값 | 설명 |
|---|---|---|---|
| `SSO_APP_ID` | **필수** | — | 자기 app 식별자 = 토큰 `aud`(계약 §4 표) |
| `SSO_SELF_URL` | **필수** | — | canonical https 오리진(경로 없이). `sso_clients` 등록값과 정확매칭. Host 헤더 유도 금지 |
| `SSO_HUB_URL` | 선택 | `https://retail-ai-campus.vercel.app` | 허브 오리진 |
| `SSO_HUB_ISSUER` | 선택 | `= SSO_HUB_URL` | iss 기대값 |
| `SSO_ALLOWED_EMAIL_DOMAINS` | 선택 | `eland.co.kr` | provision 허용 도메인(콤마 구분) |
| `SSO_ERROR_PATH` | 선택 | `/login` | 콜백 실패 시 복귀 경로(§2.3 실패 UX) |

시크릿성 env **0개**(stats 인증까지 JWKS 재사용). Vercel env 등록 후 **재배포 필수**.

### 2.7 로그아웃·자동 리다이렉트 (README 패턴 — 검증 반영: 로그아웃 루프 방지)

미들웨어 자동 리다이렉트("세션 없으면 `/sso/login`")를 켜면 **스포크 로그아웃이 불가능해진다**: 로그아웃 → 세션 없음 → 자동 SSO → 허브 세션(최대 30일) 생존 → silent 재로그인 루프. 킷은 두 장치를 제공한다:

1. **억제 쿠키**: 스포크 로그아웃 시 `sso_auto=off`(httpOnly, 1시간) 쿠키를 심는 헬퍼 — 미들웨어는 이 쿠키가 있으면 자동 리다이렉트를 건너뛰고 로그인 페이지를 보여준다.
2. **완전 로그아웃 링크**: 허브 `/sso/logout?post_logout_redirect_uri=<등록값>` 경유 패턴("모든 사내 앱에서 로그아웃"). 허브 세션까지 종료.

자동 리다이렉트 도입 앱의 완료 판정에 "로그아웃 동작 확인"을 포함(허브 설계도 §7 단계 5). 또한 자동 리다이렉트를 쓰더라도 **"자체 로그인으로 진행" 우회 링크는 강등 불가 필수**(허브 다운 폴백).

> ⚠️ **선행조건(허브 설계도 §7 단계 5 각주1)**: 자동 리다이렉트를 켜기 전에 허브의 `login_required` **표본/카운터 전환이 먼저 반영**돼야 한다. 현재 허브는 미로그인 유입을 원시 행으로 기록하지 않아(타입만 예약), 자동 리다이렉트를 켜면 늘어난 유입 물량이 정상 범위인지 판정할 수치가 없다. 이 킷만 읽고 미들웨어를 켜지 말 것 — 허브 오너와 선행조건 충족 여부를 먼저 확인한다.

---

## 3. 스포크 작업자 체크리스트

> **소요 현실화(검증 반영)**: 순작업 ~15분은 최선치다. **첫 스포크는 캘린더 시간 1~2시간**(세션 발급 함수 추출 리팩터링·재배포·등록 대기 포함), 2번째부터 ~30분.

**A. 사전 확인 (첫 스포크에서 가장 오래 걸리는 부분)**
- [ ] App Router인가? (Pages Router면 라우트 2개 수동 이식 — 코어 lib는 재사용 가능)
- [ ] tsconfig에 `@/*` 경로 별칭 존재? (없으면 추가 또는 import 줄 수정)
- [ ] **기존 자체 로그인의 세션 발급이 재사용 가능한 함수로 분리돼 있는가?** 로그인 라우트에 인라인이면 추출 리팩터링 선행(+30분).
- [ ] 기존 `users.email` 대소문자 정규화 상태 + `password` 컬럼 nullable 여부(§2.4).

**B. 설치·설정 (~7분)**
- [ ] 킷 4파일 복사(+선택 stats) + `sso-adapter.example.ts` → `lib/sso-adapter.ts` + `npm i jose`
- [ ] `.env.local` + Vercel env에 `SSO_APP_ID`·`SSO_SELF_URL` → **재배포**(env는 재배포에만 반영)
- [ ] 자기 레포 `.env.example`류에 자리표시자 동기화

**C. 어댑터 작성 (~5분 + A-3 리팩터링)**
- [ ] `provisionUser`: `LOWER(email)` 조회 → 없으면 최소권한(viewer) 생성. 거부 시 null
- [ ] `establishSession`: 기존 세션 발급 함수 재사용(계약 §4 표의 자기 행)
- [ ] (Tier2) `recordSsoLogin`/`getDailyStats` + 자체 로그인 경로에도 계측 1줄
- [ ] (확장 시) `/sso/userinfo` 호출을 추가했다면 콜백 트랜잭션 내 동기 1회만 — 재시도·캐싱 금지, 네트워크 예외 포함 실패 시 `/sso/login`·`/sso/authorize` 자동 재진입 금지(MUST NOT) 후 id_token 클레임만으로 세션 발급(계약 §2.1) — 프로필 필수 어댑터만 예외로 §2.3 실패 UX(사용자 클릭 필요)
- [ ] `npx tsc --noEmit` + `npm run build` 통과

**D. 허브 등록 (오너 처리 대기 + 캐시 60초)**
- [ ] 오너에게 `app 식별자` + `${SSO_SELF_URL}/sso/callback` 전달 → 오너가 2단계 등록(enabled=false → 확인 → true, 허브 설계도 §5.2) 후 회신. 레지스트리 캐시로 **최대 60초 후 반영**

**E. 검증**
- [ ] 미로그인 → `/sso/login?returnTo=/원래경로` → 허브 로그인 → 자동 복귀 + 자기 세션 쿠키
- [ ] 허브 기로그인 브라우저 → 재진입 시 로그인 화면 없이 즉시 복귀
- [ ] 성공했던 콜백 URL 재붙여넣기 → `/login?sso_error=…`로 거부(재사용 차단)
- [ ] 기존 자체 로그인 병행 동작(하이브리드)
- [ ] (Tier2) stats: 허브 서명 토큰으로 200, 무토큰 401, `getDailyStats` 미구현 배포에서 404

**책임 분배** — 킷 파일을 무수정 복사하면 계약 검증 11항 중 7항(RS256 명시·iss·aud·state·nonce·도메인 재검증·stats 인증)이 "킷 보장"으로 자동 충족. 어댑터 책임은 provision 최소권한·세션 httpOnly 2항, 스포크 책임은 하이브리드 유지, 허브 오너 책임은 등록.

---

## 4. 버전·드리프트 관리

### 4.1 2트랙 버전

| 트랙 | 식별자 | 올리는 조건 |
|---|---|---|
| **계약(프로토콜)** | 문서 `v2` (v1.1→v2: stats 엔드포인트 §9·nonce 쿠키바인딩 기본값·실패 UX 규약 추가) | 와이어 포맷 변경 시만(authorize 파라미터·클레임·콜백 쿼리·stats 스키마). MAJOR만 |
| **킷(참조 구현)** | `SSO_KIT_VERSION`(semver, MAJOR는 계약과 정렬) | MAJOR: SpokeAdapter breaking / MINOR: 선택 기능 추가(기존 어댑터 무수정 동작) / PATCH: 버그·보안 수정 |

규칙: 필수 어댑터 메서드 시그니처는 MAJOR 없이 변경 금지. 계약 MAJOR 전환 시 허브는 신·구 동작을 겹침 지원하고, 전 스포크 `kit=` 텔레메트리가 신버전 확인된 뒤에만 구 동작 제거.

### 4.2 전파 절차 (1인 운영)

1. 허브 레포 `docs/sso/spoke-kit/`에서만 수정 → 버전 범프 → `CHANGELOG.md`(형식: `## 2.1.0 — 날짜 / 변경 / 스포크 조치: 없음|재복사|어댑터 수정`).
2. 스포크 오너 통지(보안 PATCH는 기한 명시, 예: 7일 내 재복사).
3. 각 스포크: 불변 파일 덮어쓰기 → tsc → 배포 → 체크리스트 E만 재실행.
4. **드리프트 자동 관측 2중**: ① `kit=` authorize 텔레메트리(전 스포크, v1부터 — 주간 메일에 구버전 경고 행) ② stats 응답의 kitVersion(Tier2 참여 스포크). 보조: `scripts/sync-spoke-kit.mjs <스포크경로>`(파일 복사+diff 출력)로 전파를 1명령화.

---

## 5. 계약 v2 개정 목록 (`docs/sso-spoke-integration-contract.md` — 경로 유지·내용 개정)

| 절 | 개정 내용 |
|---|---|
| §3.1 3단계 | nonce 1회성의 기본 메커니즘 = httpOnly 쿠키 바인딩 명문화(영속 소비는 선택 심층 방어) |
| §3.1 5단계 | provision lookup은 **case-insensitive**(`LOWER(email)`)를 normative로 |
| §5 | 자동 리다이렉트 도입 시 ① 자체 로그인 우회 링크 필수(강등 불가) ② 로그아웃 억제 쿠키·완전 로그아웃 링크 규약(§2.7) |
| **§9 신설** | **일별 통계 엔드포인트**: `GET /api/sso/stats?days=`(1~31) · 인증 = 허브 RS256 요청 토큰(`scope='stats:read'`·`sub='sso-hub'` 필수 검증) · 응답 스키마(camelCase, date=KST) — **이 표가 유일한 스펙**(허브 설계도 §4.2와 동일) |
| §10 신설 | 참조 구현(spoke-kit) 안내 + "충돌 시 본 계약 우선" |
| §7 | 검증 체크리스트를 §3의 킷 기준 책임 분배표로 교체 |
| 부록 | 콜백 실패 `sso_error` 코드표·모바일 안내 문구("모바일은 Chrome에서 AI캠퍼스 로그인 1회 필요") |

계약 v2 개정 + 킷 신설 + 허브 tsconfig exclude는 **한 커밋으로 원자화**(`docs(sso): 스포크 킷 v2.0.0 + 계약 v2 개정`) + `docs/prd/CHANGELOG.md` 행 추가.

---

## 6. 잔여 리스크·미해결

- **허브 선행 조건**: 킷 출고 전에 허브 설계도 §6-B3(sanitizeNext URL 파서 패치 — 킷 sanitizeReturnTo와 동일 로직)·B1(Sentry 토큰 마스킹)이 먼저 반영돼야 한다. 킷 롤아웃은 그 이후.
- 허브 `normalizeRedirect`는 **베이스 정확매칭**(쿼리 제거 후 비교) — 등록 redirect_uri에 임의 쿼리를 붙여도 통과한다. 킷 콜백은 `token`/`state`/`error` 외 쿼리를 무시하므로 실해는 없으나, **콜백에 새 쿼리 파라미터 의미를 부여하는 확장 금지**(README 명시).
- OPR의 실제 스택 미확인 — Pages Router/비 Next.js면 라우트 수동 이식(체크리스트 A-1).
- 스포크 `sso_logins` 원천 테이블의 email 보존 정책(집계 응답에는 없지만 원천에는 남음) — 보존 N일 후 삭제 또는 해시 저장을 스포크별 결정.
- 킷 파일 무결성(부분 복사·혼재) — `kit=` 텔레메트리로 버전 드리프트는 잡히나 파일 단위 변조는 못 잡음. 필요 시 README에 sha256 목록(보류).
- npm/GitHub Packages 요금은 2026-01 지식 기준 — copy-paste 채택에는 영향 없음, GH Packages 승격 검토 시 재확인.
- `/sso/userinfo`를 확장해 쓰는 스포크가 재시도(SSR+CSR 이중 fetch·백오프 등)로 2회 호출하면 2회차는 nonce 재사용으로 반드시 401 실패한다 — 원인이 만료·재사용·미등록 클라이언트 중 무엇인지는 응답만으로 구분 불가하다. **관측 공백(실측)**: `app/sso/userinfo/route.ts`는 `logSsoEvent`·`reportError`·Sentry를 아예 import하지 않고(파일 상단 import 7줄: `next/server`·`jose`·`lib/db`·`lib/sso`·`lib/sso-clients`·`lib/sso-nonce`·`lib/ratelimit`), 모든 실패 경로가 자체 `catch`에서 `NextResponse`를 반환해(`:27-29`·`:45-47`·`:72-74`·`:84-86`·`:109-111`) 핸들러 밖으로 예외가 나가지 않는다 — 따라서 `sso_events`에 남지 않을 뿐 아니라 `instrumentation.ts`의 `onRequestError`(Sentry `captureRequestError`, `:14-22`)에도 도달하지 않는다. **실제 단서는 Vercel HTTP 액세스 로그의 상태코드(401/404/429/500)뿐**이며, 스포크가 자기 쪽에 남긴 로그가 유일한 보조 단서다(§2.3 단일 사용 + 무재진입 규약으로 예방이 최선. 허브 측 관측이 필요하면 userinfo에 `logSsoEvent` 추가가 별도 후속 과제).
