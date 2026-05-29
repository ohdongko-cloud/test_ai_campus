// Next.js Instrumentation hook — Sentry 초기화 진입점.
// 서버 시작 시 자동 호출됨.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

// Next.js 15+ 표준 훅: 라우터 핸들러에서 던져진 에러 자동 캡처.
// Sentry 타입 정의가 자체 RequestInfo를 요구하므로 unknown 캐스팅으로 우회.
export async function onRequestError(
  err: unknown,
  request: Request,
  context: { routerKind: string; routePath: string; routeType: string }
) {
  const Sentry = await import('@sentry/nextjs');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Sentry as any).captureRequestError?.(err, request, context);
}
