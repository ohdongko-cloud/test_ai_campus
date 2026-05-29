import { NextRequest } from 'next/server';
import { requireAdmin } from '../../../../lib/admin-auth';
import { checkRateLimit, getClientIp, tooManyRequests } from '../../../../lib/ratelimit';

// POST /api/admin/ping
// 어드민 세션(쿠키 또는 헤더) 검증용. 통과하면 { ok: true }.
export async function POST(req: NextRequest) {
  // 쿠키 미보유 상태에서 헤더로만 시도하는 케이스 차단을 위해 IP 단위 rate limit
  const ip = getClientIp(req);
  const rl = await checkRateLimit('admin-ping', ip, 30, '1 m');
  if (!rl.success) return tooManyRequests();

  const denied = await requireAdmin(req);
  if (denied) return denied;
  return Response.json({ ok: true });
}
