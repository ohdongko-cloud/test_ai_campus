import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../lib/db';
import { getCurrentUser } from '../../../lib/session';
import { containsReplacementChar } from '../../../lib/text-validation';
import { checkRateLimit, getClientIp, tooManyRequests } from '../../../lib/ratelimit';
import { reportError } from '../../../lib/error-report';

// GET /api/services — 누구나 조회 가능
export async function GET() {
  try {
    const rows = await sql`
      SELECT id, service_name, description, url, test_account, registered_at
      FROM shared_services
      ORDER BY registered_at DESC`;
    const res = NextResponse.json(rows.map(r => ({
      id: r.id,
      serviceName: r.service_name,
      description: r.description,
      url: r.url,
      testAccount: r.test_account,
      registeredAt: r.registered_at,
    })));
    res.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return res;
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// POST /api/services — 로그인한 회원이면 누구나 공유 가능
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  // 회원당 1시간에 10건 / IP당 10분에 5건 제한
  const ip = getClientIp(req);
  const rlUser = await checkRateLimit('services-post-user', user.uid, 10, '1 h');
  if (!rlUser.success) return tooManyRequests('공유 횟수 제한을 초과했습니다. 잠시 후 다시 시도해주세요.');
  const rlIp = await checkRateLimit('services-post-ip', ip, 5, '10 m');
  if (!rlIp.success) return tooManyRequests();

  const body = await req.json().catch(() => ({}));
  const serviceName = String(body?.serviceName || '').trim();
  const description = String(body?.description || '').trim();
  const url = String(body?.url || '').trim();
  const testAccount = String(body?.testAccount || '').trim();

  if (!serviceName || !description || !url) {
    return NextResponse.json({ error: '서비스 이름, 설명, URL은 필수입니다.' }, { status: 400 });
  }
  if (serviceName.length > 80 || description.length > 1000 || url.length > 2000 || testAccount.length > 500) {
    return NextResponse.json({ error: '입력 항목의 길이가 너무 깁니다.' }, { status: 400 });
  }
  // URL 형식 가벼운 검증
  if (!/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: 'URL은 http:// 또는 https:// 로 시작해야 합니다.' }, { status: 400 });
  }
  // 손상 텍스트(U+FFFD) 거부
  for (const v of [serviceName, description, testAccount]) {
    if (containsReplacementChar(v)) {
      return NextResponse.json({ error: '지원하지 않는 문자가 포함되어 있습니다.' }, { status: 400 });
    }
  }

  try {
    await sql`
      INSERT INTO shared_services (service_name, description, url, test_account, user_id)
      VALUES (${serviceName}, ${description}, ${url}, ${testAccount}, ${user.uid})`;
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    reportError(e, { route: 'services.post', detail: { user: user.uid } });
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
