// SSO 클라이언트(앱) 레지스트리. PRD §3.
// 오픈리다이렉트 1차 방어선: 허용된 app + redirect_uri만 정확매칭(exact) 인증.
//
// 조회 우선순위: DB `sso_clients`(운영, 무중단 추가) → 없으면 env `SSO_CLIENTS_JSON` 폴백.
// 스포크 실제 URL은 미확정(Q6)이므로 절대 하드코딩하지 않는다 — 데이터 주도.
import { sql } from './db';

export interface SsoClient {
  app: string;
  name: string;
  redirectUris: string[];
  postLogoutRedirectUris: string[];
  enabled: boolean;
}

// 운영 외에서 http/localhost redirect를 허용할지(개발 env 전용 플래그).
const ALLOW_INSECURE =
  process.env.NODE_ENV !== 'production' &&
  process.env.SSO_ALLOW_INSECURE_REDIRECT === '1';

// 짧은 캐시(레지스트리 조회 비용 절감). 60초.
const CACHE_TTL_MS = 60_000;
let cache: { at: number; map: Map<string, SsoClient> } | null = null;

/**
 * redirect_uri 정규화: 스킴 소문자, host 소문자, 쿼리/프래그먼트 제거,
 * trailing slash 제거(루트 경로 제외). 비교는 정규화된 베이스 URL끼리 정확매칭.
 * 파싱 불가하면 null.
 */
export function normalizeRedirect(uri: string): string | null {
  if (!uri) return null;
  let u: URL;
  try {
    u = new URL(uri);
  } catch {
    return null;
  }
  const scheme = u.protocol.toLowerCase(); // 'https:'
  if (scheme !== 'https:' && !ALLOW_INSECURE) return null;
  if (scheme !== 'https:' && scheme !== 'http:') return null;
  let path = u.pathname;
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  // 쿼리/프래그먼트는 베이스 URL에 포함하지 않는다.
  return `${scheme}//${u.host.toLowerCase()}${path}`;
}

function parseEnvClients(): Map<string, SsoClient> {
  const map = new Map<string, SsoClient>();
  const raw = process.env.SSO_CLIENTS_JSON;
  if (!raw) return map;
  try {
    const arr = JSON.parse(raw) as Array<Record<string, unknown>>;
    if (!Array.isArray(arr)) return map;
    for (const r of arr) {
      const app = String(r.app ?? '').trim();
      if (!app) continue;
      const redirectUris = Array.isArray(r.redirectUris)
        ? (r.redirectUris as unknown[]).map((x) => String(x))
        : [];
      const postLogoutRedirectUris = Array.isArray(r.postLogoutRedirectUris)
        ? (r.postLogoutRedirectUris as unknown[]).map((x) => String(x))
        : [];
      map.set(app, {
        app,
        name: String(r.name ?? app),
        redirectUris,
        postLogoutRedirectUris,
        enabled: r.enabled === undefined ? true : r.enabled !== false,
      });
    }
  } catch {
    // env JSON 파싱 실패 → 빈 레지스트리(인증 거부 쪽이 안전).
  }
  return map;
}

async function loadClients(): Promise<Map<string, SsoClient>> {
  // DB 우선.
  try {
    const rows = await sql`
      SELECT app, name, redirect_uris, post_logout_redirect_uris, enabled
        FROM sso_clients`;
    if (rows.length > 0) {
      const map = new Map<string, SsoClient>();
      for (const r of rows as Array<Record<string, unknown>>) {
        const app = String(r.app);
        map.set(app, {
          app,
          name: String(r.name ?? app),
          redirectUris: Array.isArray(r.redirect_uris)
            ? (r.redirect_uris as unknown[]).map((x) => String(x))
            : [],
          postLogoutRedirectUris: Array.isArray(r.post_logout_redirect_uris)
            ? (r.post_logout_redirect_uris as unknown[]).map((x) => String(x))
            : [],
          enabled: r.enabled !== false,
        });
      }
      return map;
    }
    // 행이 없으면 env 폴백.
    return parseEnvClients();
  } catch {
    // 테이블 미존재 등 → env 폴백.
    return parseEnvClients();
  }
}

async function getRegistry(): Promise<Map<string, SsoClient>> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.map;
  const map = await loadClients();
  cache = { at: now, map };
  return map;
}

/** app 식별자로 클라이언트 조회. 미등록·비활성이면 null. */
export async function getClient(app: string): Promise<SsoClient | null> {
  if (!app) return null;
  const reg = await getRegistry();
  const c = reg.get(app);
  if (!c || !c.enabled) return null;
  return c;
}

/** redirect_uri가 해당 클라이언트의 허용 목록과 정확매칭하면 true. */
export function isAllowedRedirect(client: SsoClient, uri: string): boolean {
  const target = normalizeRedirect(uri);
  if (!target) return false;
  return client.redirectUris.some((allowed) => normalizeRedirect(allowed) === target);
}

/** post_logout_redirect_uri 화이트리스트 정확매칭. */
export function isAllowedPostLogout(client: SsoClient, uri: string): boolean {
  const target = normalizeRedirect(uri);
  if (!target) return false;
  return client.postLogoutRedirectUris.some(
    (allowed) => normalizeRedirect(allowed) === target,
  );
}

/** 테스트/운영용 캐시 무효화. */
export function clearClientCache(): void {
  cache = null;
}
