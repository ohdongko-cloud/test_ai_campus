# NoA Vibe 사내 SSO 변경 — 다각도 감사 결과 (2026-09-21)

> 8개 렌즈 병렬 감사 → 지적마다 3인 반박단(적대적 검증) → 과반이 반박하지 못한 것만 남김.
> 에이전트 104개 · 지적 32건 → **생존 18건 / 기각 14건**.
>
> 기각은 "문제 없음"이 아니라 "반박단 과반이 성립하지 않는다고 판정"이다. 근거는 §3 참조.

## 1. 요약

| 등급 | 건수 |
|---|---|
| 🔴 BLOCKER | 4 |
| 🟠 MAJOR | 8 |
| 🟡 MINOR | 6 |

## 2. 생존 지적 (수정 대상)

### 1. 🔴 BLOCKER · 토큰 검증

**email 클레임이 없을 때 `${preferred_username}@eland.co.kr`을 합성하므로, @eland.co.kr 도메인 게이트(§6-1)가 절대 실패할 수 없고 임의 기존 계정(마스터 관리자 포함)으로 세션이 발급된다**

- **위치**: `lib/noa-sso.ts:104`
- **실패 시나리오**: Keycloak realm `eland`에 이메일 속성이 비어 있는 계정(협력사/테스트/공용 운영 계정 등)이 하나라도 있으면 성립한다. Keycloak의 내장 email 매퍼는 user.email이 null이면 클레임 자체를 생략하므로 id_token에 email이 없다. 이때 noa-sso.ts:104-107이 email을 `oh_dongha01@eland.co.kr`처럼 **만들어낸다**. 결과 (1) route.ts:51의 `endsWith('@eland.co.kr')`는 이 경로에서 구조적으로 항상 통과 — 사내 도메인 제한이 아무것도 제한하지 않는다. (2) route.ts:57-61이 그 합성 이메일로 users를 조회해 매칭되면 route.ts:110 `setUserSessionCookie(u.id, u.email, ...)`로 **그 직원의 완전한 앱 세션**을 발급한다. SSO 주체는 해당 메일함 소유를 한 번도 증명하지 않았다. (3) 사내 Keycloak username이 AD sAMAccountName(=메일 로컬파트) 형태이면 매칭 확률이 사실상 1이다. (4) lib/admin-auth.ts:96-99에서 master 판정이 오직 세션 쿠키의 email 문자열과 MASTER_ADMIN_EMAILS 비교이므로, username이 마스터 메일 로컬파트와 같은 emailless 계정 하나면 마스터 관리자 권한까지 그대로 넘어간다.
- **제안 수정**: 폴백을 삭제하고 email 클레임 부재 시 throw한다. `const emailClaim = typeof payload.email === 'string' ? payload.email.trim() : ''; if (!emailClaim) throw new Error('noa-sso: email claim missing');` — 도메인 게이트가 실제로 falsifiable해야 §6-1이 의미를 가진다.
- **반박단 판정**: 3/3 성립

### 2. 🔴 BLOCKER · UI·모바일 패리티

**Capacitor allowNavigation에 Keycloak 호스트가 없어 안드로이드 앱의 SSO가 외부 브라우저로 튕기고 반드시 실패한다**

- **위치**: `capacitor.config.ts:11`
- **실패 시나리오**: 안드로이드 앱은 WebView에 https://retail-ai-campus.vercel.app/m 을 띄운다(server.url). 사용자가 MobileWelcome의 「사내 계정으로 로그인」을 누르면 /auth/login?next=%2Fm 으로 가고, SDK가 window.location.assign('https://auth.noa.eland.com/realms/eland/protocol/openid-connect/auth?...')를 실행한다(chunk-5HTWYJJP.mjs, NoaAuth.login). allowNavigation은 ['retail-ai-campus.vercel.app','*.vercel.app']뿐이라 auth.noa.eland.com은 허용 호스트가 아니고, Capacitor의 shouldOverrideUrlLoading이 이를 외부 시스템 브라우저로 내보낸다. (1) PKCE verifier는 WebView의 sessionStorage('noa-auth-pkce')에 저장돼 있는데 외부 브라우저에는 없다 → handleCallback()이 AUTH_PKCE_VERIFIER_MISSING을 던져 콜백이 무조건 '로그인 처리 중 문제가 발생했습니다.'로 끝난다. (2) 설령 성공해도 httpOnly 세션 쿠키는 외부 브라우저 쿠키저장소에 발급된다. (3) AndroidManifest.xml에 VIEW/BROWSABLE 인텐트 필터가 없어 앱으로 돌아올 경로 자체가 없다 → 사용자는 외부 브라우저에 고립된다. 즉 안드로이드 앱에서 이 기능은 100% 실패한다.
- **제안 수정**: capacitor.config.ts의 server.allowNavigation에 'auth.noa.eland.com'(NOA_AUTH_ISSUER 호스트)을 추가한다. 이 파일은 네이티브 빌드에 구워지므로 웹 배포만으로는 반영되지 않는다 — npx cap sync 후 android/app/build.gradle의 versionCode를 13 → 14로 올려 APK를 재배포해야 한다(프로젝트 규칙: Capacitor versionCode 증가). 현재 diff에 capacitor.config.ts·android/ 변경이 전혀 없다. 재배포 전까지는 안드로이드 WebView(UA 또는 Capacitor 플랫폼 감지)에서 SSO 버튼을 숨기거나 '앱에서는 이메일 로그인을 이용해주세요' 안내로 대체하는 편이 낫다.
- **반박단 판정**: 3/3 성립

### 3. 🔴 BLOCKER · NoA Vibe 가드레일

**@noa/auth-sdk는 인증이 필요한 사내 CodeArtifact에서만 받을 수 있는데 repo에 .npmrc가 없어, 이 커밋이 main에 올라가면 사이트 전체 Vercel 빌드가 install 단계에서 깨진다**

- **위치**: `package.json:19`
- **실패 시나리오**: package-lock.json:1503이 @noa/auth-sdk 0.1.2를 https://noa-vibe-prd-281817609029.d.codeartifact.ap-northeast-1.amazonaws.com/... 로 고정한다. repo 루트~depth2에 .npmrc가 없고(find 결과 0건), .gitignore에도 npmrc 항목이 없으며, vercel.json에는 crons만 있고 installCommand가 없다. 실제로 인증 없이 그 tarball URL을 치면 HTTP 401, 공개 npm(registry.npmjs.org/@noa/auth-sdk)은 HTTP 404다(둘 다 실측). @noa 레지스트리와 _authToken은 개발자 개인 ~/.npmrc 에만 있다. 따라서 로컬에서는 tsc·build·테스트가 전부 통과하지만, main 푸시 → Vercel 자동배포의 npm ci 는 401로 실패한다. 실패 지점이 install 이라 SSO 기능만이 아니라 **운영 사이트(1,800명)의 다음 배포 전체**가 막히고, 그 시점엔 이미 커밋이 main에 있어 롤백 커밋을 또 밀어야 한다. 같은 이유로 새 팀원 clone·GitHub Actions 등 자격증명 없는 모든 환경에서 npm ci 가 깨진다.
- **제안 수정**: 푸시 전에 배포 타깃을 먼저 확정할 것. (a) Vercel이 맞다면: AWS 자격증명을 Vercel env로 넣고 vercel.json 에 installCommand 로 `aws codeartifact get-authorization-token` → `.npmrc` 생성 → `npm ci` 를 잇고, repo에는 `@noa:registry=...` + `//.../:_authToken=${NPM_TOKEN}` 형태의 **자리표시자 .npmrc만** 커밋한다(CodeArtifact 토큰은 최대 12시간짜리라 리터럴 토큰 커밋은 §6-4 위반이자 12시간 뒤 깨진다). (b) 배포가 NoA Lambda 파이프라인이라면 Vercel 자동배포를 이 브랜치에 대해 꺼두거나 분리하고, 그 사실을 CLAUDE.md 스택 항목에 반영한다. 어느 쪽이든 `rm -rf node_modules && npm ci` 를 자격증명 없는 셸에서 1회 재현해 통과를 확인한 뒤 푸시.
- **반박단 판정**: 3/3 성립

### 4. 🔴 BLOCKER · 런타임·빌드

**@noa/auth-sdk는 사설 CodeArtifact 레지스트리에서만 받을 수 있는데 repo에 .npmrc가 없어 Vercel 빌드의 install 단계가 실패한다**

- **위치**: `package.json:19`
- **실패 시나리오**: package-lock.json의 @noa/auth-sdk 항목 resolved가 https://noa-vibe-prd-281817609029.d.codeartifact.ap-northeast-1.amazonaws.com/npm/npm-internal/@noa/auth-sdk/-/auth-sdk-0.1.2.tgz 다. 실측: 해당 tarball URL에 무인증 GET → HTTP 401, registry.npmjs.org/@noa%2fauth-sdk → HTTP 404. repo에 .npmrc가 없고(git ls-files | grep npmrc 결과 없음) vercel.json에 installCommand도 없다. 스코프 매핑과 _authToken은 개발자 개인 파일 C:\Users\oh_dongha01\.npmrc 에만 있다. 따라서 main 푸시 → Vercel 자동 배포 시 npm ci가 lockfile의 resolved URL을 인증 없이 요청해 401로 죽고, SSO뿐 아니라 배포 전체가 실패한다(운영 1,800명 대상 이후 모든 변경이 배포 불가). CodeArtifact 토큰은 최대 12시간짜리라 Vercel env에 NPM_TOKEN을 박아두는 것도 하루 만에 다시 깨진다.
- **제안 수정**: 배포 경로를 먼저 확정할 것. (a) Vercel 유지라면 repo에 .npmrc(@noa:registry=... , //host/:_authToken=${NOA_CODEARTIFACT_TOKEN})를 커밋하고 vercel.json installCommand에서 aws codeartifact get-authorization-token으로 매 빌드마다 토큰을 발급받게 한다(토큰 만료 대응). (b) 그게 불가하면 SDK dist를 vendor 디렉터리에 넣고 package.json을 file: 의존으로 바꾸거나, 사용 중인 4개 함수(createAuth/createAuthServer)만 자체 구현해 외부 의존을 없앤다. 어느 쪽이든 커밋 전에 깨끗한 환경(HOME 격리 또는 --userconfig /dev/null)에서 npm ci가 통과하는지 실측해야 한다.
- **반박단 판정**: 3/3 성립

### 5. 🟠 MAJOR · 세션·인증 회귀

**id_token의 email 클레임을 email_verified 확인 없이 계정 식별자로 그대로 사용해, IdP 쪽 이메일이 바뀌면 남의 계정(master 포함) 세션이 발급된다**

- **위치**: `lib/noa-sso.ts:104`
- **실패 시나리오**: verifyNoaIdToken은 서명/iss/aud/exp/iat/jti만 검증하고 payload.email_verified는 읽지 않는다(레포 전체에 email_verified 문자열이 0건). sso-login route는 이 email만으로 `WHERE email = ${identity.email}` 매칭을 한다. Keycloak 계정 B의 email 클레임이 미검증 상태로 oh_dongha01@eland.co.kr(= MASTER_ADMIN_EMAILS 등록값)로 설정되면 — 셀프서비스 프로필 수정이 허용되거나 디렉터리 동기 오류가 나면 — B가 SSO 로그인 시 그 이메일 소유자의 users row(u.id, u.email)로 앱 세션이 발급된다. lib/admin-auth.ts getAdminContext는 세션 email을 소문자화해 MASTER_ADMIN_EMAILS와 대조하므로 그대로 master 권한까지 통과한다. 앱 쪽에 이를 막는 방어가 전혀 없다(SDK 결함이 아니라 우리 검증 코드의 누락).
- **제안 수정**: verifyNoaIdToken에서 payload.email_verified === true를 필수 조건으로 추가하고(SDK scope가 'openid profile email'이라 Keycloak이 이 클레임을 실어 보낸다), 계정 매칭 키를 변경 가능한 email이 아니라 불변 식별자(payload.sub 또는 preferred_username)로 옮긴다 — users에 noa_sub 컬럼(M015, UNIQUE, nullable)을 추가해 sub 우선 매칭, 최초 1회만 email로 링크 후 sub를 기록.
- **반박단 판정**: 2/3 성립

### 6. 🟠 MAJOR · PII·시크릿·에러 누출

**Keycloak 인가코드가 담긴 /auth/callback URL이 Sentry 스크러버를 통과한다 — 기존 마스킹은 token=/id_token= 만 매칭**

- **위치**: `lib/sentry-scrub.ts:11`
- **실패 시나리오**: SDK가 redirectUri를 `${origin}/auth/callback`으로 고정하므로(node_modules/@noa/auth-sdk/dist/chunk-5HTWYJJP.mjs redirectUri()) Keycloak은 항상 `https://retail-ai-campus.vercel.app/auth/callback?code=<인가코드>&session_state=...`로 되돌린다. AuthCallbackClient.tsx는 POST /api/users/sso-login 이 200일 때만 L104 router.replace()로 URL을 갈아끼우므로, 토큰교환+브리지 API 왕복 동안(그리고 실패 시 영구히) code가 주소창에 남는다. sentry.client.config.ts는 prod에서 tracesSampleRate 0.1 · beforeSendTransaction=scrubEvent로 동작하는데 TOKEN_RE는 `(?:id_)?token=` 만 매칭하므로 `code=`를 건드리지 않는다. 결과: SSO 콜백 pageload 트랜잭션의 약 10%, 그리고 그 페이지에서 발생한 모든 클라이언트 에러 이벤트가 request.url·navigation 브레드크럼에 인가코드 원문을 실어 외부(Sentry)로 나간다. 파일 주석이 선언한 §6-B1①(‘토큰이 URL로 흐르면 Sentry 전송 전 제거’) 통제가 새 플로우에서만 비어 있다. PKCE verifier는 sessionStorage에 있어 즉시 교환은 막히지만, 단일사용 자격증명이 서드파티 로그에 남는 것 자체가 정책 위반이다.
- **제안 수정**: TOKEN_RE를 `/((?:^|[?&#])(?:(?:id_)?token|code|session_state)=)[^&#\s]+/gi` 로 확장하고 TOKEN_KEY_RE에도 `code`·`session_state`를 추가한다. 추가로 AuthCallbackClient에서 handleCallback() 직후(성공·실패 무관) `window.history.replaceState({}, '', '/auth/callback')`로 쿼리를 즉시 제거해 브라우저 히스토리·Referer 잔존도 함께 없앤다.
- **반박단 판정**: 2/3 성립

### 7. 🟠 MAJOR · PII·시크릿·에러 누출

**id_token의 email 클레임을 email_verified 검증 없이 계정 바인딩 키로 사용 — 타인 계정 세션·PII가 발급된다**

- **위치**: `lib/noa-sso.ts:104`
- **실패 시나리오**: verifyNoaIdToken은 서명·iss·aud·exp·iat·jti를 모두 검증하지만 `email_verified` 클레임은 읽지도 않는다(L104-107). 안정적·변경불가 식별자인 preferred_username은 L98에서 뽑아 두고도 디렉터리 조회에만 쓰이고, 계정 바인딩은 전적으로 email 클레임에 의존한다(route.ts L57-61 `WHERE email = ${identity.email}`). Keycloak 기본 설정은 사용자가 Account Console에서 자기 프로필 email을 임의 값으로 바꿀 수 있고 그 값이 verified=false 상태로 id_token에 실린다. 이 realm에서 프로필 email 편집이 잠겨 있지 않다면: 공격자 A가 자기 email을 victim@eland.co.kr로 바꿈 → /auth/login → 정상 발급된(서명 유효한) id_token의 email=victim@eland.co.kr → route.ts L57-61이 victim의 users 행을 찾음 → L110 setUserSessionCookie(victim.id, victim.email)로 victim 세션 쿠키 발급 → L114-121 응답이 victim의 이름·이메일·법인·조직·직급을 그대로 반환. 서버가 '클라이언트가 보낸 값은 절대 신뢰하지 않음'(route.ts L17)이라 선언해 놓고 검증되지 않은 클레임 하나를 신뢰한다.
- **제안 수정**: verifyNoaIdToken에서 `payload.email_verified === true`가 아니면 email 클레임을 버리고 `${username}@eland.co.kr` 폴백만 쓰도록 하거나(권장), 아예 preferred_username을 유일 바인딩 키로 삼는다. 어느 쪽이든 email_verified가 false/부재인 토큰이 기존 계정에 매칭되는 경로를 없앤다.
- **반박단 판정**: 2/3 성립

### 8. 🟠 MAJOR · PII·시크릿·에러 누출

**consumeIdTokenJti가 모든 DB 예외를 삼켜 M014 미적용 시 SSO 전면 실패가 무보고 + 감사로그에 'replay'로 오기록된다**

- **위치**: `lib/noa-sso.ts:134`
- **실패 시나리오**: M014(noa_sso_used_tokens)는 마스터가 POST /api/admin/migrate를 수동 1회 호출해야 생성된다(CLAUDE.md 'DB 마이그레이션'). 마이그레이션을 돌리기 전에 배포가 나가면 L128 INSERT가 `relation "noa_sso_used_tokens" does not exist`로 던지고 L134 `catch { return false }`가 이를 완전히 삼킨다 → route.ts L45 consumed=false → 모든 사용자가 '사내 계정 인증에 실패했습니다.' 401. 이때 (a) reportError가 호출되지 않아 Sentry에 아무 이벤트도 없고, (b) auth_logs에는 detail='sso-token-replay'가 1,800명 로그인 시도 수만큼 쌓여 실제 원인(테이블 부재)을 재생공격으로 오진하게 만든다. 즉 SSO 100% 장애가 '공격 탐지'처럼 보이는 유일한 신호만 남긴다. fail-closed 자체는 옳지만, 침묵 + 오기록이 문제다.
- **제안 수정**: catch 블록에서 `reportError(e, { route: 'noa-sso/consume-jti' })`로 보고하고 실패 사유를 호출부에 구분해 넘긴다(예: `{ ok: false, reason: 'error' | 'replay' }`). route.ts L46은 reason에 따라 detail을 'sso-jti-store-error' / 'sso-token-replay'로 나눠 기록한다(사용자 응답 문구는 §6-8대로 동일 유지). 사용자 대면 메시지는 바꾸지 않는다.
- **반박단 판정**: 2/3 성립

### 9. 🟠 MAJOR · DB·프로비저닝

**consumeIdTokenJti가 모든 DB 오류를 통째로 삼켜, M014 미적용/DB 장애 시 SSO 전면 불통이 '재생 공격'으로 오기록되고 Sentry에는 아무 것도 남지 않는다**

- **위치**: `lib/noa-sso.ts:134`
- **실패 시나리오**: 운영 Neon에 to_regclass('public.noa_sso_used_tokens') 조회 결과 null — 지금 상태로 배포하면 모든 SSO 로그인이 INSERT에서 42P01(relation does not exist)로 실패한다. catch가 이를 삼켜 false를 반환하므로 fail-closed 주장 자체는 맞지만, sso-login/route.ts:46이 이를 detail='sso-token-replay'로 감사로그에 남긴다. 결과: 전 사용자 401 + auth_logs에 '재생 공격' 수백 건 + reportError 미호출로 Sentry 무음. 운영자는 테이블 부재가 아니라 토큰 재사용 공격을 추적하게 된다. DB 순간 장애 때도 동일하게 모든 SSO 로그인이 replay로 기록된다.
- **제안 수정**: catch(e)에서 reportError(e, { route: 'noa-sso.consumeIdTokenJti' })를 호출하고, 반환값을 boolean이 아니라 {ok:false, reason:'conflict'|'error'}로 구분해 라우트가 conflict일 때만 'sso-token-replay'로, error일 때는 'sso-jti-store-unavailable'로 로깅하도록 한다. 배포 전 POST /api/admin/migrate로 M014를 먼저 적용할 것.
- **반박단 판정**: 2/3 성립

### 10. 🟠 MAJOR · UI·모바일 패리티

**SSO 실패 화면의 복구 링크가 next 없는 /login이라 모바일 사용자가 데스크톱 SPA로 떨어진다**

- **위치**: `app/auth/callback/AuthCallbackClient.tsx:126`
- **실패 시나리오**: 모바일(또는 안드로이드 앱)에서 /m → 「사내 계정으로 로그인」 → next='/m'이 sessionStorage에 저장된다. 콜백이 실패하면(토큰교환 5xx, code 누락, 또는 sso-login이 401 — 예: @eland.co.kr 아닌 계정) 에러 화면의 유일한 출구가 <a href="/login">이다. /login은 next 쿼리가 없으므로 nextPath = sanitizeNext(null) = '/'가 되고, 사용자가 MobileWelcome에서 이메일+비밀번호로 로그인하면 handleMobileSuccess → router.replace('/') 로 **데스크톱 SPA(app/page.tsx)**에 착지한다. 미들웨어가 없어 /m으로 되돌려 보내지도 않는다(middleware.ts 부재 확인). 실패 직전까지 유지하던 /m 복귀 경로가 통째로 버려져 모바일 패리티가 깨진다. app/auth/login/AuthLoginClient.tsx:80의 에러 분기도 동일하게 <a href="/login">(next 없음)이다 — 같은 파일의 !configured 분기(67행)는 nextRaw를 제대로 이어붙이고 있어 에러 분기만 누락된 형태다.
- **제안 수정**: 콜백은 성공 시에만 NOA_SSO_RETURN_KEY를 소비하도록 두고(96-102행), 에러 분기에서는 그 값을 읽어 링크를 `/login?next=${encodeURIComponent(sanitizeNext(stored))}`로 만든다(실패 시에는 removeItem 하지 않음). AuthLoginClient.tsx:80의 에러 분기도 67행과 동일하게 nextRaw를 붙인다.
- **반박단 판정**: 2/3 성립

### 11. 🟠 MAJOR · NoA Vibe 가드레일

**디렉터리 조회에 타임아웃이 없어, 브로커가 느려지면 의도한 '-' 폴백이 작동하지 않고 신규 직원 프로비저닝이 통째로 막힌다**

- **위치**: `app/api/users/sso-login/route.ts:73`
- **실패 시나리오**: node_modules/@noa/auth-sdk/dist/server.mjs 의 directoryFetch 는 `fetch(url, { headers })` 로 signal·timeout 없이 호출한다(SDK에 타임아웃 옵션 자체가 없다). 호출부인 이 73행도 아무 것도 감싸지 않는다. 구체적 실패: users 에 없는 신규 직원이 처음 SSO 로그인 → 44행에서 jti가 이미 소진된 뒤 → 73행에서 NOA_AUTH_DIRECTORY_URL 브로커가 TCP는 붙었는데 응답을 안 주면(undici 기본 headersTimeout 300s) 라우트가 반환하지 않는다. Vercel 함수 maxDuration에 먼저 걸려 504가 나고, 80행의 `catch {}` → corporationName '-' 폴백은 **끝내 실행되지 않는다**(hang은 reject가 아니다). 사용자는 콜백 화면에서 GENERIC_ERROR만 보고, 재시도하면 Keycloak 인가코드부터 다시 받아 같은 hang에 다시 걸린다. 즉 '디렉터리가 죽어도 가입은 계속 진행한다'는 코드의 의도가 정확히 그 장애 상황에서 뒤집히고, 파일럿 첫날처럼 신규 프로비저닝이 몰리는 시점에는 매 요청이 함수 타임아웃까지 점유해 동시성까지 갉아먹는다. 기존 사용자(users 에 이미 있는 행)는 63행 분기를 안 타므로 영향이 없어, 장애가 '신규만 로그인 불가'로 나타나 원인 파악도 늦다.
- **제안 수정**: SDK가 타임아웃 훅을 주지 않으므로 호출부에서 경주시킨다: `const dirUser = await Promise.race([directory.getDirectoryUser(identity.username), new Promise<null>((_, rj) => setTimeout(() => rj(new Error('noa-sso: directory timeout')), 2500))]);` — reject가 기존 80행 catch로 떨어지면서 의도대로 '-' 폴백 + 가입 진행이 된다. 겸사겸사 jti 소진(44행)을 도메인 검사(51행) 뒤로 옮기면 비-eland 계정이 테이블 행을 남기지 않는다.
- **반박단 판정**: 3/3 성립

### 12. 🟠 MAJOR · 런타임·빌드

**Capacitor allowNavigation에 auth.noa.eland.com이 없어 안드로이드 앱의 SSO 로그인이 외부 브라우저로 튕기고 PKCE verifier를 잃는다**

- **위치**: `capacitor.config.ts:11`
- **실패 시나리오**: app/m/_components/MobileWelcome.tsx에 「사내 계정으로 로그인」 버튼이 추가돼 모바일에서도 노출된다. capacitor.config.ts의 server.url은 https://retail-ai-campus.vercel.app/m 이고 allowNavigation은 ['retail-ai-campus.vercel.app','*.vercel.app'] 뿐이다. 안드로이드 앱(versionCode 13) 사용자가 버튼을 누르면 WebView가 /auth/login으로 가고 AuthLoginClient가 window.location.assign('https://auth.noa.eland.com/realms/eland/protocol/openid-connect/auth?...')를 호출한다. auth.noa.eland.com은 allowNavigation에 없으므로 Capacitor가 이 내비게이션을 가로채 시스템 브라우저로 내보낸다. PKCE verifier는 SDK가 앱 WebView의 sessionStorage('noa-auth-pkce')에 쓴 값이라 외부 브라우저에는 없다 → 외부 브라우저가 /auth/callback?code=...를 열면 chunk-5HTWYJJP.mjs의 readPkceVerifier()가 null을 반환해 AUTH_PKCE_VERIFIER_MISSING로 실패하고 '로그인 처리 중 문제가 발생했습니다'만 뜬다. 동시에 앱 WebView는 '사내 계정으로 이동하는 중입니다...' 스피너에서 영구히 멈춘다. 게다가 allowNavigation 수정은 APK 재빌드(versionCode 13 → 14)가 있어야 반영되므로, 웹만 배포해서는 이미 설치된 앱을 고칠 수 없다.
- **제안 수정**: capacitor.config.ts allowNavigation에 'auth.noa.eland.com'을 추가하고 versionCode를 올려 APK를 재배포한다. 그 릴리스가 나가기 전까지는 Capacitor 환경(예: window.Capacitor 또는 UA 판별)에서 MobileWelcome의 SSO 버튼을 숨기거나, @capacitor/browser로 시스템 브라우저 대신 앱 내 브라우저를 쓰되 sessionStorage 공유가 안 되므로 콜백을 앱 딥링크로 받는 방식을 택해야 한다. 최소한 이번 배포에서는 모바일 버튼을 내리는 것이 안전하다.
- **반박단 판정**: 3/3 성립

### 13. 🟡 MINOR · 토큰 검증

**typ/azp를 검증하지 않아, 같은 realm의 다른 클라이언트가 발급한 access_token이 id_token으로 통과한다**

- **위치**: `lib/noa-sso.ts:78`
- **실패 시나리오**: clientId가 `noa-sso-<cuid>` 형태인 것에서 보이듯 NoA Vibe는 realm `eland` 하나에 앱마다 클라이언트를 만든다. 다른 앱 클라이언트 X에 우리 clientId를 향한 Audience 매퍼가 걸려 있거나(플랫폼이 앱 간 API 호출을 허용하는 통상적 설정), 사용자가 우리 클라이언트의 client role을 가지면 Keycloak의 audience-resolve 매퍼가 X의 **access_token** aud에 `noa-sso-cmqpw5mm7003vmg01o5xwn0uf`를 넣는다. 그 access_token은 RS256·같은 iss·유효 exp·jti·preferred_username을 모두 갖고 있어 jwtVerify를 그대로 통과하고 앱 세션이 발급된다. 즉 X 앱의 sessionStorage에서 탈취된 access_token(또는 X의 XSS)이 AI 캠퍼스 세션으로 횡전개된다. Keycloak은 typ으로 "ID"와 "Bearer"를 구분해 주는데 이 코드는 그 필드를 읽지 않는다.
- **제안 수정**: jwtVerify 직후 `if (payload.typ !== 'ID') throw ...` 와 `if (payload.azp !== cfg.clientId) throw ...` 두 줄을 추가한다(azp는 OIDC Core 3.1.3.7-4 요구사항이기도 하다).
- **반박단 판정**: 2/3 성립

### 14. 🟡 MINOR · 오픈리다이렉트·CSRF

**SSO 브리지 POST /api/users/sso-login에 교차사이트 요청 차단(Origin/Sec-Fetch-Site 검사)이 없어 로그인 CSRF가 가능하다**

- **위치**: `app/api/users/sso-login/route.ts:29`
- **실패 시나리오**: 공격자(사내 계정 보유자)가 자기 계정의 id_token을 자기 서버에서 방금 발급받아 두고, 피해자가 방문한 evil.com이 <form action="https://retail-ai-campus.vercel.app/api/users/sso-login" method=POST enctype="text/plain">로 최상위 POST를 보낸다(필드명 '{"idToken":"<공격자 토큰>","rememberMe":true,"x":"' / 값 '"}'). 실측: NextRequest.json()은 Content-Type을 보지 않고 이 바디를 그대로 파싱한다(node로 확인 — text/plain 바디가 {"idToken":"abc","rememberMe":true,"x":""}로 파싱됨). 최상위 내비게이션이라 SameSite=lax 응답 쿠키도 정상 저장된다. 라우트에는 origin·sec-fetch-site 검사가 전혀 없고(레포 전체 grep 결과 미들웨어·다른 라우트에도 없음), jti 1회성·iat ±120초 방어는 '공격자가 방금 만든 미사용 토큰'을 전혀 막지 못한다. 결과: 피해자 브라우저에 공격자 계정의 httpOnly 세션이 심긴다(rememberMe:true라 30일). 피해자는 자기 계정인 줄 알고 강의요청·댓글·학습이력을 남기고, 공격자가 나중에 자기 계정으로 들어가 그 내용을 읽는다. 유일한 정상 호출자가 /auth/callback의 동일 오리진 fetch(= Origin 헤더 항상 전송)라 검사 한 줄로 완전히 닫힌다. 참고: 기존 /api/users/login도 같은 형태라 이번 변경의 회귀는 아니지만, 'SDK가 state를 안 쓴다'는 전제 위에서 서버가 유일한 신뢰경계인 이 엔드포인트에는 빠져 있으면 안 되는 방어다.
- **제안 수정**: rl 검사 직후 · req.json() 이전에 동일 오리진 검사를 추가: const origin = req.headers.get('origin'); if (!origin || new URL(origin).host !== req.nextUrl.host) return NextResponse.json({ error: SSO_LOGIN_FAILURE_MESSAGE }, { status: 401 }); (여유가 되면 sec-fetch-site === 'same-origin' 도 병행 확인). 같은 패턴을 /api/users/login에도 적용할지는 별건으로 검토.
- **반박단 판정**: 3/3 성립

### 15. 🟡 MINOR · 오픈리다이렉트·CSRF

**SSO 콜백이 rememberMe:true를 하드코딩해 사용자가 30일 영구 세션을 거부할 방법이 없다**

- **위치**: `app/auth/callback/AuthCallbackClient.tsx:73`
- **실패 시나리오**: 이메일 로그인은 WelcomePopup.tsx:639 / MobileWelcome.tsx:575의 '자동 로그인' 체크박스로 사용자가 해제할 수 있고, 해제하면 lib/session.ts가 maxAge 없는 세션 쿠키(브라우저 종료 시 소멸)를 발급한다. SSO 경로에는 그 선택지가 없어 항상 rememberMe:true → SESSION_TTL_LONG(30일) 영구 쿠키가 발급된다. 실패 시나리오: 매장 공용 PC에서 기존에는 체크를 풀고 쓰던 직원이 「사내 계정으로 로그인」 버튼을 쓰면, 브라우저를 닫아도 user_session 쿠키가 30일 남아 다음 사용자가 그 계정(학습이력·이름·소속 PII)으로 그대로 들어간다. 위 CSRF 건과 겹치면 공격자가 심은 세션의 수명도 세션 쿠키가 아니라 30일이 된다.
- **제안 수정**: /auth/login 진입 시 '자동 로그인' 선택값을 sessionStorage(NOA_SSO_RETURN_KEY 옆)에 함께 저장해 콜백에서 rememberMe로 전달하거나, 최소한 SSO는 rememberMe:false(세션 쿠키)로 보내고 자동 로그인이 필요하면 이메일 로그인과 동일한 체크박스를 /auth/login 화면에 노출한다.
- **반박단 판정**: 2/3 성립

### 16. 🟡 MINOR · DB·프로비저닝

**noa_sso_used_tokens에 정리 로직이 repo 어디에도 없고, 만들어 둔 expires_at 인덱스를 읽는 쿼리가 하나도 없어 쓰기 비용만 남는다**

- **위치**: `app/api/admin/migrate/route.ts:368`
- **실패 시나리오**: 전 repo에서 noa_sso_used_tokens를 참조하는 곳은 INSERT(lib/noa-sso.ts:129)와 DDL뿐이다 — DELETE도, cron도, vercel.json 스케줄도 없다. 로그인 1건당 1행이 영구 누적되므로 대상 1,800명이 하루 2회 로그인하면 연 약 90만 행(PK+expires_at 인덱스 포함 대략 150B/행 → 연 130MB 내외)이 Neon 스토리지에 쌓이고 줄어들지 않는다. 정확성 장애는 없지만 스토리지 한도에 서서히 잠식되고, expires_at 인덱스는 아무 쿼리도 사용하지 않으면서 모든 로그인 INSERT에 갱신 비용만 더한다.
- **제안 수정**: consumeIdTokenJti INSERT 직후 확률적으로(예: Math.random() < 0.01) DELETE FROM noa_sso_used_tokens WHERE expires_at < now() - interval '1 day'를 실행하거나, 관리자/cron 엔드포인트를 하나 추가한다. 둘 중 어느 것도 넣지 않을 거라면 expires_at 인덱스는 소비처가 생길 때까지 만들지 않는 편이 낫다.
- **반박단 판정**: 2/3 성립

### 17. 🟡 MINOR · UI·모바일 패리티

**콜백 effect의 cancelled 플래그와 startedRef 가드가 충돌해 React StrictMode(개발)에서 SSO 콜백이 영구히 멈춘다**

- **위치**: `app/auth/callback/AuthCallbackClient.tsx:76`
- **실패 시나리오**: Next.js 15는 reactStrictMode 기본 true이고 next.config.js가 이를 끄지 않는다. 개발 모드에서 effect가 두 번 호출되면: 1차 실행이 startedRef=true로 설정하고 비동기 체인을 시작 → cleanup이 돌며 1차 클로저의 cancelled=true → 2차 실행은 startedRef 가드에 걸려 즉시 return하므로 새 체인을 만들지 않는다. 결국 살아 있는 유일한 체인(1차)은 fetch가 끝난 뒤 76행 `if (cancelled) return;`에서 조용히 빠져나가, setUserInfo도 router.replace도 상태 변경도 일어나지 않는다. 화면은 '로그인 처리 중입니다...'에 고정되고 authorization code는 이미 소진돼 새로고침해도 AUTH_CALLBACK_CODE_MISSING으로 실패한다. npm run dev로 SSO를 실측하려는 사람에게는 '콜백이 아예 안 된다'로 보인다.
- **제안 수정**: startedRef 가드가 이미 중복 실행을 막고 있으므로 cleanup의 cancelled 플래그를 제거하거나(가드와 역할이 중복), cancelled를 effect 지역 변수가 아닌 useRef로 올려 2차 실행이 다시 false로 되돌리도록 한다. 전자가 간단하다 — `let cancelled`, `if (cancelled) return;`, cleanup의 `cancelled = true`를 모두 지운다.
- **반박단 판정**: 3/3 성립

### 18. 🟡 MINOR · NoA Vibe 가드레일

**AuthCallbackClient의 startedRef 가드가 StrictMode 정리 함수와 맞물려, 세션 쿠키는 발급됐는데 콜백 화면이 영원히 '로그인 처리 중'에 멈춘다 (dev 전용)**

- **위치**: `app/auth/callback/AuthCallbackClient.tsx:76`
- **실패 시나리오**: next.config.js 에 reactStrictMode 가 없고, next 15.5.18 의 define-env.js:127 이 `reactStrictMode === null ? true` 로 __NEXT_STRICT_MODE_APP 을 켜므로 App Router 트리는 StrictMode로 감싸진다. dev에서 이펙트는 setup→cleanup→setup 으로 두 번 돈다. 1회차: startedRef=true, cancelled(클로저A)=false, async 시작. 곧바로 cleanup A 실행 → cancelled(클로저A)=true. 2회차: 51행 `if (startedRef.current) return;` 로 조기 반환(새 cancelled도, 새 cleanup도 만들지 않음). 결과적으로 1회차 async는 계속 진행해 handleCallback()으로 코드를 교환하고 POST /api/users/sso-login 까지 성공시켜 **서버는 httpOnly 세션 쿠키를 실제로 심는데**, 76행 `if (cancelled) return;` 에서 그대로 빠져나가 setUserInfo도 router.replace도 실행되지 않는다. 화면은 status='loading' 그대로 '로그인 처리 중입니다...' 에 무한 정지한다. 프로덕션 빌드에서는 StrictMode 이펙트 이중 호출이 없으므로 재현되지 않지만, npm run dev 로 SSO 플로우를 실전 검증할 때 100% 재현돼 '콜백이 안 돌아온다'로 오진하기 쉽다.
- **제안 수정**: cancelled 플래그를 클로저 지역변수 대신 startedRef와 같은 수명의 ref로 올리거나(예: `const cancelledRef = useRef(false)`), 애초에 코드 1회 소진 가드를 startedRef가 이미 해주고 있으므로 cleanup의 `cancelled = true` 와 76행 조기 반환을 제거한다. 후자가 간단하고, 언마운트 후 setState 경고는 React 18에서 더 이상 발생하지 않는다.
- **반박단 판정**: 2/3 성립

## 3. 기각된 지적 (반박 성립 — 기록용)

- token: email_verified를 검증하지 않고 sub 바인딩도 없어, IdP가 보증하지 않은 email 클레임만으로 기존 계정에 붙는다
- token: consumeIdTokenJti가 저장소 오류와 실제 재생을 구분하지 않아, M014 미적용 시 전체 SSO 장애가 'replay' 공격으로 기록된다
- session: SSO 자동 프로비저닝 계정은 비밀번호를 아무도 모르므로 회원 탈퇴·비밀번호 변경이 영구 차단된다
- session: SSO 도메인 게이트가 공용 isAllowedSignupEmail 대신 endsWith를 쓰고, email 클레임 부재 시 username을 검증 없이 이어 붙여 잘못된 이메일로 계정이 생성된다
- session: SSO 로그인은 rememberMe를 항상 true로 보내 자동로그인 해제 선택을 무시하고 30일 영구 쿠키를 남긴다
- db: SSO로 자동 생성된 계정은 랜덤 bcrypt 해시 때문에 회원 탈퇴(DELETE /api/users/me)를 영구히 수행할 수 없다
- db: 프로비저닝 INSERT가 Keycloak·디렉터리 문자열을 U+FFFD 검사·trim 없이 그대로 저장한다 — 이 repo의 다른 모든 사용자 텍스트 쓰기 경로에는 있는 가드가 빠졌다
- db: jti를 사용자 프로비저닝·세션 발급보다 먼저 소비해, 이후 단계가 실패하면 id_token이 영구 소진되고 재시도가 replay로 거부된다
- db: 노후 계정을 삭제해도 다음 SSO 로그인에서 조용히 재생성된다 — JIT 프로비저닝에 차단 목록이 없다
- ui: /auth/login이 마운트 즉시 무조건 Keycloak으로 재이동해, 뒤로가기가 무한 루프가 된다(앱에는 다른 탈출구가 없다)
- guardrail: verifyNoaIdToken이 azp·typ를 검증하지 않아, aud에 우리 clientId가 들어간 access token이나 형제 클라이언트의 id_token도 앱 세션으로 교환된다
- runtime: 디렉터리 조회 fetch에 타임아웃이 없어 NoA 디렉터리가 응답하지 않으면 신규 사용자 첫 SSO 로그인이 함수 타임아웃까지 매달린다
- runtime: Sentry 스크러버가 token= 만 마스킹해 /auth/callback?code=<authorization code> 가 그대로 Sentry로 전송된다
- runtime: M014 마이그레이션을 수동 실행하기 전까지 fail-closed 때문에 모든 SSO 로그인이 401이고, 감사로그에는 원인과 다른 sso-token-replay가 남는다
