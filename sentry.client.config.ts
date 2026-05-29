// Sentry 클라이언트(브라우저) 초기화.
// NEXT_PUBLIC_SENTRY_DSN 환경변수 필요 (Vercel에 등록).
import * as Sentry from '@sentry/nextjs';

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (DSN) {
  Sentry.init({
    dsn: DSN,
    // 운영 환경에서만 활성화 (개발 노이즈 방지)
    enabled: process.env.NODE_ENV === 'production',
    // 트랜잭션 샘플링 비율 (1.0=100%). 1800명 트래픽 고려해 낮게 시작.
    tracesSampleRate: 0.1,
    // PII (이메일·IP) 자동 수집 비활성 — 사내 서비스 보안 정책
    sendDefaultPii: false,
    // 콘솔/네트워크 breadcrumb 제한
    maxBreadcrumbs: 50,
    // 환경 라벨
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
  });
}
