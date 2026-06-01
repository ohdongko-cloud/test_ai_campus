import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../../lib/db';
import { requireMaster, isDenied, getMasterEmails, getActorLabel } from '../../../../../lib/admin-auth';
import { logAdminAction } from '../../../../../lib/audit';

// DELETE /api/admin/members/[id]
// 회원 영구 삭제 (마스터 전용).
//
// 삭제 순서:
//   1. email_verifications (해당 이메일)
//   2. reservations        (해당 이메일)
//   3. users               (해당 id)
//
// 보호 규칙:
//   - 마스터 계정 삭제 불가 (env MASTER_EMAILS 기준)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMaster(req);
  if (isDenied(auth)) return auth;

  const { id } = await params;

  try {
    // 대상 회원 조회
    const rows = await sql`
      SELECT id, email, name, role FROM users WHERE id = ${id} LIMIT 1`;
    const u = rows[0];
    if (!u) {
      return NextResponse.json({ error: '회원을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 마스터 계정 삭제 방지
    const masters = getMasterEmails();
    if (masters.has(String(u.email).toLowerCase())) {
      return NextResponse.json(
        { error: '마스터 계정은 삭제할 수 없습니다.' },
        { status: 403 },
      );
    }

    const email = String(u.email);

    // 1. 인증 이력 삭제
    await sql`DELETE FROM email_verifications WHERE LOWER(email) = LOWER(${email})`;

    // 2. 예약 기록 삭제
    await sql`DELETE FROM reservations WHERE LOWER(email) = LOWER(${email})`;

    // 3. 회원 삭제
    await sql`DELETE FROM users WHERE id = ${id}`;

    await logAdminAction({
      action: 'members.delete',
      targetType: 'user',
      targetId: id,
      detail: {
        actor: getActorLabel(auth),
        email,
        nickname: u.name,
        role: u.role,
      },
      req,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
