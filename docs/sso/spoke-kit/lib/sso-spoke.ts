// === ELAND SSO SPOKE KIT v2.0.0 (contract v2) — DO NOT EDIT ===
// 원본: retail_ai_campus repo docs/sso/spoke-kit/ — 수정은 허브 레포에서만. 스포크는 복사만.
// 유일한 수정 허용: import 경로 별칭(@/*)이 없는 레포의 import 줄.
// 앱별 커스터마이징은 lib/sso-adapter.ts 에서만.
//
// ─────────────────────────────────────────────────────────────────────────────
// 킷 코어 — app/sso/login·app/sso/callback·app/api/sso/stats 세 라우트가 여기서만 import한다.
// 보안 결정(쿠키 속성·검증 옵션·새니타이즈)이 이 파일 한 곳에만 존재하도록 설계됐다.
//
// 전제
//  - Node 런타임(`export const runtime = 'nodejs'`) — node:crypto·RS256 PEM 처리 때문에 Edge 불가.
//  - 신규 의존성은 `jose` 1개뿐. next/server는 타입으로만 참조한다(런타임 결합 없음).
//  - 규범(normative)은 계약 문서(docs/sso-spoke-integration-contract.md). 이 킷은 참조 구현이며
//    충돌 시 계약이 이긴다.
//
// 허브 실제 동작(코드 확인 완료 — 아래 file:line은 허브 레포 retail_ai_campus 기준)
//  - id_token: RS256 · TTL 60초 · 클레임 { iss, sub(=email lowercase), aud, nonce, email(=sub 중복), iat, exp }
//    (lib/sso.ts:10, :39-56 — 특히 :48 `new SignJWT({ email: sub, nonce })`)
//  - JWKS: GET /.well-known/jwks.json, `Cache-Control: public, max-age=600`
//    (app/.well-known/jwks.json/route.ts:8-13)
//  - authorize 검증 순서: 레이트리밋(60/분/IP) → app·redirect_uri 정확매칭(400) → state 필수(400)
//    → nonce 형식(400) → 허브 세션 → 발급 → redirect_uri로 302 (app/sso/authorize/route.ts:58-180)
//  - nonce 형식: /^[A-Za-z0-9._~-]{16,128}$/ 위반 시 400 (app/sso/authorize/route.ts:32, :113-118)
//  - redirect_uri: 스킴·host 소문자화 + 쿼리/프래그먼트 제거 + trailing slash 제거 후 정확매칭
//    (lib/sso-clients.ts:30-45, :127-131)
//  - /sso/logout: app + post_logout_redirect_uri 가 둘 다 있고 화이트리스트 정확매칭일 때만 그 URL로 302,
//    아니면 조용히 허브 홈('/')으로 (app/sso/logout/route.ts:39-49)
// ─────────────────────────────────────────────────────────────────────────────

import { jwtVerify, createRemoteJWKSet, type JWTPayload } from 'jose';
import { randomBytes, timingSafeEqual } from 'crypto';
import type { NextRequest, NextResponse } from 'next/server';

/* ═══════════════════════════════════════════════════════════════════════════
 * 0. 버전
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * 킷 버전. app/sso/login/route.ts가 authorize 쿼리 `kit=`에 실어 보내는 텔레메트리 값.
 * 허브는 /^[\w.-]{1,32}$/ 를 통과한 값만 sso_events.detail에 남긴다(app/sso/authorize/route.ts:69)
 * — 이 상수는 항상 그 범위 안이어야 한다.
 */
export const SSO_KIT_VERSION = '2.0.0';

/**
 * 계약(프로토콜) 버전. 현재 어떤 와이어 파라미터로도 전송되지 않는다(허브가 관측하는 것은 `kit=`뿐).
 * README·로그 표기 및 스포크 자체 진단용 상수.
 */
export const SSO_CONTRACT_VERSION = '2';

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. 설정(env)
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface SsoSpokeConfig {
  /** 허브 오리진(네트워크 주소). JWKS·authorize·logout URL의 베이스. */
  hubUrl: string;
  /** iss 기대값(논리적 발급자 식별자). 기본 = hubUrl. 허브 SSO_ISSUER와 **바이트 일치**해야 한다. */
  issuer: string;
  /** 자기 app 식별자 = id_token의 aud. 허브 sso_clients.app과 바이트 일치. */
  appId: string;
  /** 자기 canonical 오리진. redirect_uri = `${selfUrl}/sso/callback`. */
  selfUrl: string;
  /** provision 허용 이메일 도메인(소문자, '@' 없이). 기본 ['eland.co.kr']. */
  allowedEmailDomains: string[];
  /** 콜백 실패 시 302 대상 경로(계약 §2.3 실패 UX). 기본 '/login'. */
  errorPath: string;
}

const DEFAULT_HUB_URL = 'https://retail-ai-campus.vercel.app';
const DEFAULT_ALLOWED_DOMAINS = ['eland.co.kr'];
const DEFAULT_ERROR_PATH = '/login';

let cachedConfig: SsoSpokeConfig | null = null;

/**
 * env 6종을 1회 파싱해 캐시한다(성공한 설정만 캐시 — 실패는 매번 다시 throw).
 *
 * fail-fast: `SSO_APP_ID`·`SSO_SELF_URL`이 없으면 즉시 throw한다. 이 둘이 비면 허브가
 * "unknown app"/"redirect_uri not allowed" 400을 돌려주는데, 그 400은 리다이렉트 없이
 * 허브 도메인에서 끝나므로(app/sso/authorize/route.ts:96-104) 스포크 쪽에 아무 단서가 남지 않는다.
 * 배포 시점에 터뜨리는 편이 진단 비용이 훨씬 싸다.
 */
export function getSsoConfig(): SsoSpokeConfig {
  if (cachedConfig) return cachedConfig;

  const appId = (process.env.SSO_APP_ID ?? '').trim();
  if (!appId) {
    throw new Error('SSO_APP_ID 환경변수가 설정되지 않았습니다.');
  }

  const rawSelfUrl = (process.env.SSO_SELF_URL ?? '').trim();
  if (!rawSelfUrl) {
    throw new Error('SSO_SELF_URL 환경변수가 설정되지 않았습니다.');
  }
  // ★ trailing slash 제거는 selfUrl에만 필요하다(hubUrl과 대칭적으로 다루면 안 된다).
  //   redirect_uri는 `${selfUrl}/sso/callback` **문자열 결합**으로 만들기 때문에, 슬래시가 남으면
  //   '.../ /sso/callback' → '//sso/callback'(이중 슬래시)이 되고 허브 normalizeRedirect는
  //   trailing slash만 정리할 뿐 내부 이중 슬래시는 그대로 두므로(lib/sso-clients.ts:41-44)
  //   등록값과 정확매칭에 실패해 **항상 400**이 된다.
  //   반면 hubUrl은 아래에서 전부 `new URL(path, hubUrl)` 상대 해석으로만 쓰므로 이 방어가 불필요하다.
  const selfUrl = rawSelfUrl.replace(/\/+$/, '');

  const hubUrl = (process.env.SSO_HUB_URL ?? '').trim() || DEFAULT_HUB_URL;
  const issuer = (process.env.SSO_HUB_ISSUER ?? '').trim() || hubUrl;

  // 콤마 구분 → trim → 소문자 → 선행 '@' 제거('@eland.co.kr'로 적어도 동작) → 빈값 제거.
  const domains = (process.env.SSO_ALLOWED_EMAIL_DOMAINS ?? '')
    .split(',')
    .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
    .filter((d) => d.length > 0);
  const allowedEmailDomains = domains.length > 0 ? domains : [...DEFAULT_ALLOWED_DOMAINS];

  // errorPath는 콜백이 302 Location으로 그대로 쓰는 값이다. env 오타로 절대 URL이 들어오면
  // 스포크 자신이 오픈리다이렉터가 되므로, 동일 오리진 '/'-prefix 경로가 아니면 기본값으로 되돌린다.
  const rawErrorPath = (process.env.SSO_ERROR_PATH ?? '').trim();
  let errorPath = DEFAULT_ERROR_PATH;
  if (rawErrorPath) {
    // 새니타이즈가 값을 바꿨다면 = 동일 오리진 '/'-prefix 경로가 아니었다는 뜻(오타 또는 주입값)
    // → 조용히 '/'로 떨어뜨리지 말고 기본 로그인 경로로 되돌린다.
    const sanitized = sanitizeReturnTo(rawErrorPath);
    errorPath = sanitized === rawErrorPath ? sanitized : DEFAULT_ERROR_PATH;
  }

  cachedConfig = { hubUrl, issuer, appId, selfUrl, allowedEmailDomains, errorPath };
  return cachedConfig;
}

/** 이 스포크의 콜백 URL(= authorize의 redirect_uri, 허브 sso_clients 등록값과 정확매칭 대상). */
export function getCallbackUrl(cfg: SsoSpokeConfig = getSsoConfig()): string {
  return `${cfg.selfUrl}/sso/callback`;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. JWKS / 토큰 검증
 * ═══════════════════════════════════════════════════════════════════════════ */

type JwksResolver = ReturnType<typeof createRemoteJWKSet>;

// ★ 모듈 레벨 1회 생성. 요청마다 createRemoteJWKSet을 호출하면 내부 캐시가 매번 비어
//   로그인 1건마다 허브 JWKS를 HTTP로 재조회하게 된다(캐시 무의미 + 허브 부하).
//   URL을 키로 들고 있어 설정이 바뀌는 테스트 환경에서도 안전하다.
let jwksCache: { url: string; resolver: JwksResolver } | null = null;

function getJwks(hubUrl: string): JwksResolver {
  const url = new URL('/.well-known/jwks.json', hubUrl).toString();
  if (jwksCache && jwksCache.url === url) return jwksCache.resolver;
  const resolver = createRemoteJWKSet(new URL(url), {
    // 허브 응답 헤더가 `public, max-age=600`이므로(app/.well-known/jwks.json/route.ts:12)
    // 캐시 수명을 같은 10분으로 맞춘다 — jose 기본값과도 동일하지만 정렬 근거를 코드에 남긴다.
    cacheMaxAge: 600_000,
    // 미지 kid를 만났을 때의 재조회 쿨다운. 키 회전 시 전파 지연 상한이자,
    // 존재하지 않는 kid를 반복 제시하는 요청이 허브를 두드리는 것을 막는 상한이다.
    cooldownDuration: 30_000,
    timeoutDuration: 5_000,
  });
  jwksCache = { url, resolver };
  return resolver;
}

export interface HubIdentity {
  /** 검증된 사용자 email(lowercase). **신뢰 원천은 payload.sub이다**(아래 주석 참조). */
  email: string;
  /** id_token의 nonce 클레임. 콜백이 sso_nonce 쿠키와 대조한다. */
  nonce: string;
  /** 검증 완료된 원문 페이로드(어댑터가 추가 클레임을 읽어야 할 때만 사용). */
  payload: JWTPayload;
}

/**
 * 허브 id_token 검증(계약 §3.1 2·4단계).
 *
 * 실패는 전부 throw한다 — 콜백이 catch해서 `?sso_error=token_invalid`로 매핑한다.
 * 예외 메시지에 토큰 원문·email을 넣지 않는다(로그/Sentry 유출면 축소).
 */
export async function verifyHubToken(token: string): Promise<HubIdentity> {
  const cfg = getSsoConfig();

  const { payload } = await jwtVerify(token, getJwks(cfg.hubUrl), {
    issuer: cfg.issuer,
    audience: cfg.appId,
    // ★ alg 화이트리스트 고정: 명시하지 않으면 'none'·HS256 혼입(공개키를 HMAC 비밀로 쓰는
    //   alg confusion) 여지가 생긴다. 허브는 RS256만 발급한다(lib/sso-keys.ts SSO_ALG).
    algorithms: ['RS256'],
    // TTL이 60초뿐이라 서버 시계 오차가 곧바로 로그인 실패가 된다. 5초만 허용(재생 창은 그만큼만 늘어남).
    clockTolerance: 5,
  });

  // ★ 신뢰 원천은 sub이다. 허브는 email 클레임도 같은 값으로 넣지만(lib/sso.ts:48)
  //   그 클레임은 계약 §6 표에 명문화돼 있지 않다 — 계약이 보장하는 필드만 계약으로 취급한다.
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new Error('id_token: sub 클레임이 없습니다.');
  }
  const nonce = payload.nonce;
  if (typeof nonce !== 'string' || nonce.length === 0) {
    throw new Error('id_token: nonce 클레임이 없습니다.');
  }

  const email = payload.sub.toLowerCase();
  // 도메인 재검증(계약 §3.1 4단계). 허브도 가입 도메인을 강제하지만, 스포크는 자기 allowlist를
  // 독립적으로 적용한다 — 허브 정책이 넓어져도 스포크가 자동으로 넓어지지 않게 하는 이중 방어.
  const ok = cfg.allowedEmailDomains.some((d) => email.endsWith(`@${d}`));
  if (!ok) {
    throw new Error('id_token: 허용되지 않은 이메일 도메인입니다.');
  }

  return { email, nonce, payload };
}

/**
 * Tier2 stats 요청 토큰 검증(app/api/sso/stats/route.ts 전용, 계약 v2 §9).
 *
 * ★ scope·sub 검사가 이 함수의 존재 이유다. stats 토큰은 SSO id_token과 **같은 키·같은 aud**로
 *   서명되므로, 서명·iss·aud만 보면 로그인 사용자에게 60초간 발급된 id_token 한 장으로
 *   그 스포크의 통계 API가 열린다. scope='stats:read' && sub='sso-hub' 두 조건이
 *   id_token(sub=사용자 email, scope 클레임 없음)과 stats 토큰을 가르는 유일한 경계다.
 *
 * 실패는 throw — 라우트가 401로 변환한다(fail-closed).
 */
export async function verifyStatsRequest(bearer: string): Promise<void> {
  const cfg = getSsoConfig();

  const { payload } = await jwtVerify(bearer, getJwks(cfg.hubUrl), {
    issuer: cfg.issuer,
    audience: cfg.appId,
    algorithms: ['RS256'],
    clockTolerance: 5,
  });

  const scope = payload.scope;
  if (typeof scope !== 'string' || scope !== 'stats:read') {
    throw new Error('stats: scope 클레임이 유효하지 않습니다.');
  }
  if (payload.sub !== 'sso-hub') {
    throw new Error('stats: sub 클레임이 유효하지 않습니다.');
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. /sso/userinfo (선택 — 기본 OFF)
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface UserinfoProfile {
  email: string;
  name?: string;
  corporation_name?: string;
  organization_name?: string;
  position?: string;
}

const USERINFO_TIMEOUT_MS = 5_000;

function optionalString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

/**
 * `GET /sso/userinfo`를 Bearer id_token으로 **정확히 1회** 호출한다(계약 §2.1 MUST).
 *
 * ★ 재시도를 구현하지 않는다(MUST NOT). 허브는 이 호출 시점에 nonce를 원자적 UPDATE 1문으로
 *   소비하므로(app/sso/userinfo/route.ts:81-89) 2회차는 1회차 성공 여부와 무관하게 반드시 401이다.
 *   타임아웃(AbortController)도 "실패"로 throw만 하고 재호출하지 않는다 — 자동 재시도 래퍼
 *   (undici RetryAgent·axios-retry 등)를 끼울 여지 자체를 함수 설계에서 없앤다.
 * ★ 호출자(콜백)는 실패 시 `/sso/login`·`/sso/authorize`로 자동 재진입시켜서는 안 된다(MUST NOT).
 *   허브 세션이 살아 있으면 즉시 새 토큰이 발급되어 콜백→실패→재진입 무한 루프가 된다.
 * ★ 응답은 그 트랜잭션 안에서 즉시 소비하고 저장·로깅하지 않는다(§2.1, PII).
 *
 * 상태코드별 원인은 서로 다르지만(계약 §2.1.1 표) 스포크의 대응은 하나이므로 전부 동일하게 throw한다.
 */
export async function fetchUserinfoOnce(token: string): Promise<UserinfoProfile> {
  const cfg = getSsoConfig();
  const url = new URL('/sso/userinfo', cfg.hubUrl).toString();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), USERINFO_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
      redirect: 'error', // 리다이렉트 추종 금지 — Bearer 토큰이 제3자 오리진으로 새는 경로 차단
      signal: controller.signal,
    });
  } catch {
    // 네트워크 예외·타임아웃 — 상태코드 자체를 못 받은 경우도 동일한 실패로 취급(계약 §2.1).
    throw new Error('userinfo 호출에 실패했습니다.');
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    // 상태코드는 스포크 자체 로그 진단용으로만 남긴다(응답 본문·토큰은 포함하지 않음).
    throw new Error(`userinfo 응답이 실패했습니다(status=${res.status}).`);
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new Error('userinfo 응답을 해석할 수 없습니다.');
  }
  if (typeof data !== 'object' || data === null) {
    throw new Error('userinfo 응답 형식이 올바르지 않습니다.');
  }

  const row = data as Record<string, unknown>;
  const email = optionalString(row.email);
  if (!email) {
    throw new Error('userinfo 응답에 email이 없습니다.');
  }

  return {
    // 허브 users.email 원문 대소문자를 그대로 돌려주므로 여기서 정규화한다.
    // (신원의 신뢰 원천은 어디까지나 검증된 id_token의 sub다 — verifyHubToken 참조.)
    email: email.toLowerCase(),
    name: optionalString(row.name),
    corporation_name: optionalString(row.corporation_name),
    organization_name: optionalString(row.organization_name),
    position: optionalString(row.position),
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. 난수 / 비교 / returnTo 새니타이즈
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * state·nonce 공용 난수. randomBytes(32).toString('base64url') = 43자, 문자집합 [A-Za-z0-9_-].
 *
 * ★ 허브 nonce 형식 요건 /^[A-Za-z0-9._~-]{16,128}$/(app/sso/authorize/route.ts:32)을 **항상** 만족한다:
 *   base64url 문자집합 ⊂ RFC 3986 unreserved이고, 길이는 32바이트 → 항상 43자로 고정이다.
 * ★ 표준 base64('base64')를 쓰면 '+'·'/'·'='가 난수에 따라 섞여 **간헐적으로만** 400이 나는
 *   재현 곤란한 실패가 된다(계약 §2.2 경고). 반드시 'base64url'.
 * ★ 킷 텔레메트리·쿼리 안전성 측면에서도 URL 인코딩이 필요 없는 값이다.
 */
export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * state CSRF 대조. 길이 우선 비교 후 timingSafeEqual.
 *
 * timingSafeEqual은 길이가 다르면 throw하므로 길이 비교가 선행되어야 한다.
 * state는 URL 쿼리로 공개 echo되는 값이라 길이 비교 자체가 추가 정보를 흘리지 않는다.
 */
export function verifyState(
  expected: string | null | undefined,
  received: string | null | undefined,
): boolean {
  if (!expected || !received) return false;
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(received, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

const RETURN_TO_BASE = 'http://sentinel.invalid';

/**
 * returnTo 새니타이즈 — **동일 오리진 '/'-prefix 경로만** 허용(오픈리다이렉트 방지).
 *
 * ★ URL 파서 기반이어야 한다. prefix 문자열 검사(`startsWith('//')` 류)는 WHATWG 파서가
 *   TAB/CR/LF를 **위치 무관 제거**하기 때문에 우회된다: '/\t/evil.com' → 브라우저 해석은
 *   '//evil.com'(프로토콜 상대 → 외부 도메인). 허브도 같은 취약 패턴을 URL 파서로 교체했고
 *   회귀 테스트가 있다(허브 app/login/page.tsx sanitizeNext + tests/sanitize-next.test.mjs 25케이스).
 *   이 함수는 그 로직과 1:1 동일하다(더미 오리진 문자열만 다름).
 *
 * 허용 예: '/', '/videos', '/#board', '/report?id=1#tab'
 * 거부 예(→ '/'): '//evil.com', '/\t/evil.com', '\\evil.com', 'https://evil.com', 'javascript:alert(1)'
 */
export function sanitizeReturnTo(raw: string | null | undefined): string {
  if (!raw) return '/';
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return '/'; // 손상된 퍼센트 인코딩
  }
  // '/'로 시작하지 않으면 거부(상대경로 의미 변화·'\evil.com' 등 차단).
  if (!decoded.startsWith('/')) return '/';
  try {
    const u = new URL(decoded, RETURN_TO_BASE);
    if (u.origin !== RETURN_TO_BASE) return '/'; // 오리진 이탈 = 오픈리다이렉트 시도
    // 파서가 정규화한 값을 반환한다(제어문자 제거 후의 안전한 형태, 쿼리·해시 보존).
    const out = u.pathname + u.search + u.hash;
    // ★ 정규화 결과를 한 번 더 판정한다. 위 origin 검사는 정규화 '이전' 값 기준이라
    //   dot-segment를 놓친다: '/..//evil.com' 은 origin이 base 그대로라 통과하지만
    //   '..'가 걷힌 pathname은 '//evil.com'(프로토콜 상대)이 되고, 이 값을 리다이렉트
    //   대상으로 쓰면 외부 오리진으로 해석된다. 이 함수는 킷의 공개 export이므로
    //   호출부가 1회만 적용해도 안전해야 한다(2차 방어에 의존하지 않는다).
    if (new URL(out, RETURN_TO_BASE).origin !== RETURN_TO_BASE) return '/';
    return out;
  } catch {
    return '/';
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5. 임시 쿠키(state·nonce·returnTo) / 자동 SSO 억제 쿠키
 * ═══════════════════════════════════════════════════════════════════════════ */

export const SSO_STATE_COOKIE = 'sso_state';
export const SSO_NONCE_COOKIE = 'sso_nonce';
export const SSO_RETURN_TO_COOKIE = 'sso_return_to';
export const SSO_AUTO_SUPPRESS_COOKIE = 'sso_auto';

/**
 * 트랜잭션 쿠키 수명(초). 20분 — 미가입 신규 입사자가 허브에서 가입 + 이메일 OTP를
 * 왕복하는 시간을 감안한 값(짧으면 정상 사용자가 state_mismatch로 튕긴다).
 */
export const SSO_TEMP_COOKIE_MAX_AGE = 1200;

/** 자동 SSO 억제 쿠키 수명(초). 1시간 — 로그아웃 직후의 재로그인 루프만 막으면 충분하다. */
export const SSO_AUTO_SUPPRESS_MAX_AGE = 3600;

/** 쿠키 옵션 타입(next/server ResponseCookies.set의 3번째 인자와 호환되는 최소 형태). */
interface SsoCookieOptions {
  httpOnly: boolean;
  sameSite: 'lax';
  secure: boolean;
  path: string;
  maxAge: number;
}

function cookieOptions(path: string, maxAge: number): SsoCookieOptions {
  return {
    // 자바스크립트에서 읽을 이유가 없는 값들이다(XSS 시 탈취면 축소).
    httpOnly: true,
    // ★ 반드시 'lax'. 콜백은 허브(타 사이트)발 **top-level GET 302**로 진입하는 크로스사이트
    //   요청이라 'strict'면 쿠키가 동봉되지 않아 state 검증이 **매번** 실패한다.
    //   'none'은 불필요하게 넓다(top-level GET에는 lax로 충분).
    sameSite: 'lax',
    // 운영에서만 secure — 로컬 http 개발을 지원하기 위한 조건부.
    // 허브의 세션 쿠키도 동일 패턴이다(허브 lib/session.ts:16).
    secure: process.env.NODE_ENV === 'production',
    path,
    maxAge,
  };
}

/** 트랜잭션 쿠키 3종: path='/sso'로 스코프 최소화(앱의 나머지 요청에 실려 나가지 않는다). */
const TXN_COOKIE_PATH = '/sso';

export interface SsoTxnCookies {
  state: string | null;
  nonce: string | null;
  returnTo: string | null;
}

/**
 * /sso/login에서 state·nonce·returnTo를 한 번에 심는다.
 *
 * returnTo 값에 '/'·'?'·'#'가 포함될 수 있지만 Next.js 쿠키 직렬화기가 자동으로 인코딩하므로
 * 별도 encodeURIComponent가 필요 없다(이중 인코딩하면 콜백에서 경로가 깨진다).
 */
export function setSsoTxnCookies(
  res: NextResponse,
  txn: { state: string; nonce: string; returnTo: string },
): void {
  const opts = cookieOptions(TXN_COOKIE_PATH, SSO_TEMP_COOKIE_MAX_AGE);
  res.cookies.set(SSO_STATE_COOKIE, txn.state, opts);
  res.cookies.set(SSO_NONCE_COOKIE, txn.nonce, opts);
  res.cookies.set(SSO_RETURN_TO_COOKIE, txn.returnTo, opts);
}

/** 콜백에서 트랜잭션 쿠키 3종을 읽는다. 없으면 null(만료·이중 탭·직접 URL 접근). */
export function readSsoTxnCookies(req: NextRequest): SsoTxnCookies {
  return {
    state: req.cookies.get(SSO_STATE_COOKIE)?.value ?? null,
    nonce: req.cookies.get(SSO_NONCE_COOKIE)?.value ?? null,
    returnTo: req.cookies.get(SSO_RETURN_TO_COOKIE)?.value ?? null,
  };
}

/**
 * 트랜잭션 쿠키 3종 삭제 — **성공·실패 양쪽 응답에서 모두 호출한다.**
 *
 * nonce 1회성의 기본 메커니즘이 이 삭제다(계약 v2 §3.1 3단계): 성공한 콜백 URL을 다시
 * 붙여넣어도 sso_nonce 쿠키가 이미 없어 대조에 실패한다. 영속 스토어 소비(adapter.consumeNonce)는
 * 그 위에 얹는 선택적 심층 방어다.
 *
 * 삭제도 path를 맞춰야 한다 — 브라우저는 (name, domain, path) 단위로 쿠키를 구분하므로
 * path를 빠뜨리면 '/'에 새 만료 쿠키가 생길 뿐 '/sso'의 원본은 살아남는다.
 */
export function clearSsoTxnCookies(res: NextResponse): void {
  const opts = cookieOptions(TXN_COOKIE_PATH, 0);
  for (const name of [SSO_STATE_COOKIE, SSO_NONCE_COOKIE, SSO_RETURN_TO_COOKIE]) {
    res.cookies.set(name, '', opts);
  }
}

/**
 * §2.7 자동 SSO 억제 쿠키를 심는다(스포크 **자체 로그아웃 라우트**에서 호출).
 *
 * 미들웨어 자동 리다이렉트("세션 없으면 /sso/login")를 켜면 로그아웃이 불가능해진다:
 * 로그아웃 → 세션 없음 → 자동 SSO → 허브 세션(최대 30일) 생존 → silent 재로그인 루프.
 * 이 쿠키가 있으면 미들웨어가 자동 리다이렉트를 건너뛰고 일반 로그인 화면을 보여준다.
 *
 * path='/' — 미들웨어가 전체 라우트에서 읽어야 하므로 트랜잭션 쿠키와 스코프가 다르다.
 */
export function setAutoSuppressCookie(res: NextResponse): void {
  res.cookies.set(
    SSO_AUTO_SUPPRESS_COOKIE,
    'off',
    cookieOptions('/', SSO_AUTO_SUPPRESS_MAX_AGE),
  );
}

/** 억제 해제(사용자가 명시적으로 "AI캠퍼스로 로그인"을 누르는 경로 등에서 호출). */
export function clearAutoSuppressCookie(res: NextResponse): void {
  res.cookies.set(SSO_AUTO_SUPPRESS_COOKIE, '', cookieOptions('/', 0));
}

/** 자동 SSO 리다이렉트를 건너뛰어야 하는가(미들웨어 전용 판정). */
export function isAutoSuppressed(req: NextRequest): boolean {
  return req.cookies.get(SSO_AUTO_SUPPRESS_COOKIE)?.value === 'off';
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 6. 로그아웃 URL
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * "모든 사내 앱에서 로그아웃" 링크 — 허브 세션까지 종료한다.
 * (스포크 자기 세션 삭제는 호출자 책임. 허브는 스포크 세션을 건드리지 않는다.)
 *
 * ⚠️ postLogoutRedirectUri는 허브 `sso_clients.post_logout_redirect_uris`에 **정확매칭으로
 *    등록돼 있어야** 그 경로로 돌아온다. 미등록이면 허브는 에러가 아니라 **조용히 허브 홈으로**
 *    302한다(허브 app/sso/logout/route.ts:39-49) — "로그아웃했는데 AI캠퍼스가 뜬다"는 증상의 원인.
 *    등록 요청은 허브 오너에게.
 */
export function getFullLogoutUrl(postLogoutRedirectUri: string): string {
  const cfg = getSsoConfig();
  // hubUrl에 trailing slash가 있어도 안전하도록 상대 해석을 쓴다(getSsoConfig 주석 참조).
  const u = new URL('/sso/logout', cfg.hubUrl);
  u.searchParams.set('app', cfg.appId);
  // app·post_logout_redirect_uri 둘 다 있어야 허브가 화이트리스트 검사를 수행한다(:40).
  u.searchParams.set('post_logout_redirect_uri', postLogoutRedirectUri);
  return u.toString();
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 7. 어댑터 계약 — 앱별 가변부의 유일한 경계
 * ═══════════════════════════════════════════════════════════════════════════ */

/** 앱 중립 사용자 표현. 자기 DB의 추가 필드는 인덱스 시그니처로 자유롭게 실어 보낸다. */
export interface SpokeUser {
  id: string | number;
  email: string;
  role?: string;
  [key: string]: unknown;
}

/** 일별 집계 1행(계약 v2 §9). date는 KST(Asia/Seoul) 기준 'YYYY-MM-DD'. */
export interface SsoDailyStat {
  date: string;
  ssoLogins: number;
  /** 자체 로그인 수 — Tier2의 존재 이유(허브가 관측할 수 없는 값). */
  selfLogins?: number;
  uniqueUsers: number;
  /** 스포크가 정의한 DAU. */
  activeUsers?: number;
  pageviews?: number;
}

export interface SpokeAdapter {
  /**
   * [필수] email로 사용자 조회, 없으면 최소권한으로 생성. 정책상 거부면 null.
   * ★ 조회는 **대소문자 무시**(`LOWER(email)`)여야 한다 — 정확매칭을 쓰면 기존 자체가입 계정과
   *   SSO 계정이 같은 사람에게 이중 생성되어 "SSO로 들어가면 권한이 사라진다"가 된다.
   */
  provisionUser(email: string): Promise<SpokeUser | null>;

  /** [필수] 기존 자체 로그인과 **동일한** 세션 발급 함수를 재사용(httpOnly 쿠키). */
  establishSession(user: SpokeUser, res: NextResponse, req: Request): Promise<void>;

  /**
   * [선택] nonce 영속 1회 소비(DB 등). 이미 소비됐으면 false를 반환한다.
   * 기본 방어는 sso_nonce 쿠키 바인딩이고(clearSsoTxnCookies 참조) 이것은 그 위의 심층 방어다.
   */
  consumeNonce?(nonce: string): Promise<boolean>;

  /** [선택] SSO 로그인 1건 기록(stats 원천). 실패해도 로그인을 막지 않는다. */
  recordSsoLogin?(user: SpokeUser, req: Request): Promise<void>;

  /** [선택] 최근 days일 일별 집계(KST). 미구현이면 stats 라우트가 404로 존재 자체를 숨긴다. */
  getDailyStats?(days: number): Promise<SsoDailyStat[]>;

  /**
   * [선택] `/sso/userinfo` 프로필 병합. **이 메서드가 정의된 경우에만** 콜백이
   * fetchUserinfoOnce()를 트랜잭션 안에서 정확히 1회 호출한다(기본값 = 호출 안 함).
   * 콜백 파일을 수정하지 않고 userinfo 사용 여부를 어댑터만으로 켜고 끄기 위한 확장점이다.
   */
  mergeUserinfo?(profile: UserinfoProfile, user: SpokeUser): Promise<SpokeUser>;

  /**
   * [선택] userinfo 실패를 치명적으로 다룰지. 기본(미정의·false)은 계약 §2.1 기본 처리 —
   * id_token 클레임만으로 세션을 발급하고 계속 진행한다(자동 재진입 금지).
   * true면 콜백이 `${errorPath}?sso_error=userinfo_failed`로 302하고, 그 페이지에서는
   * **사용자가 직접 버튼을 눌러야** SSO가 재개되어야 한다(자동 리다이렉트 금지 — 무한 루프).
   */
  userinfoRequired?: boolean;
}
