// 사내 통합계정(Keycloak) OIDC Authorization Code + PKCE — 브라우저 전용.
//
// 원래 `@noa/auth-sdk`의 createAuth()를 썼으나, 그 패키지는 사내 CodeArtifact에서만 설치할 수
// 있어 Vercel 빌드가 install 단계에서 깨진다(무인증 401, 공개 npm 404). 배포 경로를 두 곳
// (Vercel·NoA Vibe) 유지하기 위해 SDK의 와이어 계약만 그대로 옮겨 왔다(2026-09-21 결정).
//
// 옮겨온 계약 (node_modules/@noa/auth-sdk/dist/index.js 실측):
//   authorize : {issuer}/protocol/openid-connect/auth
//               ?client_id&redirect_uri&response_type=code&scope=openid profile email
//               &code_challenge&code_challenge_method=S256
//   token     : POST {issuer}/protocol/openid-connect/token
//               grant_type=authorization_code&client_id&code&redirect_uri&code_verifier
//   redirectUri 기본값 : `${window.location.origin}/auth/callback`  ← 경로가 고정인 이유
//
// SDK 대비 의도적 차이 (전부 보강):
//   1) `state` 를 보낸다. SDK는 보내지 않아 인가 응답이 CSRF에 무방비였다.
//   2) `nonce` 를 보낸다(OIDC Core 3.1.2.1). 다만 단독으로는 약한 통제다 — 서버가 기대값을
//      따로 보관하지 않고 클라이언트가 함께 보내는 구조라, 악의적 클라이언트는 둘 다 지어낼 수
//      있다. **재생 방지의 1차 통제는 서버측 jti 1회 소비**(lib/noa-sso.ts)이고 nonce는 그 위의
//      방어층이다. 이 한계를 알고 쓸 것.
//   3) **토큰을 sessionStorage에 저장하지 않는다.** SDK는 id_token/access_token을 통째로
//      sessionStorage에 넣어 두는데, 이 앱의 세션은 httpOnly 쿠키(CLAUDE.md §6-4)이므로
//      브라우저에 토큰을 남길 이유가 없다. 여기서는 반환만 하고 즉시 잊는다.
//
// ⚠️ 플랫폼이 이 계약을 바꾸면 조용히 깨진다. SDK 버전이 올라가면 위 실측 경로를 다시 대조할 것.

export interface NoaOidcConfig {
  issuer: string;
  clientId: string;
  /** 생략 시 `${window.location.origin}/auth/callback`. */
  redirectUri?: string;
}

export interface NoaOidcResult {
  idToken: string;
  /** 인가 요청에 실어 보낸 nonce. 서버가 id_token의 nonce 클레임과 대조한다. */
  nonce: string;
}

const PKCE_KEY = 'noa-sso-pkce-verifier';
const STATE_KEY = 'noa-sso-state';
const NONCE_KEY = 'noa-sso-nonce';

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return toBase64Url(new Uint8Array(digest));
}

function issuerBase(cfg: NoaOidcConfig): string {
  const issuer = (cfg.issuer ?? '').trim().replace(/\/+$/, '');
  if (!issuer) throw new Error('noa-oidc: issuer required');
  return issuer;
}

function resolveRedirectUri(cfg: NoaOidcConfig): string {
  if (cfg.redirectUri) return cfg.redirectUri;
  if (typeof window === 'undefined') throw new Error('noa-oidc: redirect uri required');
  return `${window.location.origin}/auth/callback`;
}

/** 인가 요청 임시값 정리. 성공·실패 어느 쪽으로 끝나든 호출해 잔여물을 남기지 않는다. */
export function clearOidcTransients(): void {
  try {
    sessionStorage.removeItem(PKCE_KEY);
    sessionStorage.removeItem(STATE_KEY);
    sessionStorage.removeItem(NONCE_KEY);
  } catch {
    // private 모드 등에서 sessionStorage 접근이 막혀도 로그인 흐름을 깨지 않는다.
  }
}

/**
 * Keycloak 로그인 페이지로 이동시킨다. 정상 동작이면 이 함수는 반환하지 않는다(페이지 이탈).
 * 복귀 경로(next)는 호출부가 자기 키로 저장한다 — 여기서는 다루지 않는다.
 */
export async function startLogin(cfg: NoaOidcConfig): Promise<void> {
  if (!cfg.clientId) throw new Error('noa-oidc: client id required');

  const verifier = randomToken();
  const state = randomToken();
  const nonce = randomToken();
  const challenge = await pkceChallenge(verifier);

  sessionStorage.setItem(PKCE_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);
  sessionStorage.setItem(NONCE_KEY, nonce);

  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: resolveRedirectUri(cfg),
    response_type: 'code',
    scope: 'openid profile email',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
    nonce,
    // prompt=login — IdP가 기존 세션이 있어도 반드시 재인증하게 한다(OIDC Core 3.1.2.1).
    //
    // 없으면: 매장 공용 PC에서 A가 로그아웃해도 Keycloak 세션 쿠키(auth.noa.eland.com)는
    // 남아 있어서, 다음 사람 B가 「사내 계정으로 로그인」을 누르면 IdP가 말없이 A의 코드를
    // 발급하고 B가 A 계정으로 들어간다. 우리 로그아웃(POST /api/users/logout)은 앱 쿠키만
    // 지우므로 앱 코드만으로는 이 경로를 막을 수 없다.
    //
    // 비용은 크지 않다 — Keycloak을 거치는 건 앱 세션이 없을 때뿐이고, 로그인 후에는 자체
    // httpOnly JWT(자동 로그인 기본 ON → 30일, lib/session.ts)로 버틴다. 체감상 월 1회 수준의
    // 비밀번호 입력이다.
    //
    // 한계: 이건 우리 앱만 막는다. Keycloak 세션 자체는 살아 있어 같은 브라우저의 다른 사내
    // 앱은 여전히 A로 열린다. 근본 해결은 RP-initiated logout(로그아웃 시 IdP 세션까지 종료)
    // 이며, Keycloak에 post_logout_redirect_uri 등록이 확인되면 후속으로 추가한다.
    prompt: 'login',
  });

  window.location.assign(`${issuerBase(cfg)}/protocol/openid-connect/auth?${params.toString()}`);
}

/**
 * 콜백 URL의 code를 id_token으로 교환한다.
 * state 불일치·verifier 분실·교환 실패는 전부 throw하며, 어느 경우든 임시값을 정리한다.
 * 반환된 id_token은 **검증되지 않은 값**이다 — 서버(lib/noa-sso.ts)가 서명·클레임을 다시 본다.
 */
export async function handleCallback(cfg: NoaOidcConfig): Promise<NoaOidcResult> {
  if (!cfg.clientId) throw new Error('noa-oidc: client id required');

  const url = new URL(window.location.href);
  const error = url.searchParams.get('error');
  if (error) {
    clearOidcTransients();
    throw new Error(`noa-oidc: authorization error (${error})`);
  }

  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');
  const verifier = sessionStorage.getItem(PKCE_KEY);
  const expectedState = sessionStorage.getItem(STATE_KEY);
  const nonce = sessionStorage.getItem(NONCE_KEY);

  try {
    if (!code) throw new Error('noa-oidc: callback code missing');
    if (!verifier) throw new Error('noa-oidc: pkce verifier missing');
    // SDK에는 없던 검사 — 인가 응답이 우리가 시작한 요청의 것인지 확인한다(CSRF).
    if (!expectedState || returnedState !== expectedState) {
      throw new Error('noa-oidc: state mismatch');
    }
    if (!nonce) throw new Error('noa-oidc: nonce missing');

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: cfg.clientId,
      code,
      redirect_uri: resolveRedirectUri(cfg),
      code_verifier: verifier,
    });

    const res = await fetch(`${issuerBase(cfg)}/protocol/openid-connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) throw new Error(`noa-oidc: token exchange failed (${res.status})`);

    const json = (await res.json()) as { id_token?: string };
    if (!json.id_token) throw new Error('noa-oidc: id_token missing');

    // 토큰을 저장하지 않고 그대로 넘긴다 — 브라우저에 남기지 않는 것이 의도다.
    return { idToken: json.id_token, nonce };
  } finally {
    clearOidcTransients();
  }
}
