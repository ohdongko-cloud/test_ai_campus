// 서버 측 에러를 Sentry로 보고하는 얇은 헬퍼.
// Sentry SDK 미설치 환경(개발/테스트)에서도 안전하게 no-op.
import * as Sentry from '@sentry/nextjs';

export function reportError(err: unknown, context?: { route?: string; detail?: Record<string, unknown> }): void {
  try {
    if (context) {
      Sentry.withScope(scope => {
        if (context.route) scope.setTag('route', context.route);
        if (context.detail) scope.setContext('detail', context.detail);
        Sentry.captureException(err);
      });
    } else {
      Sentry.captureException(err);
    }
  } catch {
    // Sentry 자체가 실패해도 응답을 막지 않음
  }
  // 로컬에서도 항상 콘솔에 남김
  console.error('[error]', err);
}
