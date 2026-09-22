// Sentry 전송 직전 SSO id_token 마스킹 (docs/sso/SSO-HUB-BLUEPRINT.md §6-B1①).
// 60초 id_token(PII 포함 JWT)이 `?token=` 쿼리로 스포크 콜백 URL에 흐르므로,
// 이벤트 request.url·query_string·헤더·브레드크럼 URL이 Sentry에 남기 전에 값을 제거한다.
// client/server/edge 세 config가 공유한다 — 순수 함수만 사용(Edge 런타임 호환).
import type { Breadcrumb, ErrorEvent } from '@sentry/nextjs';
// TransactionEvent는 @sentry/nextjs가 재export하지 않아 @sentry/core에서 직접 가져온다(v10).
import type { TransactionEvent } from '@sentry/core';

// `?token=`·`&token=`·`#token=`·문자열 선두 `token=` (+ `id_token` 변형)만 매칭.
// `mytoken=` 같은 다른 파라미터는 구분자 조건 때문에 매칭되지 않는다.
// NoA Vibe SSO 콜백(`/auth/callback?code=...&session_state=...`)의 Keycloak
// 인가코드·세션상태도 동일한 쿼리파라미터 형태라 함께 마스킹한다. `code=`는 흔한
// 단어라 오탐 위험이 있으므로 `?`/`&`/`#`/문자열 선두 뒤에 오는 쿼리파라미터
// 형태일 때만 매칭되게 구분자 조건을 유지한다(예: 문장 중간의 "code=이렇게"는 매칭 안 됨).
const TOKEN_RE = /((?:^|[?&#])(?:(?:id_)?token|code|session_state)=)[^&#\s]+/gi;
const TOKEN_KEY_RE = /^(?:(?:id_)?token|code|session_state)$/i;

export function maskToken(value: string): string {
  return value.replace(TOKEN_RE, '$1[Filtered]');
}

// Sentry Request.query_string은 string | 객체 | [key, value][] 세 형태 모두 가능.
function maskQueryString(qs: unknown): unknown {
  if (typeof qs === 'string') return maskToken(qs);
  if (Array.isArray(qs)) {
    return qs.map((pair) =>
      Array.isArray(pair) && TOKEN_KEY_RE.test(String(pair[0])) ? [pair[0], '[Filtered]'] : pair,
    );
  }
  if (qs && typeof qs === 'object') {
    const out: Record<string, unknown> = { ...(qs as Record<string, unknown>) };
    for (const k of Object.keys(out)) {
      if (TOKEN_KEY_RE.test(k)) out[k] = '[Filtered]';
    }
    return out;
  }
  return qs;
}

/** beforeSend / beforeSendTransaction 공용 — 이벤트의 URL·쿼리·헤더·브레드크럼에서 token 마스킹. */
export function scrubEvent<E extends ErrorEvent | TransactionEvent>(event: E): E {
  if (event.request) {
    if (event.request.url) event.request.url = maskToken(event.request.url);
    if (event.request.query_string !== undefined) {
      event.request.query_string = maskQueryString(
        event.request.query_string,
      ) as typeof event.request.query_string;
    }
    // Referer 등 헤더 값에 전체 URL이 실릴 수 있다.
    if (event.request.headers) {
      for (const k of Object.keys(event.request.headers)) {
        const v = event.request.headers[k];
        if (typeof v === 'string') event.request.headers[k] = maskToken(v);
      }
    }
  }
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumb);
  }
  return event;
}

/** beforeBreadcrumb 공용 — fetch/xhr/navigation 브레드크럼의 URL에서 token 마스킹. */
export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  if (typeof breadcrumb.message === 'string') {
    breadcrumb.message = maskToken(breadcrumb.message);
  }
  if (breadcrumb.data) {
    for (const k of ['url', 'to', 'from'] as const) {
      const v = breadcrumb.data[k];
      if (typeof v === 'string') breadcrumb.data[k] = maskToken(v);
    }
  }
  return breadcrumb;
}
