// GET /sso/authorize — 인증 시작점(Authorization Endpoint, 단순화). PRD §2.2.
// 허브 세션 확인 → 없으면 허브 로그인 유도 → 있으면 단명 id_token 발급 후 redirect_uri로 302.
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '../../../lib/session';
import { getClient, isAllowedRedirect } from '../../../lib/sso-clients';
import { storeNonce } from '../../../lib/sso-nonce';
import { signIdToken, randomNonce, getIssuer } from '../../../lib/sso';
import { checkRateLimit, getClientIp, tooManyRequests } from '../../../lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 오픈리다이렉트 차단: 미등록/불일치 시 400(리다이렉트 금지, PRD §7.1).
function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(req: NextRequest) {
  // 레이트리밋(IP 단위, §7.9). 실패해도 흐름을 막지 않도록 방어.
  try {
    const ip = getClientIp(req);
    const rl = await checkRateLimit('sso_authorize', ip, 60, '1 m');
    if (!rl.success) return tooManyRequests();
  } catch {
    /* 레이트리밋 백엔드 오류는 무시(가용성 우선) */
  }

  const url = new URL(req.url);
  const app = url.searchParams.get('app') ?? '';
  const redirectUri = url.searchParams.get('redirect_uri') ?? '';
  const state = url.searchParams.get('state') ?? '';
  const nonceIn = url.searchParams.get('nonce') ?? '';
  const prompt = url.searchParams.get('prompt') ?? '';

  // 1. app / redirect_uri 검증 — 정확매칭. 불일치 시 리다이렉트 금지.
  const client = await getClient(app);
  if (!client) return badRequest('unknown app');
  if (!isAllowedRedirect(client, redirectUri)) {
    return badRequest('redirect_uri not allowed');
  }
  // 2. state 필수(CSRF, §7.2).
  if (!state) return badRequest('state required');

  // 3. 허브 세션 확인.
  const user = await getCurrentUser();
  if (!user) {
    const sep = redirectUri.includes('?') ? '&' : '?';
    if (prompt === 'none') {
      // silent 체크 — 로그인 UI 없이 조용히 에러 리다이렉트.
      const loc = `${redirectUri}${sep}error=login_required&state=${encodeURIComponent(state)}`;
      return NextResponse.redirect(loc, 302);
    }
    // 원래 authorize URL 보존 후 허브 로그인으로. next는 동일 오리진 경로만.
    const next = encodeURIComponent(url.pathname + url.search);
    return NextResponse.redirect(new URL(`/login?next=${next}`, url.origin), 302);
  }

  // 5. id_token 발급(RS256, 60초) + nonce 1회성 저장.
  const nonce = nonceIn || randomNonce();
  try {
    await storeNonce(nonce, app);
  } catch {
    // nonce 저장 실패(테이블 미존재 등)는 토큰 발급을 막지 않는다(스포크 측 1회성 소비가 추가 방어).
  }

  let idToken: string;
  try {
    idToken = await signIdToken({
      iss: getIssuer(),
      sub: user.email,
      aud: app,
      nonce,
    });
  } catch {
    // 키 env 미설정 등 — 통일 에러(토큰 미발급).
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }

  // 6. redirect_uri로 302 (token + state echo).
  const sep = redirectUri.includes('?') ? '&' : '?';
  const loc = `${redirectUri}${sep}token=${encodeURIComponent(idToken)}&state=${encodeURIComponent(state)}`;
  return NextResponse.redirect(loc, 302);
}
