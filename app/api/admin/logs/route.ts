import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';
import { checkAdmin } from '../../../../lib/admin-auth';

// GET /api/admin/logs?source=auth|audit|access&page=1&type=...
export async function GET(req: NextRequest) {
  const denied = await checkAdmin(req, 'logs');
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const source = searchParams.get('source') || 'auth';
  const page = Math.max(1, Number(searchParams.get('page') || '1'));
  const limit = 50;
  const offset = (page - 1) * limit;
  const filterType = searchParams.get('type') || '';

  try {
    if (source === 'auth') {
      const rows = filterType
        ? await sql`
            SELECT id, type, email, ip, user_agent, success, detail, created_at
            FROM auth_logs WHERE type = ${filterType}
            ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`
        : await sql`
            SELECT id, type, email, ip, user_agent, success, detail, created_at
            FROM auth_logs
            ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
      return NextResponse.json(rows);
    }
    if (source === 'audit') {
      const rows = await sql`
        SELECT id, action, target_type, target_id, ip, detail, created_at
        FROM admin_audit_logs
        ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
      return NextResponse.json(rows);
    }
    if (source === 'access') {
      const rows = await sql`
        SELECT id, session_id, user_id, path, ip, user_agent, created_at
        FROM access_logs
        ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
      return NextResponse.json(rows);
    }
    return NextResponse.json({ error: '잘못된 source' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
