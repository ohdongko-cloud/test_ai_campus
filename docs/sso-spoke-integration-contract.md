# SSO 스포크 통합 계약 — 핸드오프 문서

- 작성일: 2026-06-20
- 작성자: Claude (요청자: <오너>)
- 대상: web/fashion, measure-web, OPR 등 **스포크 레포 작업자**
- 허브: AI캠퍼스 (`https://retail-ai-campus.vercel.app`)
- 근거 스펙: `AI캠퍼스_SSO허브_세팅_PRD.md` §6 (v1.1, 2026-06-20)
- 관련 내부 PRD: `docs/prd/2026-06-20-sso-hub.md`

> 이 문서는 **스포크 레포 작업자가 SSO 콜백을 구현하기 위한 단일 소스**다. 허브 내부 구현 상세는 위 내부 PRD를 참조한다.

---

## 1. 흐름 요약

```
[사용자] → [스포크 보호 페이지] (세션 없음)
  → 스포크: state/nonce/returnTo 생성·저장
  → 302 https://retail-ai-campus.vercel.app/sso/authorize
         ?app=<your-app>
         &redirect_uri=https://<your-domain>/sso/callback
         &state=<csrf-token>
         &nonce=<nonce>

[허브 /sso/authorize]
  → 레지스트리에서 app·redirect_uri 정확매칭 검증
  → 허브 세션 없으면: /login?next=... → 사용자 로그인 → 복귀
  → id_token 발급 (RS256, sub=email, aud=your-app, exp=iat+60)
  → 302 https://<your-domain>/sso/callback?token=<id_token>&state=<csrf-token>

[스포크 GET /sso/callback?token=&state=]
  → state CSRF 검증
  → JWKS RS256 서명 검증 (iss / aud / exp)
  → nonce 1회성 검증
  → email provision/lookup + @eland.co.kr 재검증
  → 자기 세션 쿠키 발급
  → 302 returnTo
```

---

## 2. 허브 엔드포인트

| 엔드포인트 | 설명 |
|---|---|
| `GET /sso/authorize` | SSO 인증 시작점. 스포크가 사용자를 이 URL로 보냄. **쿼리 파라미터 요건·거부 응답은 §2.2**(`nonce` 형식 포함). |
| `GET /.well-known/jwks.json` | RS256 공개키 배포. 스포크가 토큰 검증에 사용. |
| `GET /sso/userinfo` | Bearer id_token으로 추가 프로필 조회(선택, **콜백 트랜잭션 내 동기 1회만 — 재시도 금지**, 60초 내 호출 필요. 상세 §2.1). |
| `GET /sso/logout` | 허브 세션만 종료. 스포크 세션은 미변경. |

### 2.1 `/sso/userinfo` 단일 사용 규약 (MUST)

- 스포크가 `/sso/userinfo`를 호출하기로 한 경우, **콜백 처리 트랜잭션 안에서 동기적으로 정확히 1회만** 호출해야 한다(MUST).
- **재시도 금지(MUST NOT)**: 백오프 재시도·병렬 중복 호출(SSR+CSR 이중 fetch 등)·이후 재호출을 모두 금지한다. 허브의 nonce는 이 호출 시점에 원자적 UPDATE 1문으로 소비되므로, 1회차가 이미 성공했더라도 2회차는 반드시 실패한다. **네트워크 예외(타임아웃·커넥션 리셋 등 응답 자체를 받지 못한 경우)도 동일한 실패로 취급하며, 이 호출에는 HTTP 클라이언트의 자동 재시도 옵션(예: undici `RetryAgent`, `axios-retry`, fetch 재시도 래퍼)을 반드시 비활성화한다(MUST)** — 재시도 래퍼 없는 네이티브 단발 호출이면 이 요건을 만족한다.
- `/sso/userinfo`는 **email 외 프로필 보강(name·corporation_name·organization_name·position)에만** 쓰인다. `sub` 클레임(email)은 이미 RS256 서명·`iss`·`aud`·`exp` 검증(§3.1 2단계)을 통과했고 역할/권한 정보는 userinfo도 제공하지 않으므로(N2, `lib/sso.ts:37` — 인가는 스포크 책임), userinfo 성공 여부는 세션 발급 가능 여부에 영향을 주지 않는다.
- **호출 실패 시 기본 처리(MUST)**: 아래 §2.1.1 응답 코드표의 어느 코드로 실패하든(네트워크 예외 포함) **재시도하지 말고, `/sso/authorize`나 `/sso/login`으로 자동 재진입시키지 않는다(MUST NOT)**. 허브 세션이 살아 있으면 사용자 상호작용 없이 즉시 새 토큰이 발급되어(`app/sso/authorize/route.ts` 세션 확인 분기 — `const user = await getCurrentUser()` 이후) 콜백→userinfo 실패→재진입이 무한 루프가 되기 때문이다. 대신 이미 검증된 id_token 클레임(email)만으로 콜백을 계속 진행해 세션을 발급하고, 프로필 필드는 비워두거나(또는 이전 로그인 값 유지) 다음 로그인 시 보강한다. 이 경로는 자동 리다이렉트를 전혀 발생시키지 않으므로 루프가 구조적으로 불가능하다.
- **예외 처리(프로필 필드가 세션 발급의 필수 전제조건인 스포크만, 선택)**: 기본 처리 대신 실패를 치명적으로 다루려면, 자동 재진입이 아니라 **스포크 자체 로그인/에러 페이지로 302 이동**시킨다(예: `/login?sso_error=userinfo_failed`). 그 페이지에서는 **사용자가 직접 "다시 로그인" 버튼을 눌러야** SSO가 재개되어야 하며, 페이지 로드만으로 `/sso/authorize`·`/sso/login`으로 다시 나가는 자동 리다이렉트를 두어서는 안 된다(MUST NOT) — 그 순간 같은 무한 루프가 된다.
- 실패 원인(토큰 만료·nonce 재사용·미등록 클라이언트 등)은 다수가 동일한 `401 { "error": "unauthorized" }`으로 응답되어 문자열만으로 구분할 수 없다 — 원인 조사를 시도하지 말고 위 기본/예외 처리로 일원화한다.
- 응답 값(email·name·corporation_name·organization_name·position)은 그 트랜잭션 안에서 **즉시 소비**(provisioning·세션 발급)하고, 토큰·응답 원문을 저장·로깅해서는 안 된다(MUST NOT). 응답에는 `Cache-Control: no-store`가 붙는다 — 스포크 측에서도 캐싱 금지.

**2.1.1 `/sso/userinfo` 응답 코드표(실측, `app/sso/userinfo/route.ts` 기준)**

| 코드 | 실제 발생 조건(코드 근거) | 스포크의 올바른 대응 |
|---|---|---|
| `200` | 정상 — Bearer 검증·nonce 소비·`users` 조회 모두 성공(`:99-108`) | 프로필 필드로 세션 보강 |
| `401 unauthorized` | Authorization 헤더 누락(`:31-35`) · `sub`/`nonce` 클레임 타입 이상(`:59-64`) · `aud`가 미등록/비활성 클라이언트(`:65-69`) · RS256 서명/`iss`/`exp` 불일치 또는 검증 중 예외(`:54-58,72-74`) · nonce가 이미 소비/만료/미존재(`:87-89` — `authorize`의 `storeNonce` 실패가 삼켜진 경우 최초 호출부터 결정적 — `app/sso/authorize/route.ts`의 `await storeNonce(nonce, app)` catch 분기) | 재시도·자동 재진입 금지. id_token 클레임만으로 세션 발급(기본) 또는 예외 처리 |
| `404 not found` | 토큰은 유효하나 허브 `users` 테이블에 해당 email 행 없음(`:96-98`) — 예: 허브 세션(최대 30일) 생존 중 계정 삭제 | 동일 — 스포크 자체 provisioning은 스포크 자기 DB 기준이라 영향 없음 |
| `429` | IP당 10회/분 레이트리밋 초과(`:25-26`) | 동일 — 같은 창 안에서 재시도 금지 |
| `500 서버 오류가 발생했습니다` | 레이트리밋 백엔드 오류(`:23-29`) · `SSO_PUBLIC_KEY` 미설정/형식오류(`:40-47`, 해결 전까지 전건 결정적) · nonce 소비 DB 오류(`:81-86`) · 프로필 조회 DB 오류(`:91-111`) | 동일 |
| (무응답) 타임아웃/커넥션 리셋 | 네트워크 계층 예외 — 상태코드 자체를 못 받음 | 동일 취급 + 클라이언트 자동 재시도 비활성화(위 MUST) |

> 결론: 코드별 원인은 서로 다르지만 스포크의 대응은 하나다 — **"모든 실패=401"이 아니라 "모든 코드=동일 대응(재시도·자동 재진입 금지)"**이 본 절의 요지다.

### 2.2 `GET /sso/authorize` 쿼리 파라미터 요건 (허브 강제, `app/sso/authorize/route.ts` 기준)

| 파라미터 | 필수 | 요건 | 위반 시 허브 응답 |
|---|---|---|---|
| `app` | ✅ | 허브 `sso_clients`에 등록·활성(`enabled=true`)인 식별자 | `400 {"error":"unknown app"}` — **리다이렉트 없음** |
| `redirect_uri` | ✅ | 등록된 콜백 URL과 **정확매칭** | `400 {"error":"redirect_uri not allowed"}` — **리다이렉트 없음** |
| `state` | ✅ | 스포크가 생성한 CSRF 토큰. 허브는 불투명하게 echo | `400 {"error":"state required"}` — **리다이렉트 없음** |
| `nonce` | 선택 | **`[A-Za-z0-9._~-]`(RFC 3986 unreserved) 16~128자.** 주면 토큰 `nonce` 클레임으로 **그대로** echo, 생략하면 허브가 생성 | `400 {"error":"nonce format invalid"}` — **리다이렉트 없음** |
| `prompt` | 선택 | `none`이면 허브 세션이 없을 때 로그인 UI 대신 `redirect_uri?error=login_required&state=…`로 302 | — |
| `kit` | 선택 | 킷 버전 텔레메트리. `[\w.-]{1,32}` 범위를 벗어나면 조용히 무시(요청 자체는 정상 처리) | — |

**`nonce` 형식 요건이 있는 이유와 스포크 영향**

- 허브는 받은 `nonce`를 `sso_nonces` 테이블의 **기본키(TEXT)** 에 그대로 저장한다. 길이·문자 제한이 없으면 정상 로그인 계정 하나로도 대용량 행을 반복 적재할 수 있어(허브 DB는 로그인·가입 OTP·재설정과 같은 인스턴스를 공유) 저장소 소진 경로가 된다.
- 위반 값은 **거부(400)** 한다. 허브가 값을 조용히 다른 값으로 바꿔 발급하지 않는다(MUST NOT) — 치환하면 스포크의 "토큰 `nonce` ↔ 저장한 `nonce`" 대조(§3.1 3단계)가 항상 실패해 정상 로그인이 전부 깨지기 때문이다.
- 흔한 생성기는 그대로 요건을 만족한다: `crypto.randomUUID()`(36자, hex+`-`) · `randomBytes(24|32).toString('base64url')`(32|43자) · hex 32자. **직접 만든 생성기만 확인이 필요**하다 — 16자 미만(예: hex 8자)·128자 초과·URL 인코딩이 필요한 문자를 포함한 값은 거부된다.
- ⚠️ **표준 base64(`'base64'`)는 쓰지 말 것** — 출력에 `+`·`/`·`=`가 섞이는지가 난수에 따라 달라져 **간헐적으로만** 400이 나는(재현이 어려운) 실패가 된다. 반드시 `'base64url'`을 쓴다.
- 거부는 `state` 누락과 동일하게 허브 `sso_events`에 거부 이벤트로 남는다(`detail=nonce_invalid`, IP당 기록 상한 적용).

---

## 3. 스포크가 구현할 것: `GET /sso/callback?token=&state=`

### 3.1 구현 단계

**1단계 — state CSRF 검증**

콜백 진입 전 스포크가 `/sso/authorize`로 보내기 직전 저장한 `state` 값과 쿼리의 `state`가 일치하는지 확인한다. 불일치 시 즉시 거부(403 또는 에러 페이지). 저장 방법은 스포크 자유(세션 쿠키, 서버 측 스토어 등).

**2단계 — id_token RS256 서명 검증**

```ts
import { jwtVerify, createRemoteJWKSet } from 'jose';

const JWKS_URL = 'https://retail-ai-campus.vercel.app/.well-known/jwks.json';
const ISSUER   = 'https://retail-ai-campus.vercel.app';
const AUDIENCE = '<your-app-id>';  // 아래 표의 app 값

const JWKS = createRemoteJWKSet(new URL(JWKS_URL));

const { payload } = await jwtVerify(token, JWKS, {
  issuer:     ISSUER,
  audience:   AUDIENCE,
  algorithms: ['RS256'],   // alg confusion 방지: 반드시 명시
});
```

- `createRemoteJWKSet`은 JWKS를 캐싱·쿨다운 처리하므로 매 요청마다 HTTP 호출하지 않는다.
- `algorithms: ['RS256']` 명시 필수 — `none`·HS256 혼입 거부.
- `exp` 검증은 `jose`가 자동 처리(TTL 60초).
- `iss`·`aud` 미일치 시 자동 예외 발생.

**3단계 — nonce 1회성 검증**

`payload.nonce` 값을 자기 스토어(세션 쿠키·DB·Redis 등)에서 조회. 이미 소비된 nonce면 거부. 소비 표시 후 다음 단계로. (허브가 90초 만료로 DB에 기록하지만, 스포크도 자기 쪽에서 재수신 거부로 이중 방어.)

**4단계 — email 추출 + @eland.co.kr 재검증**

```ts
const email = String(payload.sub).toLowerCase();

if (!email.endsWith('@eland.co.kr')) {
  // 스포크 자기 allowlist 적용. 거부 시 에러.
  throw new Error('unauthorized domain');
}
```

**5단계 — provision / lookup**

```ts
// 스포크 자기 DB에서 email로 조회
let user = await db.users.findByEmail(email);

if (!user) {
  // 자동 생성(provision). 기본 역할 = viewer(읽기전용).
  user = await db.users.create({ email, role: 'viewer' });
}
// 역할은 자기 DB에서 조회. 허브 토큰에는 역할 없음.
```

**6단계 — 자기 세션 쿠키 발급**

아래 표의 "스포크별 어댑팅" 참조. 기존 자체 로그인 시 발급하는 세션 쿠키 발급 함수를 그대로 재사용한다.

**7단계 — returnTo 리다이렉트**

SSO 시작 전 저장한 `returnTo`(원래 목적지)로 302. 없으면 스포크 홈.

### 3.2 전체 의사코드 (measure-web 예)

```ts
// GET /sso/callback?token=&state=
export async function GET(req: NextRequest) {
  const url    = new URL(req.url);
  const token  = url.searchParams.get('token') ?? '';
  const state  = url.searchParams.get('state') ?? '';

  // 1. CSRF
  const savedState = getFromSession('sso_state');
  if (!savedState || savedState !== state) return error(403, 'state mismatch');

  // 2. 서명 검증
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: 'https://retail-ai-campus.vercel.app',
    audience: 'measure-web',
    algorithms: ['RS256'],
  });

  // 3. nonce 1회성
  const nonce = String(payload.nonce);
  if (await isNonceConsumed(nonce)) return error(403, 'nonce reuse');
  await consumeNonce(nonce);

  // 4. email + 도메인 검증
  const email = String(payload.sub).toLowerCase();
  if (!email.endsWith('@eland.co.kr')) return error(403, 'domain');

  // 5. provision/lookup
  let user = await findUserByEmail(email);
  if (!user) user = await createUser({ email, role: 'viewer' });

  // 6. 세션 쿠키 발급 (기존 로그인과 동일 함수)
  const res = NextResponse.redirect(getSavedReturnTo() ?? '/');
  await setMeasureSession(res, { userId: user.id, email, role: user.role });
  return res;
}
```

---

## 4. 스포크별 어댑팅 표

| 스포크 | app 식별자 | 콜백 URL 등록 형태 | 발급 쿠키명 | 세션 시크릿 env | 세션 클레임 | provision 정책 | 특이 사항 |
|---|---|---|---|---|---|---|---|
| **web/fashion** | `web-fashion` | `https://eland-apparel.vercel.app/sso/callback` | `cu_session` | `JWT_SECRET` | `{ uid, email, role }` | email lookup; 없으면 자동 생성·기본 역할 viewer | `uid`는 자기 DB users.id; role은 자기 DB에서 조회해 클레임에 포함 |
| **measure-web** | `measure-web` | `https://<measure>.vercel.app/sso/callback` | `measure_session` | `SESSION_SECRET` | `{ userId, email, role }` | 동일 | 클레임 키가 `userId`(허브 sub=email, 자기 user id는 자기 DB 값) |
| **OPR** | `opr` | `https://<opr>.vercel.app/sso/callback` | `opr_sess` | `SESSION_SECRET` | `{ email }` only | email만으로 세션 | 역할 개념 없음 — email만 담으면 됨 |

> measure-web·OPR 운영 URL은 배포 후 확정 시 <오너>가 허브 `sso_clients` 테이블에 등록. 등록 전까지 SSO 동작 불가.

---

## 5. SSO 버튼 시작 URL 예시

스포크 로그인 페이지에 "AI캠퍼스로 로그인" 버튼을 추가하고, 클릭 시 아래 흐름으로 진행한다.

```ts
// 스포크 서버 측에서 생성
const state    = crypto.randomUUID();              // CSRF 토큰
const nonce    = crypto.randomUUID();              // replay 방지 (§2.2 형식 요건 충족 — 36자 hex+'-')
const returnTo = req.headers.get('referer') ?? '/';

// state, nonce, returnTo를 스포크 세션 or 쿠키에 저장 (httpOnly 권장)
saveToSession({ sso_state: state, sso_nonce: nonce, sso_return_to: returnTo });

const authorizeUrl = new URL('https://retail-ai-campus.vercel.app/sso/authorize');
authorizeUrl.searchParams.set('app',          'measure-web');   // 자기 app 식별자
authorizeUrl.searchParams.set('redirect_uri', 'https://<measure>.vercel.app/sso/callback');
authorizeUrl.searchParams.set('state',        state);
authorizeUrl.searchParams.set('nonce',        nonce);

return Response.redirect(authorizeUrl.toString(), 302);
```

미들웨어에서 "세션 없으면 위 URL로 자동 리다이렉트"를 추가하면 완전한 SSO 체감이 가능하다(선택).

---

## 6. 토큰 클레임 레퍼런스

| 클레임 | 값 | 설명 |
|---|---|---|
| `iss` | `https://retail-ai-campus.vercel.app` | 발급자. `jwtVerify issuer` 옵션으로 검증 필수. |
| `sub` | 사용자 email (lowercase) | 공통 식별자. `email`로 사용. |
| `aud` | 스포크 app 식별자 | `jwtVerify audience` 옵션으로 자기 app과 일치 검증 필수. |
| `nonce` | 1회성 난수 | replay 방지. 소비 후 재수신 시 거부. |
| `iat` | 발급 시각(Unix 초) | |
| `exp` | `iat + 60` | **TTL 60초.** `jose`가 자동 검증. |

> 역할(`role`)·권한(`permissions`) 클레임은 없다. 스포크가 자기 DB에서 재조회한다.

---

## 7. 검증 체크리스트 (스포크 구현 완료 기준)

- [ ] `algorithms: ['RS256']` 명시 — alg confusion 방지
- [ ] `issuer: 'https://retail-ai-campus.vercel.app'` 검증
- [ ] `audience: '<your-app>'` 검증 (자기 app 식별자와 일치)
- [ ] `state` CSRF 검증 (저장 값과 콜백 값 일치)
- [ ] `nonce` 1회성 소비 (재수신 거부)
- [ ] `nonce` 형식 요건 준수 (§2.2 — `[A-Za-z0-9._~-]` 16~128자. 위반 시 허브가 400으로 거부하므로 SSO 시작 자체가 불가)
- [ ] (선택) `/sso/userinfo` 호출 시 콜백 트랜잭션 내 동기 1회만 — 재시도·캐싱 금지, 네트워크 예외 포함 실패 시 `/sso/authorize`·`/sso/login` 자동 재진입 금지(MUST NOT) 후 id_token 클레임만으로 세션 발급(§2.1) — 프로필 필수 스포크만 예외로 사용자 클릭형 에러 페이지
- [ ] `email.endsWith('@eland.co.kr')` 재검증
- [ ] provision 시 기본 역할 `viewer`(읽기전용)
- [ ] 세션 쿠키 httpOnly 발급 (자기 시크릿으로)
- [ ] 기존 자체 로그인(이메일+비번) 동시 동작 확인 (하이브리드)
- [ ] `sso_clients` 등록 확인 (허브 측 — <오너>에게 요청)

---

## 8. 질문 / 이슈 창구

- 허브 `sso_clients` 등록 요청(운영 URL 확정 후) → <오너>에게 전달.
- SSO 발급/거부 이벤트(`issue`·`deny_*`·`rate_limited`·`logout`) → 허브 **`sso_events` 테이블**(관리자 'SSO 현황' 탭)에서 확인. `auth_logs`에는 `app` 컬럼이 없어 앱별 조회가 불가능하므로 SSO 이벤트는 그쪽에 남지 않는다.
- **`/sso/userinfo` 실패는 허브 측에 전혀 기록되지 않는다** — `app/sso/userinfo/route.ts`는 `logSsoEvent`·에러 리포터를 호출하지 않고 모든 예외를 자체 `catch`에서 응답으로 변환한다(Sentry `onRequestError` 미도달). 단서는 **Vercel HTTP 액세스 로그의 상태코드(401/404/429/500)와 스포크 자체 로그뿐**이다.
- 토큰 서명·JWKS 이슈 → 토큰 헤더의 `kid`가 `GET /.well-known/jwks.json`의 `kid`와 일치하는지 먼저 확인(키 회전 시 스포크 JWKS 캐시 전파에 최대 10분).
- 이 계약 문서 갱신 → `docs/sso-spoke-integration-contract.md` (허브 레포).
