# SSO 스포크 킷 v2.0.0 — 설치 가이드

- 킷 버전 `SSO_KIT_VERSION = '2.0.0'` · 계약 버전 `SSO_CONTRACT_VERSION = '2'`
- 규범(normative) 문서: [`docs/sso-spoke-integration-contract.md`](../../sso-spoke-integration-contract.md) — 이 README와 충돌하면 **계약이 이긴다**.
- 설계 배경: [`docs/sso/SSO-SPOKE-KIT.md`](../SSO-SPOKE-KIT.md)
- 허브: AI캠퍼스 `https://retail-ai-campus.vercel.app` (SSO_HUB_URL 기본값)
- 대상 독자: web/fashion, measure-web, OPR 등 **스포크 레포 작업자**. 이 문서만 보고 설치를 끝낼 수 있게 작성했다.

---

## 0. 흐름 한눈에 보기

```
[스포크 보호 페이지] (세션 없음)
  → GET /sso/login?returnTo=/원래경로
  → 302 https://retail-ai-campus.vercel.app/sso/authorize?app=&redirect_uri=&state=&nonce=&kit=2.0.0
  → (허브 로그인 필요 시 왕복) → 허브가 id_token(RS256, 60초) 발급
  → 302 https://<스포크>/sso/callback?token=&state=
[스포크 GET /sso/callback]
  → state CSRF 대조 → RS256/iss/aud/exp 검증 → nonce 1회성 → provision/lookup
  → 자기 세션 쿠키 발급 → 302 returnTo
```

---

## 1. 파일 구성 (복사 목록)

| 경로 | 편집 | 설명 |
|---|---|---|
| `lib/sso-spoke.ts` | ❌ DO NOT EDIT | 킷 코어. config·RS256 검증·쿠키 헬퍼·타입. |
| `lib/sso-adapter.ts` | ✅ 앱별 작성 | `lib/sso-adapter.example.ts`를 복사해 만든다(4절). |
| `app/sso/login/route.ts` | ❌ DO NOT EDIT | SSO 시작점. state/nonce/returnTo 발급 후 허브로 302. |
| `app/sso/callback/route.ts` | ❌ DO NOT EDIT | 콜백. 계약 §3.1 7단계 그대로 구현. |
| `app/api/sso/stats/route.ts` | ❌ DO NOT EDIT (선택) | Tier2 일별 통계 제공. `getDailyStats` 미구현이면 배포해도 무해(404). |
| `middleware.ts` 스니펫 | 참고용 | 8절 — **실제 파일로 배포하지 않는다**. 기존 미들웨어에 수동 병합. |

DO NOT EDIT 파일 상단에는 공통 헤더가 있다:

```ts
// === ELAND SSO SPOKE KIT v2.0.0 (contract v2) — DO NOT EDIT ===
// 원본: retail_ai_campus repo docs/sso/spoke-kit/ — 수정은 허브 레포에서만. 스포크는 복사만.
// 유일한 수정 허용: import 경로 별칭(@/*)이 없는 레포의 import 줄.
// 앱별 커스터마이징은 lib/sso-adapter.ts 에서만.
```

모든 킷 파일의 import는 `@/lib/sso-spoke` · `@/lib/sso-adapter` 별칭을 쓴다. 별칭이 없는 레포는 **import 줄만** 상대경로로 고친다(위 헤더의 유일한 예외).

---

## 2. 설치 순서

1. **App Router인지 확인**한다(Pages Router면 라우트 2개를 수동 이식 — 코어 `lib/sso-spoke.ts`는 그대로 재사용 가능).
2. **기존 자체 로그인의 세션 발급이 재사용 가능한 함수로 분리돼 있는지** 확인한다. 로그인 라우트에 인라인이면 먼저 추출한다(첫 스포크에서 가장 오래 걸리는 단계, +30분 예상).
3. 위 1절 파일을 복사한다. `lib/sso-adapter.example.ts` → `lib/sso-adapter.ts`로 복사(원본은 지우지 않고 참고용으로 남겨도 무방).
4. `npm i jose`
5. `tsconfig.json`에 경로 별칭이 없으면 추가한다.
   ```json
   { "compilerOptions": { "paths": { "@/*": ["./*"] } } }
   ```
6. env를 설정한다(3절 표) — `.env.local` + Vercel 프로젝트 env 양쪽. **env는 재배포에만 반영**된다.
7. 자기 레포의 `.env.example`류에도 새 변수의 자리표시자를 동기화한다.
8. `lib/sso-adapter.ts`를 작성한다(4절) — 필수 `provisionUser`·`establishSession`.
9. **허브 오너에게 등록 요청**: `app` 식별자 + `${SSO_SELF_URL}/sso/callback`(운영 URL **확정 필수** — 미확정 상태로는 SSO가 전혀 동작하지 않는다). 오너가 `sso_clients`에 등록(2단계: `enabled=false`로 먼저 넣고 확인 후 `true`) 후 회신. 레지스트리 캐시 때문에 **최대 60초 후 반영**된다.
10. `npx tsc --noEmit` + 빌드 통과 확인 후, 10절 검증 체크리스트를 실행한다.

> 소요 현실화: 순작업 자체는 15분 내외지만, **첫 스포크는 세션 발급 함수 추출 리팩터링·재배포·등록 대기까지 합쳐 캘린더 시간 1~2시간**을 잡는다. 2번째 스포크부터는 ~30분.

---

## 3. env 변수

| 변수 | 필수 | 예시 | 설명 |
|---|---|---|---|
| `SSO_APP_ID` | **필수** | `web-fashion` | 자기 app 식별자 = id_token `aud`. 허브 `sso_clients.app`과 바이트 정확 일치해야 `/sso/authorize`가 통과한다. 미설정 시 `getSsoConfig()`가 즉시 throw(fail-fast). |
| `SSO_SELF_URL` | **필수** | `https://<PILOT_ORIGIN>` | canonical https 오리진, **트레일링 슬래시 금지**(콜백 URL을 `${selfUrl}/sso/callback` 문자열 결합으로 만들기 때문 — 슬래시가 남으면 `//sso/callback`이 되어 허브 정확매칭에서 항상 400). Host 헤더로 유도하지 말고 반드시 고정 env. `sso_clients` 등록값과 정규화 후 정확매칭. |
| `SSO_HUB_URL` | 선택 | `https://retail-ai-campus.vercel.app`(기본값) | 허브 오리진. JWKS 조회·authorize 리다이렉트·logout 링크의 베이스로 쓰인다. |
| `SSO_HUB_ISSUER` | 선택 | `= SSO_HUB_URL`(기본값) | `jwtVerify`의 `issuer` 옵션. 허브 `SSO_ISSUER`(Vercel Sensitive env — 코드로 확인 불가)와 바이트 일치해야 한다. **파일럿 시 실제 발급된 id_token을 디코드해 `iss`를 재확인**하는 것을 권장(가정만으로 진행 금지). |
| `SSO_ALLOWED_EMAIL_DOMAINS` | 선택 | `eland.co.kr`(기본값) | 콤마 구분, 소문자 비교. `verifyHubToken` 내부에서 email이 이 도메인 중 하나로 끝나는지 재검증한다. |
| `SSO_ERROR_PATH` | 선택 | `/login`(기본값) | 콜백 실패(§9) 시 302 대상. 이 경로는 쿼리 `sso_error`를 읽어 "다시 로그인" 버튼 + 안내를 보여줘야 한다(스포크 UI 책임, 킷 범위 밖). |

시크릿성 env **0개**(stats 인증까지 JWKS 재사용).

---

## 4. 어댑터(`lib/sso-adapter.ts`) 작성

`lib/sso-adapter.example.ts`를 복사해 시작한다. 인터페이스는 코어가 정의한다:

```ts
export interface SpokeAdapter {
  provisionUser(email: string): Promise<SpokeUser | null>;                 // 필수
  establishSession(user: SpokeUser, res: NextResponse, req: Request): Promise<void>; // 필수
  consumeNonce?(nonce: string): Promise<boolean>;                          // 선택 — nonce 영속 심층방어
  recordSsoLogin?(user: SpokeUser, req: Request): Promise<void>;           // 선택 — stats 원천
  getDailyStats?(days: number): Promise<SsoDailyStat[]>;                   // 선택 — Tier2
  mergeUserinfo?(profile: UserinfoProfile, user: SpokeUser): Promise<SpokeUser>; // 선택 — /sso/userinfo 보강
  userinfoRequired?: boolean;                                              // 선택 — mergeUserinfo 실패를 치명적으로
}
```

- `provisionUser`: **email 대소문자 무시**(`LOWER(email)`) 조회 → 없으면 최소 권한(`role='viewer'`) 자동 생성. 정책 거부 시 `null`(콜백이 `sso_error=provision_refused`로 처리).
- `establishSession`: **새로 만들지 말고 기존 자체 로그인 세션 발급 함수를 재사용**한다(하이브리드 유지). 인라인으로 박혀 있으면 먼저 함수로 추출한다.
- 권고 DDL: `CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (LOWER(email));`(이중 생성 경쟁 조건 차단). **선행 확인**: `users.password`가 `NOT NULL`이면 provision INSERT가 실패한다 → nullable 마이그레이션 선행.

### 4.1 스포크별 어댑팅 표 (계약 §4)

| 스포크 | `app` 식별자 | 콜백 URL | 세션 쿠키명 | 세션 시크릿 env | 세션 클레임 | provision 정책 | 비고 |
|---|---|---|---|---|---|---|---|
| **web/fashion** | `web-fashion` | `https://<PILOT_ORIGIN>/sso/callback` | `cu_session` | `JWT_SECRET` | `{ uid, email, role }` | email lookup; 없으면 자동 생성·기본 역할 `viewer` | `uid`는 자기 DB `users.id`; `role`은 자기 DB에서 조회해 클레임에 포함(허브 토큰엔 역할 없음) |
| **measure-web** | `measure-web` | `https://<measure>.vercel.app/sso/callback` | `measure_session` | `SESSION_SECRET` | `{ userId, email, role }` | 동일 | 클레임 키가 `userId`(허브 `sub`=email, 자기 user id는 자기 DB 값) |
| **OPR** | `opr` | `https://<opr>.vercel.app/sso/callback` | `opr_sess` | `SESSION_SECRET` | `{ email }` only | email만으로 세션 | 역할 개념 없음 — email만 담으면 됨 |

> measure-web·OPR 운영 URL은 배포 후 확정 시 오너가 허브 `sso_clients`에 등록한다. **등록 전까지 SSO는 동작하지 않는다.**

### 4.2 Tier2(선택): `recordSsoLogin` / `getDailyStats`

`getDailyStats`를 구현하면 `app/api/sso/stats/route.ts`가 `days`일치 일별 집계를 반환한다(404 대신 200). **자체 로그인 라우트에도 `recordSsoLogin`과 동일한 계측 1줄을 추가**해야 `selfLogins`가 채워진다 — 그것이 Tier2의 존재 이유(허브가 못 보는 "자체 로그인 수")다. 반환 스키마(`SsoDailyStat`, KST `YYYY-MM-DD`)는 7절 참조.

### 4.3 선택: `/sso/userinfo` 프로필 보강 (`mergeUserinfo` / `userinfoRequired`)

email 외 프로필(`name`·`corporation_name`·`organization_name`·`position`)이 필요하면 `mergeUserinfo`를 정의한다. 정의된 경우에만 콜백(불변)이 **트랜잭션 내 동기 1회** `fetchUserinfoOnce()`를 호출해 결과를 넘긴다 — 재시도·캐싱은 코어가 이미 금지한다. 기본(`userinfoRequired` 미설정/`false`)은 이 호출이 실패해도 **id_token 클레임만으로 세션 발급을 계속**한다(무재진입, MUST). 프로필이 세션 발급의 필수 전제조건인 스포크만 `userinfoRequired: true`로 두고 §9 실패 UX(`sso_error=userinfo_failed`, 사용자 클릭형 재개)로 처리한다.

---

## 5. 임시 쿠키 (킷이 자동 관리 — 참고용, 직접 다룰 필요 없음)

| 이름 | 속성 | 용도 |
|---|---|---|
| `sso_state` | httpOnly · `sameSite:'lax'`(콜백이 허브발 top-level GET 302로 도착하는 크로스사이트 요청이라 `'strict'`면 미동봉) · `secure: NODE_ENV==='production'` · `path:'/sso'` · `maxAge: 1200`(20분) | `/sso/login`이 생성한 CSRF `state`. 콜백에서 timing-safe 대조 후 삭제. |
| `sso_nonce` | 위와 동일 속성 | id_token `nonce` 1회성 검증의 기본 메커니즘(쿠키 바인딩). 콜백에서 대조 후 즉시 삭제 — 콜백 URL 재붙여넣기를 거부한다. |
| `sso_return_to` | 위와 동일 속성 | 새니타이즈된 원래 목적지. 콜백 성공 시 이 경로로 302 후 삭제. |
| `sso_auto` | httpOnly · `sameSite:'lax'` · `secure: NODE_ENV==='production'` · `path:'/'`(미들웨어가 전체 라우트에서 읽어야 함) · `maxAge: 3600`(1시간) · 값 `'off'` 고정 | §8 로그아웃 루프 방지 억제 플래그. |

`SSO_TEMP_COOKIE_MAX_AGE`(1200s)는 신규 입사자의 허브 가입+OTP 왕복 시간을 감안한 값이다.

---

## 6. nonce 요건 재확인 (계약 §2.2)

허브는 `nonce`를 `[A-Za-z0-9._~-]`(RFC 3986 unreserved) **16~128자**로만 받는다. 위반 시 **400(리다이렉트 없음)** — SSO 시작 자체가 막힌다.

- 킷의 `randomToken()`(`randomBytes(32).toString('base64url')`, 43자)을 그대로 쓰면 **자동 충족**한다. `app/sso/login/route.ts`가 state·nonce 양쪽에 이미 이 함수를 쓴다.
- 직접 생성기를 쓸 경우: `crypto.randomUUID()`(36자)·`randomBytes(24|32).toString('base64url')`(32|43자)·hex 32자는 모두 요건을 만족한다.
- ⚠️ **표준 base64(`'base64'`)는 쓰지 말 것** — 출력에 `+`·`/`·`=`가 섞이는지가 난수에 따라 달라져 **간헐적으로만** 400이 나는(재현 어려운) 실패가 된다. 반드시 `'base64url'`.
- 허브는 위반 값을 조용히 다른 값으로 치환하지 않는다(MUST NOT). 치환하면 스포크의 "토큰 `nonce` ↔ 저장한 `nonce`" 대조가 항상 실패하기 때문이다.

---

## 7. Tier2: 일별 통계 (`/api/sso/stats`, 선택 참여)

- `GET /api/sso/stats?days=1~31` — 허브 cron이 일 1회 호출할 예정.
- 인증: 허브 RS256 요청 토큰(`scope='stats:read'` && `sub='sso-hub'`) — 코어 `verifyStatsRequest`가 검증. JWKS 재사용, **정적 시크릿 0개**.
- 어댑터가 `getDailyStats`를 구현하지 않으면 **404**(존재 자체를 숨김 — opt-in).
- 응답은 **집계값만** 포함한다. `email` 등 PII는 절대 반환하지 않는다(허브 설계 원칙: PII는 원 소유 서비스 밖으로 나가지 않는다).
  ```json
  {
    "app": "measure-web",
    "kitVersion": "2.0.0",
    "contractVersion": "2",
    "statsImplemented": true,
    "days": 7,
    "stats": [
      { "date": "2026-08-01", "ssoLogins": 12, "selfLogins": 3, "uniqueUsers": 14, "activeUsers": 20, "pageviews": 340 }
    ]
  }
  ```
- `Cache-Control: no-store` 고정.

> ⚠️ **허브 현황(2026-08-06 기준)**: 허브에는 아직 `scope='stats:read'`·`sub='sso-hub'`로 RS256 요청 토큰을 실제로 발급하는 코드가 없다(`/api/cron/sso-daily` v1.5는 의도적으로 미착수). 즉 이 라우트를 지금 배포해도 **정상 호출이 오지 않는다** — 무해하게 대기하는 상태다. `verifyStatsRequest`는 이와 무관하게 항상 fail-closed로 검증하므로 조기 배포 자체는 안전하다.

---

## 8. 로그아웃 · 자동 리다이렉트 (§2.7)

미들웨어로 "세션 없으면 `/sso/login`으로 자동 리다이렉트"를 켜면 **스포크 로그아웃이 불가능해진다**: 로그아웃 → 세션 없음 → 자동 SSO → 허브 세션(최대 30일) 생존 → silent 재로그인 루프. 킷은 두 장치를 제공한다.

### 8.1 로그아웃 억제 쿠키

```ts
// 스포크 자체 로그아웃 라우트에 추가
import { setAutoSuppressCookie } from '@/lib/sso-spoke';

export async function POST(req: Request) {
  const res = NextResponse.redirect(new URL('/login', req.url));
  await clearMySessionCookie(res);   // 기존 자체 로그아웃 로직(그대로 유지)
  setAutoSuppressCookie(res);        // sso_auto=off, 1시간 — 미들웨어가 자동 리다이렉트를 건너뛰게 함
  return res;
}
```

### 8.2 완전 로그아웃 링크 ("모든 사내 앱에서 로그아웃")

```tsx
import { getSsoConfig, getFullLogoutUrl } from '@/lib/sso-spoke';

// postLogoutRedirectUri는 허브 sso_clients.post_logout_redirect_uris에 정확매칭
// 등록돼 있어야 그 경로로 돌아온다. 미등록이면 허브가 조용히 자기 홈으로 보낸다(에러 아님)
// — 오너에게 이 URL도 함께 등록 요청할 것(2절 9단계).
<a href={getFullLogoutUrl(`${getSsoConfig().selfUrl}/login`)}>모든 사내 앱에서 로그아웃</a>
```

### 8.3 미들웨어 스니펫 (참고용 — 킷이 실제 파일로 배포하지 않는다)

> ⚠️ **선행조건 미충족 — 켜지 말 것** (허브 블루프린트 §7 단계5 각주1). 허브는 미로그인(`login_required`) 유입을 원시 행으로 기록하지 않는다(`SsoEventType`에 타입만 예약, `authorize` 핸들러가 이 분기에서 `logSsoEvent`를 호출하지 않음 — 2026-08-06 기준 코드 확인). 자동 리다이렉트를 켜면 늘어난 유입 물량이 정상 범위인지 판정할 카운터가 없다. **이 킷만 읽고 미들웨어를 켜지 말고, 반드시 허브 오너와 선행조건 충족 여부를 먼저 확인한다.** 자동 리다이렉트를 도입하더라도 "자체 로그인으로 진행" 우회 링크는 강등 불가 필수(허브 다운 폴백)이며, 완료 판정에 로그아웃 동작 확인을 포함한다.

```ts
// middleware.ts — 프로젝트 루트에 이미 있는 미들웨어에 수동 병합한다(덮어쓰기 금지,
// Next.js는 middleware.ts를 자동 활성화하므로 킷이 별도 파일로 배포하면 기존 미들웨어와
// 충돌할 수 있다).
import { NextResponse, type NextRequest } from 'next/server';
import { isAutoSuppressed } from '@/lib/sso-spoke';

export function middleware(req: NextRequest) {
  if (isAutoSuppressed(req)) return NextResponse.next(); // 로그아웃 직후 — silent 재로그인 억제
  // TODO: 자기 세션 쿠키 존재 확인. 없으면:
  //   const url = new URL('/sso/login', req.url);
  //   url.searchParams.set('returnTo', req.nextUrl.pathname + req.nextUrl.search);
  //   return NextResponse.redirect(url);
  return NextResponse.next();
}

export const config = {
  matcher: ['/protected/:path*'], // TODO: 보호 대상 경로로 교체
};
```

---

## 9. 콜백 실패 UX (`sso_error` 코드)

콜백 실패는 공격자만 오는 곳이 아니다 — 임시 쿠키 만료·이중 탭·뒤로가기 재진입이 정상 사용자를 보낸다. 사용자 도달 가능 실패(`state_mismatch`·`nonce_mismatch`·`token_invalid`·`provision_refused`·`userinfo_failed`)는 302 → `${SSO_ERROR_PATH}?sso_error=<code>`(기본 `/login`)로 이동한다. **스포크 로그인 페이지는 `sso_error` 쿼리가 있으면 "AI캠퍼스로 다시 로그인" 버튼 + 실패 안내를 보여줘야 한다**(스포크 UI 책임). 서버 오류(`server_error`)만 500 JSON을 유지한다. 어느 쪽이든 토큰 원문·email은 포함되지 않는다.

**Sentry를 쓰는 스포크는 자기 `/sso/callback` 라우트의 `token` 쿼리를 `beforeSend`/`beforeBreadcrumb`에서 반드시 마스킹한다** — 60초짜리 id_token이라도 `request.url` 브레드크럼에 그대로 남으면 탈취 가능한 노출면이 된다(허브가 동일한 문제를 겪고 이미 패치한 사례와 동일 패턴).

콜백에 새 쿼리 파라미터에 의미를 부여하는 확장은 금지한다(허브 `redirect_uri` 정확매칭은 베이스만 비교하므로 기술적으로는 통과하지만, 킷 콜백은 `token`/`state`/`error` 외 쿼리를 무시하도록 고정돼 있다).

---

## 10. 검증 체크리스트

- [ ] 미로그인 → `/sso/login?returnTo=/원래경로` → 허브 로그인 → 자동 복귀 + 자기 세션 쿠키 발급
- [ ] 허브 기로그인 브라우저 → 재진입 시 로그인 화면 없이 즉시 복귀
- [ ] 성공했던 콜백 URL을 다시 열기(재붙여넣기) → `/login?sso_error=…`로 거부(nonce 재사용 차단)
- [ ] 기존 자체 로그인(이메일+비번)이 SSO 설치 후에도 동일하게 동작(하이브리드)
- [ ] (Tier2 참여 시) `getDailyStats` 구현 배포 전: 무토큰 401 · `getDailyStats` 미구현 시 404
- [ ] (Tier2 참여 시) `getDailyStats` 구현 후: 허브 서명 토큰으로 200(현재는 허브가 이 토큰을 발급하지 않으므로 자체 발급한 테스트 토큰으로 확인)
- [ ] (`mergeUserinfo` 사용 시) `/sso/userinfo` 실패를 흉내내도(예: 만료 토큰) 콜백이 루프 없이 세션을 계속 발급하는지, 또는 `userinfoRequired`인 경우 사용자 클릭형 에러 페이지로 이동하는지
- [ ] `npx tsc --noEmit` + `npm run build` 통과

---

## 11. 버전 · 드리프트 · 문의

- **책임 분배**: 킷 파일을 무수정 복사하면 계약 검증 11항 중 7항(RS256 명시·iss·aud·state·nonce·도메인 재검증·stats 인증)이 "킷 보장"으로 자동 충족된다. 어댑터 책임은 provision 최소권한·세션 httpOnly 2항, 스포크 책임은 하이브리드 유지, 허브 오너 책임은 등록.
- **드리프트 관측**: `app/sso/login/route.ts`가 `/sso/authorize` 쿼리에 `kit=2.0.0`을 실어 보내 허브가 `sso_events.detail`에 자동 기록한다(전 스포크, stats 미참여 포함). Tier2 참여 스포크는 stats 응답의 `kitVersion`도 보조 신호로 쓰인다.
- **버전 갱신**: 킷 갱신은 허브 레포 `docs/sso/spoke-kit/`에서만 수행한다. 필수 어댑터 메서드 시그니처는 MAJOR 없이 변경하지 않는다. 갱신 시 스포크는 불변 파일만 덮어쓰기 → `tsc` → 배포 → 10절 체크리스트만 재실행하면 된다.
- **문의처**: `sso_clients` 등록 요청·운영 URL 확정·post_logout_redirect_uri 등록은 <오너>에게 전달한다. SSO 발급/거부 이벤트는 허브 `sso_events` 테이블(관리자 'SSO 현황' 탭)에서 확인 가능하다. `/sso/userinfo` 실패는 허브 측에 전혀 기록되지 않으므로(계약 §2.1.1 참고) Vercel HTTP 액세스 로그 상태코드와 스포크 자체 로그가 유일한 단서다.
