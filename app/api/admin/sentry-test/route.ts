// Sentry 동작 확인용 테스트 엔드포인트.
// 어드민만 호출 가능. 호출 시 의도적으로 에러를 발생시켜 Sentry에 전송.
//
// 사용법:
//   1. 어드민 로그인 후 브라우저 콘솔에서:
//        fetch('/api/admin/sentry-test', { method: 'POST', credentials: 'include' })
//      또는 어드민 페이지에 방문 후 새 탭에서 직접 URL POST.
//   2. Sentry 대시보드 → Issues 에 "Sentry test error" 가 30초 안에 나타나야 정상.

import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '../../../../lib/admin-auth';
import { reportError } from '../../../../lib/error-report';

export async function POST(req: NextRequest) {
  const denied = await checkAdmin(req);
  if (denied) return denied;

  const err = new Error('Sentry test error — 정상적으로 노출되어야 합니다. 응답 200.');
  // 명시적 reportError 호출 (catch 패턴 검증)
  reportError(err, { route: 'admin/sentry-test', detail: { triggered: 'manual' } });

  return NextResponse.json({
    ok: true,
    message: 'Sentry로 테스트 에러 전송했습니다. Sentry 대시보드 → Issues 확인하세요.',
    sentryDsnConfigured: !!(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN),
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV || 'n/a',
  });
}
