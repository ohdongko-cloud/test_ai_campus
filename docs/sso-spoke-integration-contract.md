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
| `GET /sso/authorize` | SSO 인증 시작점. 스포크가 사용자를 이 URL로 보냄. |
| `GET /.well-known/jwks.json` | RS256 공개키 배포. 스포크가 토큰 검증에 사용. |
| `GET /sso/userinfo` | Bearer id_token으로 추가 프로필 조회(선택, 60초 내 호출 필요). |
| `GET /sso/logout` | 허브 세션만 종료. 스포크 세션은 미변경. |

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
const nonce    = crypto.randomUUID();              // replay 방지
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
- [ ] `email.endsWith('@eland.co.kr')` 재검증
- [ ] provision 시 기본 역할 `viewer`(읽기전용)
- [ ] 세션 쿠키 httpOnly 발급 (자기 시크릿으로)
- [ ] 기존 자체 로그인(이메일+비번) 동시 동작 확인 (하이브리드)
- [ ] `sso_clients` 등록 확인 (허브 측 — <오너>에게 요청)

---

## 8. 질문 / 이슈 창구

- 허브 `sso_clients` 등록 요청(운영 URL 확정 후) → <오너>에게 전달.
- 토큰 검증 오류·JWKS 이슈 → 허브 Sentry + `auth_logs` 테이블 확인.
- 이 계약 문서 갱신 → `docs/sso-spoke-integration-contract.md` (허브 레포).
