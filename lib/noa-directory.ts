// 사내 직원 디렉터리 조회 — 서버 전용.
//
// 원래 `@noa/auth-sdk/server`의 createAuthServer().getDirectoryUser()를 썼으나, 그 패키지는
// 사내 CodeArtifact에서만 설치할 수 있어 Vercel 빌드가 install 단계에서 깨진다(무인증 401,
// 공개 npm 404). 배포 경로를 두 곳(Vercel·NoA Vibe) 유지하기 위해 SDK의 와이어 계약만
// 그대로 옮겨 왔다(2026-09-21 결정).
//
// 옮겨온 계약 (node_modules/@noa/auth-sdk/dist/server.js 실측):
//   GET {baseUrl}/users/{encodeURIComponent(username)}?integrationId={integrationId}
//   Authorization: Bearer {runtimeToken ?? process.env.NOA_AUTH_DIRECTORY_TOKEN}
//   404 → null · !ok → throw · ok → DirectoryUser JSON
//
// SDK 대비 의도적 차이 (둘 다 보강):
//   - AbortController로 실제 요청을 끊는다. SDK의 fetch에는 signal도 timeout도 없어서
//     브로커가 응답하지 않으면 Lambda 타임아웃까지 매달린다.
//   - 전체 dump(listUsers)는 아예 구현하지 않는다(가드레일 금지 항목).
//
// ⚠️ 플랫폼이 이 계약을 바꾸면 조용히 깨진다. SDK 버전이 올라가면 위 실측 경로를 다시 대조할 것.

/** @noa/auth-sdk 의 DirectoryUser 와 동일 형태 (dist/index-BZ89VK5a.d.ts 기준). */
export interface DirectoryUser {
  username: string;
  name: string;
  email?: string;
  employeeId?: string;
  employeeStatus?: string;
  companyName?: string;
  buName?: string;
  deptName?: string;
  positionName?: string;
  jobName?: string;
}

export interface DirectoryOptions {
  integrationId: string;
  /** 디렉터리 브로커(NoA WAS) base URL. */
  baseUrl: string;
  /** 생략 시 process.env.NOA_AUTH_DIRECTORY_TOKEN. 브라우저에 절대 내려보내지 않는다. */
  runtimeToken?: string;
  /** 기본 5초. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 5_000;

function assertServerOnly(): void {
  if (typeof window !== 'undefined') {
    throw new Error('noa-directory: server only');
  }
}

/**
 * 사내 직원 1명 조회. 없으면 null, 통신 실패·타임아웃·설정 누락은 throw.
 * 호출부가 "거부"와 "부가필드 폴백" 중 무엇을 할지 각자 정한다.
 */
export async function getDirectoryUser(
  options: DirectoryOptions,
  username: string,
): Promise<DirectoryUser | null> {
  assertServerOnly();

  const base = (options.baseUrl ?? '').replace(/\/+$/, '');
  if (!base) throw new Error('noa-directory: base url required');

  const token = options.runtimeToken ?? process.env.NOA_AUTH_DIRECTORY_TOKEN ?? '';
  if (!token) throw new Error('noa-directory: runtime token required');

  const name = username.trim();
  if (!name) throw new Error('noa-directory: username required');

  // N1: encodeURIComponent는 `/ ? & #`는 막지만 `.`은 인코딩하지 않는다(RFC 3986 unreserved).
  // username="."·".."이면 URL 정규화로 각각 컬렉션 엔드포인트(`/users/`)·API 루트(`/`)로
  // 요청이 새 나가면서 Authorization 헤더(NOA_AUTH_DIRECTORY_TOKEN)가 그대로 실린다.
  // username은 id_token의 preferred_username이라 IdP가 통제하지만 앱이 방어해야 한다.
  // 단일 경로 세그먼트 문자만 허용(사내 username 규약 `oh_dongha01` 형태 — `_` 필수 포함).
  if (name === '.' || name === '..' || !/^[A-Za-z0-9_.@-]{1,64}$/.test(name)) {
    throw new Error('noa-directory: invalid username');
  }

  const url =
    `${base}/users/${encodeURIComponent(name)}` +
    `?integrationId=${encodeURIComponent(options.integrationId)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
      cache: 'no-store',
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`noa-directory: failed (${res.status})`);
    return (await res.json()) as DirectoryUser;
  } finally {
    clearTimeout(timer);
  }
}
