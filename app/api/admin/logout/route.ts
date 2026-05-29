import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ADMIN_COOKIE } from '../../../../lib/admin-auth';
import { logAuth } from '../../../../lib/audit';

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE);
  await logAuth({ type: 'logout', success: true, req });
  return NextResponse.json({ ok: true });
}
