import { NextRequest, NextResponse } from 'next/server';
import { clearUserSessionCookie } from '../../../../lib/session';
import { logAuth } from '../../../../lib/audit';

export async function POST(req: NextRequest) {
  await clearUserSessionCookie();
  await logAuth({ type: 'logout', success: true, req });
  return NextResponse.json({ ok: true });
}
