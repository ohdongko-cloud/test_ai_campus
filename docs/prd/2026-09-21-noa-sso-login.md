# PRD: 사내 통합계정(NoA Vibe Keycloak) SSO 로그인

- 작성일: 2026-09-21
- 작성자: Claude (요청자: <오너>)
- 범위: AI캠퍼스 로그인에 사내 통합계정(NoA Vibe Keycloak) SSO를 **브리지 방식**으로 추가. `lib/noa-oidc.ts`·`lib/noa-directory.ts`·`lib/noa-sso.ts`·`lib/noa-auth-return.ts`·`app/api/users/sso-login/route.ts`·`app/auth/login/*`·`app/auth/callback/*`·`components/WelcomePopup.tsx`·`app/m/_components/MobileWelcome.tsx`·`lib/sanitize-next.ts`(공용 추출)·마이그레이션 M014 포함.
- 관련 문서: [`docs/sso/NOA-SSO-AUDIT-20260921.md`](../sso/NOA-SSO-AUDIT-20260921.md) — 8렌즈 병렬 감사(에이전트 104개, 지적 32건 → 반박단 통과 18건 → 전부 수정)
- 상태: **구현 완료(로컬 게이트 통과) / 실제 Keycloak 왕복 미검증(배포 후에만 가능)**

---

## 1. 배경 / 문제

AI 캠퍼스는 Vercel에 호스팅된 Next.js 앱으로, 자체 JWT(httpOnly)+bcrypt 로그인과 이메일 OTP 가입을 운영해 왔다(~1,800명 실사용자). **2026-09-21 사용자 결정**으로 사내 통합계정(NoA Vibe 플랫폼이 운영하는 Keycloak)으로 로그인할 수 있는 경로를 추가한다. 기존 1,800명 계정은 사내계정과 **이메일이 정확히 일치**하며, 통합 이후 비밀번호만 사내 계정 것으로 바뀐다(사용자 진술).

**승인 경로**: `noa auth-integration request --oidc --directory` → 자동 승인.
- issuer `https://auth.noa.eland.com/realms/eland`(공개값)
- clientId `noa-sso-cmqpw5mm7003vmg01o5xwn0uf`(공개값)
- NoA Vibe 프로젝트 `eland-ai-campus` / projectId `cmqpw5mm7003vmg01o5xwn0uf`

**설계 원칙 — 브리지 방식**: Keycloak은 *자격 증명 확인*만 담당한다. 앱 세션은 여전히 기존 `lib/session.ts`의 httpOnly JWT를 그대로 발급한다. 이유: OIDC SDK가 id_token/access_token을 `sessionStorage`에 두는 설계인데, 이는 CLAUDE.md §6-4(세션은 JWT httpOnly 쿠키)를 위반한다. 브리지 방식을 택하면 서버가 id_token을 한 번 검증한 뒤 즉시 잊고, 권한(master/admin/user)·모바일·레이트리밋·감사로그가 전부 기존 로직을 그대로 탄다 — **롤백은 로그인 화면에서 버튼 하나를 빼는 것**으로 끝난다.

기존 이메일+비밀번호 로그인은 **유지**한다. SSO 장애 시 전 직원이 잠기는 것을 막기 위함이며, 제거는 다음 단계 과제다.

## 2. 목표 / 비목표 (G/non)

### 목표
- G1. 로그인 화면(데스크톱 `WelcomePopup`·모바일 `MobileWelcome`)에 "사내 계정으로 로그인" 버튼을 추가한다.
- G2. Keycloak Authorization Code + PKCE로 얻은 id_token을 서버가 직접 검증(서명·iss·aud·typ·azp·iat·nonce·jti)한 뒤, 검증된 신원(email)으로 기존 `users` 테이블을 조회/프로비저닝하고 기존 세션 발급 로직을 그대로 재사용한다.
- G3. 기존 회원(이메일이 사내계정과 일치)은 최초 SSO 로그인 시 자동으로 매칭되어 기존 학습이력·권한을 그대로 이어받는다.
- G4. 신규 직원은 SSO 최초 로그인 시 자동 프로비저닝(JIT)되며, 사내 디렉터리 조회로 소속·직급을 채운다.
- G5. 신규 유료 서비스·외부 의존성 추가 없음(`@noa/auth-sdk`는 배포 경로 문제로 제거, 계약만 자체 구현).
- G6. 기존 이메일+비밀번호 로그인·OTP 가입·비번 재설정 플로우 무변경 유지(하이브리드).

### 비목표
- N1. 기존 이메일+비밀번호 로그인 제거 — 다음 단계.
- N2. 계정 결속 키를 불변 식별자(`sub`)로 전환 — `users.noa_sub` 컬럼 마이그레이션 필요, 이번 범위 밖.
- N3. 안드로이드 앱의 `server.url`을 NoA Vibe 도메인으로 전환 — 이번 범위는 웹(Vercel) 우선, 안드로이드는 SSO 휴면 상태로 배포.
- N4. NoA Vibe 플랫폼으로 인가(권한/역할) 위임 — 역할 판단은 여전히 AI 캠퍼스 자체 DB(`admin`/`permissions`)가 한다.
- N5. SCIM/전체 디렉터리 동기화 — 개별 조회(JIT)만 수행.

## 3. 사용자 시나리오 (S)

### S1. 기존 회원 — 최초 SSO 로그인
1. 로그인 화면에서 "사내 계정으로 로그인" 클릭 → `/auth/login?next=<복귀경로>&remember=<0|1>`로 이동.
2. `AuthLoginClient`가 복귀 경로·자동로그인 여부를 sessionStorage에 저장한 뒤 PKCE로 Keycloak authorize 엔드포인트로 이동.
3. 사내 계정으로 인증 완료 → `/auth/callback?code=...`로 복귀(콜백 경로는 플랫폼 등록값이라 고정).
4. `handleCallback()`이 code를 id_token으로 교환(브라우저에 저장하지 않음) → `POST /api/users/sso-login`.
5. 서버가 id_token 검증 → email로 기존 `users` 행 매칭 → `lib/session.ts` httpOnly 세션 쿠키 발급 → 저장해 둔 복귀 경로로 이동. 기존 학습이력·권한이 그대로 보인다.

### S2. 신규 직원 — 최초 SSO 로그인(JIT 프로비저닝)
1~4. S1과 동일.
5. 서버가 email로 `users` 조회 → 없음 → 사내 디렉터리(NoA WAS) 조회로 이름·법인·조직·직급을 채워 신규 행 INSERT(비밀번호는 임의 bcrypt 해시 — 아무도 모름, SSO 전용 계정) → 세션 발급.

### S3. SSO 실패(취소·네트워크 오류·미등록 도메인 등)
1. `/auth/login` 또는 `/auth/callback`에서 오류 발생 → 통일된 안내 문구 + 저장해 둔 복귀 경로를 유지한 "로그인 화면으로 돌아가기" 링크 노출.
2. 사용자는 기존 이메일+비밀번호 로그인으로 계속 진행 가능(하이브리드 유지).

### S4. 모바일(Capacitor 앱)에서 SSO 버튼 클릭 (커토버 전까지는 휴면)
1. `app/m/_components/MobileWelcome.tsx`에도 동일 버튼 노출(모바일 패리티).
2. `capacitor.config.ts`의 `allowNavigation`에 Keycloak 호스트가 추가돼 있어 외부 브라우저로 튕기지는 않지만, `server.url`이 여전히 Vercel이라 실사용 흐름 전체는 이번 배포에서 검증 대상이 아니다(§8-4).

## 4. 기능 요구사항 (F)

### F1. 구현 파일

| 파일 | 역할 |
|---|---|
| `lib/noa-oidc.ts` | 브라우저 PKCE(Authorization Code+S256) — `startLogin`/`handleCallback`. 토큰을 sessionStorage에 저장하지 않음 |
| `lib/noa-directory.ts` | 서버 전용 사내 디렉터리 단건 조회(`GET {baseUrl}/users/{username}`), AbortController 5초 타임아웃 |
| `lib/noa-sso.ts` | 서버 id_token 검증(RS256 JWKS·iss/aud/typ/azp/iat 재생창/nonce/jti) + jti 1회 소비(`consumeIdTokenJti`) |
| `app/api/users/sso-login/route.ts` | `POST` 브리지 API — 검증된 신원으로 조회/프로비저닝 후 기존 세션 쿠키 발급 |
| `app/auth/login/page.tsx`·`AuthLoginClient.tsx` | Keycloak authorize로 이동, 복귀경로·자동로그인 여부 저장 |
| `app/auth/callback/page.tsx`·`AuthCallbackClient.tsx` | code→id_token 교환, 브리지 API 호출, 복귀 처리(콜백 경로는 `/auth/callback` 고정 — 플랫폼 등록값) |
| `components/WelcomePopup.tsx` / `app/m/_components/MobileWelcome.tsx` | "사내 계정으로 로그인" 버튼(데스크톱/모바일 패리티) |
| `lib/sanitize-next.ts` | 기존 `app/login/page.tsx` 인라인 오픈리다이렉트 방지 함수를 공용 모듈로 추출(재구현 금지 — 과거 dot-segment 우회 취약점 수정본, 골든 테스트 C3가 강제) |
| `lib/noa-auth-return.ts` | SSO 왕복 중 복귀 경로·자동로그인 여부를 넘기는 sessionStorage 키 상수 |
| M014 `noa_sso_used_tokens` | id_token `jti` 1회 소비 기록(재생 차단) + `expires_at` 인덱스 |

### F2. id_token 검증 (`lib/noa-sso.ts`)
서명(JWKS, `createRemoteJWKSet`)·`iss`·`aud`(=clientId)·`typ==='ID'`·`azp`(있으면 clientId 일치)·`iat` ±120초 재생창·`nonce`(제공 시 대조)·`jti` 존재를 모두 검증. 실패 사유는 서버 로그에만 남기고 응답은 통일된 401 메시지(§6-8).

### F3. email 해석 — 합성 금지
아래 두 경로 중 하나로만 email을 확정한다. 둘 다 실패하면 로그인을 거부한다(합성하지 않음):
1. id_token의 `email` 클레임 + `email_verified === true`.
2. 사내 디렉터리 조회 결과의 email.

가입 허용 도메인 검사는 공용 `isAllowedSignupEmail`(앵커 정규식)로 통일한다 — `endsWith` 사용 금지(`x@eland.co.kr@eland.co.kr` 같은 값 통과 방지).

### F4. 재생(replay) 방지
`noa_sso_used_tokens(jti PK)`에 `INSERT ... ON CONFLICT DO NOTHING`. 반환 행 없음(이미 존재) = 재생 → 거부. 쿼리 자체가 실패(테이블 부재 등)해도 fail-closed로 거부하되, 원인을 `replay`/`error`로 구분해 감사 로그에 남긴다(저장소 오류를 "재생 공격"으로 오기록하지 않도록).

### F5. 계정 매칭·JIT 프로비저닝
`users.email`로 조회. 없으면 신규 INSERT — 이름은 id_token `name`(디렉터리 있으면 그 값 우선), 법인/조직/직급은 디렉터리 값 또는 `'-'` 폴백, 비밀번호는 임의 32바이트 bcrypt 해시(SSO 전용 계정, 아무도 모름 → 비번 로그인 불가). 디렉터리 조회는 5초 타임아웃 — 실패해도 가입 자체는 진행(부가 필드만 폴백).

### F6. CSRF 차단 (`POST /api/users/sso-login`)
`Origin` 헤더(없으면 `Sec-Fetch-Site: same-origin`)로 동일 오리진만 허용. 레이트리밋 10회/5분/IP.

### F7. 복귀 경로·자동로그인 상태 전달
`lib/noa-auth-return.ts`의 sessionStorage 키로 로그인 시작 시점의 `next`(재검증은 `sanitizeNext`)와 "자동 로그인" 체크 상태를 콜백까지 이어 전달. 실패 시에는 복귀 경로를 지우지 않아 재시도 시에도 유지된다.

### F8. 세션 발급
검증·프로비저닝 완료 후 기존 `lib/session.ts`의 `setUserSessionCookie`를 그대로 호출 — httpOnly, `rememberMe`에 따라 세션/30일 쿠키. 신규 세션 발급 경로를 추가하지 않아 회귀 위험을 최소화했다.

### F9. 마이그레이션 M014
`noa_sso_used_tokens(jti TEXT PRIMARY KEY, expires_at TIMESTAMPTZ)` + `expires_at` 인덱스. `CREATE TABLE IF NOT EXISTS`(멱등). INSERT 성공 시 1% 확률로 만료 행(`expires_at < now() - interval '1 day'`) 정리(별도 cron 없음).

### F10. Sentry 스크러빙 확장
`lib/sentry-scrub.ts`의 `TOKEN_RE`에 `code=`·`session_state=`를 추가(기존 `token=`/`id_token=`만 있던 것 확장) — Keycloak 콜백의 인가코드가 트랜잭션/브레드크럼으로 전송되지 않도록 한다. 클라이언트도 `handleCallback()` 직후 `history.replaceState`로 URL의 쿼리스트링을 즉시 제거한다.

### F11. 안드로이드 Capacitor
`capacitor.config.ts`의 `server.allowNavigation`에 `auth.noa.eland.com` 추가, `android/app/build.gradle` `versionCode` 13→14. 단 `server.url`은 여전히 Vercel — 실사용 검증은 커토버 이후(N3, §8-4).

## 5. UX / 디자인

- 로그인 화면(데스크톱 `WelcomePopup` 이메일 입력 단계, 모바일 `MobileWelcome`)에 구분선("또는") 아래 보조 버튼(ghost 스타일)으로 "사내 계정으로 로그인" 노출 — 기존 이메일 입력 플로우와 대등하지 않은 대안으로 배치한다.
- `/auth/login`·`/auth/callback`은 별도 풀페이지(로그인 화면과 톤 일치, 중앙 정렬 카드) — "사내 계정으로 이동하는 중입니다..." / "로그인 처리 중입니다..." 로딩 문구, 실패 시 통일 문구 + "로그인 화면으로 돌아가기" 링크(복귀 경로 유지).
- 에러 메시지는 원인별로 세분화하지 않는다(§6-8) — 사용자에게는 "로그인 처리 중 문제가 발생했습니다" 또는 서버가 준 "사내 계정 인증에 실패했습니다" 문구만 노출.
- 성공 시 화면은 기존 이메일 로그인과 동일한 로그인 후 화면으로 수렴(신규/기존 회원 구분 노출 없음).

## 6. 엣지 케이스

| ID | 상황 | 처리 |
|---|---|---|
| E1 | id_token에 `email` 클레임 없음/미검증 | 디렉터리 조회로 대체, 그마저 없으면 거부(합성 금지, F3) |
| E2 | id_token `jti` 재사용(재생) | `noa_sso_used_tokens` UPDATE 0행 → 401, 감사로그 `sso-token-replay` |
| E3 | M014 미적용 상태에서 로그인 시도 | INSERT가 테이블 부재로 예외 → fail-closed 401, 감사로그는 `sso-jti-store-error`로 `replay`와 구분 기록(오진단 방지) |
| E4 | 디렉터리 브로커 응답 지연/무응답 | 5초 타임아웃(AbortController) — email 해석 단계면 거부, 프로비저닝 부가필드 단계면 `'-'` 폴백으로 가입은 진행 |
| E5 | `POST /api/users/sso-login`에 교차사이트 POST(CSRF) | Origin/Sec-Fetch-Site가 동일 오리진이 아니면 401 |
| E6 | 같은 realm의 다른 클라이언트가 발급한 토큰(`typ`≠ID 또는 `azp` 불일치) | 검증 단계에서 거부 |
| E7 | `nonce` 없이 또는 불일치로 도착 | 대조 실패 시 거부(단, nonce 단독은 약한 통제 — §8-2 참조) |
| E8 | SSO 콜백 실패(사용자 취소·네트워크 오류) | 통일 에러 문구 + 저장해 둔 복귀 경로를 유지한 복귀 링크. 세션 미발급 |
| E9 | React StrictMode(dev) 이중 마운트 | `startedRef` 가드로 authorization code 중복 소진 방지(1회만 실행) |
| E10 | 안드로이드 WebView에서 SSO 버튼 클릭 | `allowNavigation`에 Keycloak 호스트 추가로 외부 브라우저 이탈은 방지되나, `server.url`이 Vercel이라 전체 흐름 실사용은 미검증(§8-4) |
| E11 | 사내계정 email이 기존 회원과 불일치(개명·이메일 변경) | 새 이메일로 신규 계정이 프로비저닝됨(재바인딩 아님) — 잔여 위험, §8-1 |
| E12 | 기존 이메일+비밀번호 로그인 사용자 | 영향 없음 — 완전 병행(하이브리드) |
| E13 | 배포 Lambda가 `NOA_AUTH_*` env를 아직 주입하지 않음 | `noaSsoConfig().enabled=false` → SSO 버튼 클릭 시 "사내 계정 로그인을 현재 사용할 수 없습니다" 안내, 기능 전체가 조용히 휴면(장애 아님) |

### §6 보안 섹션 — CLAUDE.md §6 정책 매핑

| CLAUDE.md §6 | SSO 적용 |
|---|---|
| §6-1 `@eland.co.kr` 도메인 | 공용 `isAllowedSignupEmail`로 검증된 email만 통과(F3), 앵커 정규식 |
| §6-2 bcrypt | SSO 프로비저닝 계정도 임의 32바이트 bcrypt 해시 저장(SSO 전용, 비번 로그인 불가) |
| §6-4 JWT httpOnly | id_token은 URL/메모리에서만 존재, sessionStorage 미저장. 앱 세션은 기존 `lib/session.ts` httpOnly 쿠키 그대로(브리지 방식의 핵심 근거) |
| §6-5 레이트리밋 | `POST /api/users/sso-login` 10회/5분/IP |
| §6-7 PII 보호 | 브리지 API 응답 `no-store`, 로그에 id_token 원문·이메일 평문 미기록 |
| §6-8 에러 통일 | catch → "서버 오류가 발생했습니다." / 인증 실패는 "사내 계정 인증에 실패했습니다."로 원인 비노출 |
| §6-10 감사 로그 | 기존 `auth_logs`에 `login_success`/`login_failure`/`signup_complete` 기록(`detail: 'sso'`/`'sso-provision'`/`'sso-token-replay'` 등) |
| §6-11 비밀번호 메일 미발송 | SSO 프로비저닝 계정 비밀번호는 아무도 모르며 메일 발송 없음(재설정 플로우 대상 여부는 §8-7 미해결) |

**PII 보호**: id_token 검증·디렉터리 조회 과정에서 얻은 이름·소속·직급은 기존 `users` 테이블 컬럼에만 저장되고 별도 캐시·로그에 남지 않는다. Sentry 스크러버가 콜백 URL의 인가코드·`session_state`를 마스킹(F10).

**인증·권한 회귀**: 세션 발급 경로는 기존 `setUserSessionCookie` 그대로 재사용하므로 `admin`/`master` 판정 로직(`lib/admin-auth.ts`) 무변경. 신규 admin API 없음.

**DB 마이그레이션 안전성**: M014 `CREATE TABLE IF NOT EXISTS`(멱등), 기존 테이블 무변경, 하위호환. **배포 후 마스터가 `POST /api/admin/migrate` 1회 실행 필요** — 미실행 시 SSO 전면 401(E3, fail-closed).

**모바일/안드로이드**: `app/m/_components/MobileWelcome.tsx` 버튼 동반, `capacitor.config.ts` allowNavigation 갱신 + `versionCode` 13→14(F11). 단 `server.url`이 아직 Vercel이라 실사용 검증은 커토버 이후(§8-4).

**env 동기화**: `NOA_AUTH_ISSUER`·`NOA_AUTH_CLIENT_ID`·`NOA_AUTH_INTEGRATION_ID`·`NOA_AUTH_DIRECTORY_URL`·`NOA_AUTH_DIRECTORY_TOKEN`은 **NoA Vibe 배포 Lambda가 런타임에 주입**한다. 가드레일이 이 값들을 코드·env 파일에 직접 쓰는 것을 금지하므로 `.env.local.example`에는 추가하지 않는다 — 로컬 개발 등 env 미설정 환경에서는 SSO가 자동으로 휴면(E13)되며, 이는 의도된 동작이다.

**벤더링 부채(명시)**: `@noa/auth-sdk`는 사내 CodeArtifact 전용이라 Vercel 빌드가 install 단계에서 깨진다(무인증 401, 공개 npm 404). 배포 경로 2곳(Vercel·NoA Vibe)을 유지하기 위해 SDK를 의존성으로 두지 않고 **와이어 계약만 자체 구현**했다(`lib/noa-oidc.ts`·`lib/noa-directory.ts` 상단 주석에 실측 경로 기록). `package-lock.json`의 resolved 호스트는 `registry.npmjs.org` 하나뿐이다. 이는 가드레일이 명시한 "승인 후 SDK 사용"에서 **의도적으로 이탈한 것**이며, NoA Vibe 플랫폼이 authorize/token/directory 계약을 바꾸면 이 구현은 조용히 깨진다(빌드는 통과하지만 런타임에서 실패). 벤더링하며 SDK에 없던 `state`(CSRF 방지)·`nonce`(재생 방지 보조층)를 추가했고, 토큰을 `sessionStorage`에 저장하지 않도록 바꿨다.

## 7. 성공 기준

### 로컬 게이트 (완료)
- [x] `npx tsc --noEmit` 통과.
- [x] `npm run build` 통과(더미 env).
- [x] 골든 테스트 50/50 통과.
- [x] 8렌즈 병렬 감사(에이전트 104개) → 지적 32건 → 반박단 통과 18건 → 전부 수정 반영(`docs/sso/NOA-SSO-AUDIT-20260921.md`).
- [x] id_token email 합성 폴백 제거 — `email_verified` 미검증 시 디렉터리 조회로 대체, 둘 다 실패 시 거부.
- [x] `POST /api/users/sso-login` CSRF 동일 오리진 검사.
- [x] `typ`/`azp` 검증(형제 클라이언트 토큰 차단).
- [x] jti 저장소 오류(`error`)와 실제 재생(`replay`) 구분 기록.
- [x] Capacitor `allowNavigation`에 Keycloak 호스트 추가 + `versionCode` 13→14.
- [x] SSO 실패 화면의 복귀 링크가 `next` 유지(모바일 패리티 회귀 방지).
- [x] Sentry 스크러버에 `code=`/`session_state=` 마스킹 추가.
- [x] React StrictMode 콜백 무한 로딩 버그 수정.
- [x] TypeScript 컴파일 에러 없음.

### 배포 후 검증 대기 (실 Keycloak 왕복 — 미검증)
- [ ] AC1. 마스터가 `POST /api/admin/migrate` 실행 → `noa_sso_used_tokens` 테이블 생성 확인.
- [ ] AC2. 실제 사내 계정으로 "사내 계정으로 로그인" 클릭 → Keycloak 인증 → 콜백 → 세션 발급까지 왕복 성공.
- [ ] AC3. 기존 회원(이메일 일치) SSO 최초 로그인 시 기존 학습이력·권한이 그대로 보임.
- [ ] AC4. 신규 직원 최초 SSO 로그인 시 JIT 프로비저닝 + 디렉터리 소속/직급 반영 확인.
- [ ] AC5. Keycloak 클라이언트에 운영 콜백 URL(`.../auth/callback`)이 등록됐는지 확인 — 관리자 영역이라 사전 확인 불가, 첫 시도가 테스트.
- [ ] AC6. 동일 id_token 재사용(재생) 시도 시 401 + `sso-token-replay` 기록 확인.
- [ ] AC7. 배포 Lambda의 `NOA_AUTH_*` env 주입 확인(미주입 시 SSO 휴면이 의도대로 동작하는지).
- [ ] AC8. 안드로이드 앱에서 SSO 버튼 클릭 시 동작 확인(단 `server.url` 커토버 전이므로 실사용 시나리오는 범위 밖으로 SKIP 가능).

## 8. 미해결 질문

> **해결됨 (2026-09-22) — 공용 PC 로그아웃**: 로그아웃이 Keycloak 세션을 끊지 않아 매장 공용 PC에서 다음 사람이 직전 사용자 계정으로 무인증 로그인되던 문제는 **authorize에 `prompt=login` 추가**로 닫았다(`lib/noa-oidc.ts`). 대안이던 RP-initiated logout은 `post_logout_redirect_uri`의 Keycloak 등록 여부를 확인할 수 없어 보류했다.
> 비용: Keycloak을 거치는 건 앱 세션이 없을 때뿐이고 로그인 후 자체 httpOnly JWT(자동 로그인 기본 ON → 30일)로 버티므로, 체감상 월 1회 수준의 비밀번호 입력이다.
> 남는 한계: 이 조치는 **우리 앱만** 막는다. Keycloak 세션은 살아 있어 같은 브라우저의 다른 사내 앱은 직전 사용자로 열린다 → RP-initiated logout은 등록 확인 후 **후속 과제**로 남긴다.

1. **계정 결속 키가 email**: IdP에서 사용자 이메일이 바뀌면 기존 계정과 재바인딩되지 않고 새 계정이 생성된다(E11). 불변 식별자(`sub`) 결속으로 전환하려면 `users.noa_sub` 컬럼 마이그레이션이 필요 — 이번 범위 밖.
2. **nonce 단독 통제의 한계**: 서버가 기대 nonce 값을 별도 저장하지 않고 클라이언트가 함께 제출한 값과 대조하므로, 악의적 클라이언트는 토큰과 nonce를 둘 다 지어낼 수 있다. 재생 방지의 1차 통제는 jti 1회 소비(F4)이며 nonce는 그 위의 보조 방어층일 뿐이다.
3. **Keycloak 클라이언트 콜백 등록 확인 불가**: 운영 콜백 URL이 NoA Vibe Keycloak 클라이언트에 정확히 등록됐는지 관리자 영역이라 사전 확인 불가 — 배포 후 첫 로그인 시도가 곧 테스트다.
4. **안드로이드 SSO 실사용 시점**: 현재 `server.url`이 Vercel이라 SSO는 앱에서 휴면 상태다(N3). 커토버(사내 통합계정으로 전환) 시 `allowNavigation` 확장뿐 아니라 `server.url`을 NoA Vibe 도메인으로 전환하는 작업을 **동시에** 해야 한다 — 시점 미정.
5. **M014 미적용 배포 시 전면 장애**: 배포 직후 마스터가 `POST /api/admin/migrate`를 실행하기 전까지 SSO는 fail-closed로 전면 401이다(E3). 실행 시점·담당자 확인 필요.
6. **기존 이메일+비밀번호 로그인 제거 시점**: 이번 범위는 하이브리드 유지(N1)이며, 언제·어떤 조건에서 이메일 로그인을 제거할지는 미정.
7. **SSO 프로비저닝 계정의 비밀번호 재설정/탈퇴 플로우**: 임의 bcrypt 해시라 비번 로그인 자체가 불가능한데, 기존 "비번 변경(현재 비번 확인)"·"회원 탈퇴(비번 재입력)" 본인확인 플로우(§6-3)와 어떻게 상호작용할지 미검토.
