// Sentry Edge runtime 초기화 (Edge route handlers, OG 이미지 등).
import * as Sentry from '@sentry/nextjs';
import { scrubEvent, scrubBreadcrumb } from './lib/sentry-scrub';

const DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (DSN) {
  Sentry.init({
    dsn: DSN,
    enabled: process.env.NODE_ENV === 'production',
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
    // SSO id_token(?token=) 마스킹 — §6-B1① (lib/sentry-scrub.ts)
    beforeSend: scrubEvent,
    beforeSendTransaction: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  });
}
