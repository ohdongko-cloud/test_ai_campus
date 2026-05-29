const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {};

// SENTRY_DSN(또는 NEXT_PUBLIC_SENTRY_DSN)이 없으면 nextConfig만 export.
const hasSentry = !!(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN);

module.exports = hasSentry
  ? withSentryConfig(nextConfig, {
      // Sentry build options
      // 조직/프로젝트 슬러그가 없어도 빌드는 통과(소스맵 업로드만 skip).
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: !process.env.CI,
      // 소스맵을 클라이언트에 공개하지 않음
      hideSourceMaps: true,
      // 자동 트리 셰이킹
      disableLogger: true,
      // 터널 라우트 — 광고차단기에 막히지 않게 (선택)
      tunnelRoute: '/monitoring',
    })
  : nextConfig;
