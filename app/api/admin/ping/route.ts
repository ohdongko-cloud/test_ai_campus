import { NextRequest } from 'next/server';
import { requireAdmin } from '../../../../lib/admin-auth';

// POST /api/admin/ping
// 로그인 시 비밀번호 검증용. 통과하면 { ok: true }, 실패하면 401.
export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  return Response.json({ ok: true });
}
