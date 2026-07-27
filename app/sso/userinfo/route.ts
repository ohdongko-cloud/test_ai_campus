// GET /sso/userinfo (선택) — Bearer id_token 검증 후 최소 프로필 반환. PRD §2.5.
// 역할/권한은 반환하지 않는다(인가는 스포크 책임, N2).
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify, importSPKI, type CryptoKey } from 'jose';
import { sql } from '../../../lib/db';
import { getIssuer } from '../../../lib/sso';
import { getClient } from '../../../lib/sso-clients';
import { consumeNonce } from '../../../lib/sso-nonce';
import { checkRateLimit, getClientIp, tooManyRequests } from '../../../lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalizePem(pem: string): string {
  return pem.includes('\\n') ? pem.replace(/\\n/g, '\n') : pem;
}

export async function GET(req: NextRequest) {
  // 레이트리밋(IP 단위) — 검증 로직보다 앞에 둔다. 로그에서 60초 내 id_token을
  // 탈취한 제3자의 반복 조회를 완화(§7.9, 기존 인증 라우트 관례: 10회/분).
  // PII 반환 엔드포인트이므로 레이트리밋 백엔드 오류도 fail-closed(통일 500) —
  // authorize의 fail-open(가용성 우선)과 의도적으로 다르다.
  try {
    const ip = getClientIp(req);
    const rl = await checkRateLimit('sso-userinfo', ip, 10, '1 m');
    if (!rl.success) return tooManyRequests();
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }

  const auth = req.headers.get('authorization') || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const token = m[1].trim();

  // 공개키 로드 실패(SSO_PUBLIC_KEY 미설정/형식 오류)는 인증 실패가 아니라
  // 서버 설정 오류 → 500으로 분리. 토큰 검증 실패만 401로 다룬다.
  let pub: CryptoKey;
  try {
    const pem = process.env.SSO_PUBLIC_KEY;
    if (!pem) throw new Error('SSO_PUBLIC_KEY 환경변수가 설정되지 않았습니다.');
    pub = await importSPKI(normalizePem(pem), 'RS256');
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }

  // id_token 검증: 서명(RS256, 공개키)·iss·exp. 추가로 토큰의 aud가
  // 레지스트리에 등록되고 enabled인 알려진 클라이언트인지 확인(위조 aud 차단).
  // nonce 클레임(lib/sso.ts signIdToken이 payload.nonce로 발급)도 함께 확보한다.
  let email: string;
  let nonce: string;
  try {
    const { payload } = await jwtVerify(token, pub, {
      issuer: getIssuer(),
      algorithms: ['RS256'],
    });
    if (typeof payload.sub !== 'string') {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    if (typeof payload.nonce !== 'string' || !payload.nonce) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    const aud = typeof payload.aud === 'string' ? payload.aud : '';
    const client = aud ? await getClient(aud) : null;
    if (!client) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    email = payload.sub.toLowerCase();
    nonce = payload.nonce;
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // nonce 1회성 소비 가드 — 동일 토큰의 반복 조회를 차단(§6-B1②).
  // consumeNonce는 이미 소비/만료/미존재면 false → 401.
  // lib/sso-nonce.ts 상단 "authorize 흐름을 막지 않도록 방어적" 원칙은 authorize에
  // 한정된다. 여기는 PII를 반환하는 엔드포인트이므로 fail-closed:
  //   DB 오류(catch) 시 통과가 아니라 500으로 막는다.
  let consumed: boolean;
  try {
    consumed = await consumeNonce(nonce);
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
  if (!consumed) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const rows = await sql`
      SELECT name, corporation_name, organization_name, position, email
        FROM users WHERE LOWER(email) = LOWER(${email}) LIMIT 1`;
    const u = rows[0] as Record<string, unknown> | undefined;
    if (!u) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    return NextResponse.json(
      {
        email: u.email,
        name: u.name,
        corporation_name: u.corporation_name,
        organization_name: u.organization_name,
        position: u.position,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
