"use client";

import { useEffect, useState } from 'react';
import { adminFetch, AdminAuthError } from '../lib/admin-client';

interface AdminUser {
  id: string;
  nickname: string;
  email: string;
  corporationName: string;
  organizationName: string;
  position: string;
  permissions: Record<string, boolean>;
}

const PERMISSION_LABELS: { key: string; label: string; help: string }[] = [
  { key: 'videos',   label: '영상 관리',     help: '영상/레벨 CRUD' },
  { key: 'meetings', label: '예약 관리',     help: '예약/차단시간' },
  { key: 'services', label: '서비스 공유',   help: '공유 서비스 CRUD' },
  { key: 'chatroom', label: '채팅방·설정',   help: '채팅방 URL, NOA URL 등' },
  { key: 'board',    label: '게시판 관리',   help: '게시판 통계 + 글/댓글 삭제' },
  { key: 'guide',    label: '가이드 편집',   help: '서비스 가이드 CRUD' },
  { key: 'stats',    label: '통계 조회',     help: '대시보드 통계' },
  { key: 'logs',     label: '로그 조회',     help: '인증/감사/접속 로그' },
  { key: 'import',   label: '일괄 임포트',   help: '로컬→DB 일괄 업로드' },
];

export default function AdminUsersManage() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [addEmail, setAddEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const flash = (ok: boolean, text: string) => {
    setMsg({ ok, text });
    setTimeout(() => setMsg(null), 3000);
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/api/admin/users');
      if (!res.ok) {
        if (res.status === 403) flash(false, '마스터 관리자만 접근 가능합니다.');
        else throw new Error(await res.text());
        return;
      }
      setAdmins(await res.json());
    } catch (e) {
      if (e instanceof AdminAuthError) flash(false, '관리자 세션이 만료되었습니다.');
      else flash(false, '관리자 목록 조회에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    const email = addEmail.trim().toLowerCase();
    if (!email) return;
    setBusy(true);
    try {
      const res = await adminFetch('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { flash(false, data?.error || '추가 실패'); return; }
      flash(true, `${email} 을 관리자로 추가했습니다.`);
      setAddEmail('');
      await load();
    } finally {
      setBusy(false);
    }
  };

  const handleTogglePermission = async (admin: AdminUser, key: string) => {
    const newPerms = { ...admin.permissions, [key]: !admin.permissions[key] };
    // optimistic
    setAdmins(list => list.map(a => a.id === admin.id ? { ...a, permissions: newPerms } : a));
    try {
      const res = await adminFetch(`/api/admin/users/${encodeURIComponent(admin.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ permissions: newPerms }),
      });
      if (!res.ok) {
        // rollback
        setAdmins(list => list.map(a => a.id === admin.id ? admin : a));
        flash(false, '권한 변경 실패');
      } else {
        flash(true, '권한이 갱신되었습니다.');
      }
    } catch {
      setAdmins(list => list.map(a => a.id === admin.id ? admin : a));
    }
  };

  const handleRevoke = async (admin: AdminUser) => {
    if (!confirm(`${admin.nickname} (${admin.email}) 의 관리자 권한을 해지하시겠습니까?`)) return;
    try {
      const res = await adminFetch(`/api/admin/users/${encodeURIComponent(admin.id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) { flash(false, '해지 실패'); return; }
      flash(true, '관리자 권한을 해지했습니다.');
      await load();
    } catch {
      flash(false, '해지 실패');
    }
  };

  return (
    <div className="space-y-6">
      {msg && (
        <div style={{
          background: msg.ok ? '#E6F6EE' : '#FCE6EA',
          border: `1px solid ${msg.ok ? '#B2E0C5' : '#FBCBD2'}`,
          color: msg.ok ? '#1E9E6A' : '#D8364C',
          padding: '10px 14px', borderRadius: 8, fontSize: 13,
        }}>{msg.text}</div>
      )}

      {/* 관리자 추가 */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
        <h3 className="text-sm font-bold text-gray-800 mb-3">위임 관리자 추가</h3>
        <p className="text-xs text-gray-500 mb-3">
          가입된 회원의 이메일을 입력하면 관리자로 승격됩니다. 기본 권한은 '다른 관리자 임명' 외 모든 항목입니다.
        </p>
        <div className="flex gap-2">
          <input
            type="email"
            value={addEmail}
            onChange={e => setAddEmail(e.target.value)}
            placeholder="hong.gd@eland.co.kr"
            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none"
            onKeyDown={e => e.key === 'Enter' && !busy && handleAdd()}
          />
          <button
            onClick={handleAdd}
            disabled={busy || !addEmail.trim()}
            className={`px-4 py-2 rounded text-sm font-semibold whitespace-nowrap ${
              busy || !addEmail.trim()
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-black text-white hover:bg-gray-800'
            }`}>
            {busy ? '추가 중...' : '+ 관리자로 추가'}
          </button>
        </div>
      </div>

      {/* 관리자 목록 */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
        <h3 className="text-sm font-bold text-gray-800 mb-3">
          현재 위임 관리자 ({admins.length}명)
        </h3>

        {loading ? (
          <div className="text-center py-6 text-sm text-gray-400">로딩 중...</div>
        ) : admins.length === 0 ? (
          <div className="text-center py-6 text-sm text-gray-400">
            위임 관리자가 없습니다. 위에서 이메일로 추가해보세요.
          </div>
        ) : (
          <div className="space-y-4">
            {admins.map(a => (
              <div key={a.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-sm font-bold text-gray-900">{a.nickname}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{a.email}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {a.corporationName} · {a.organizationName} · {a.position}
                    </div>
                  </div>
                  <button onClick={() => handleRevoke(a)}
                    className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded border border-red-200 hover:bg-red-50">
                    권한 해지
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-100">
                  {PERMISSION_LABELS.map(p => (
                    <label key={p.key} className="flex items-center gap-2 cursor-pointer text-sm py-1">
                      <input
                        type="checkbox"
                        checked={!!a.permissions[p.key]}
                        onChange={() => handleTogglePermission(a, p.key)}
                        className="w-4 h-4 accent-blue-600"
                      />
                      <span title={p.help} className="text-gray-700">{p.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
