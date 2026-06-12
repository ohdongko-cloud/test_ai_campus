"use client";

import { useEffect, useMemo, useState } from 'react';
import { adminFetch, AdminAuthError } from '../lib/admin-client';
import { ORG_DIRECTORY_CORP } from '../lib/org';

interface Unit {
  id: string;
  corporation_name: string;
  department: string;
  position: string;
  sort_order: number;
  is_active: boolean;
}

const inputStyle: React.CSSProperties = {
  border: '1.5px solid #E2E8F0', borderRadius: 6, padding: '7px 10px',
  fontSize: 13, color: '#0F1E33', outline: 'none', boxSizing: 'border-box', background: '#fff',
};
const btn: React.CSSProperties = {
  border: 'none', borderRadius: 6, padding: '7px 12px', fontSize: 13,
  fontWeight: 600, cursor: 'pointer', background: '#004A99', color: '#fff',
};
const ghost: React.CSSProperties = {
  border: '1.5px solid #E2E8F0', borderRadius: 6, padding: '6px 10px',
  fontSize: 12, cursor: 'pointer', background: '#fff', color: '#475569',
};

export default function AdminOrgUnits() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [authErr, setAuthErr] = useState(false);

  // 신규 부서
  const [newDept, setNewDept] = useState('');
  const [newDeptPos, setNewDeptPos] = useState('');
  // 부서별 직무 추가 입력값
  const [posDraft, setPosDraft] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminFetch(`/api/admin/org-units?corp=${encodeURIComponent(ORG_DIRECTORY_CORP)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data?.error || '불러오기 실패'); return; }
      setUnits(data.units || []);
    } catch (e) {
      if (e instanceof AdminAuthError) setAuthErr(true);
      else setError('서버에 연결할 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // 부서별 그룹 (정렬 순서 유지)
  const grouped = useMemo(() => {
    const map = new Map<string, Unit[]>();
    for (const u of units) {
      const list = map.get(u.department);
      if (list) list.push(u);
      else map.set(u.department, [u]);
    }
    return Array.from(map.entries());
  }, [units]);

  const call = async (init: RequestInit & { url?: string }) => {
    setError('');
    try {
      const res = await adminFetch(init.url || '/api/admin/org-units', init);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data?.error || '처리 실패'); return false; }
      await load();
      return true;
    } catch (e) {
      if (e instanceof AdminAuthError) setAuthErr(true);
      else setError('서버에 연결할 수 없습니다.');
      return false;
    }
  };

  const addDepartment = async () => {
    if (!newDept.trim() || !newDeptPos.trim()) {
      setError('부서명과 첫 직무를 모두 입력해주세요.');
      return;
    }
    const ok = await call({
      method: 'POST',
      body: JSON.stringify({ department: newDept.trim(), position: newDeptPos.trim() }),
    });
    if (ok) { setNewDept(''); setNewDeptPos(''); }
  };

  const addPosition = async (department: string) => {
    const v = (posDraft[department] || '').trim();
    if (!v) return;
    const ok = await call({
      method: 'POST',
      body: JSON.stringify({ department, position: v }),
    });
    if (ok) setPosDraft(d => ({ ...d, [department]: '' }));
  };

  const renamePosition = async (id: string, current: string) => {
    const next = window.prompt('직무명 수정', current);
    if (next == null || next.trim() === current) return;
    await call({ method: 'PATCH', body: JSON.stringify({ id, position: next.trim() }) });
  };

  const renameDepartment = async (from: string) => {
    const to = window.prompt('부서명 수정 (해당 부서의 모든 직무에 반영)', from);
    if (to == null || to.trim() === from || !to.trim()) return;
    await call({ method: 'PATCH', body: JSON.stringify({ action: 'renameDepartment', from, to: to.trim() }) });
  };

  const toggleActive = async (u: Unit) => {
    await call({ method: 'PATCH', body: JSON.stringify({ id: u.id, is_active: !u.is_active }) });
  };

  const deletePosition = async (u: Unit) => {
    if (!window.confirm(`'${u.department} · ${u.position}' 직무를 삭제할까요?`)) return;
    await call({ method: 'DELETE', url: `/api/admin/org-units?id=${encodeURIComponent(u.id)}` });
  };

  const deleteDepartment = async (department: string) => {
    if (!window.confirm(`'${department}' 부서와 모든 직무를 삭제할까요?`)) return;
    await call({ method: 'DELETE', url: `/api/admin/org-units?department=${encodeURIComponent(department)}&corp=${encodeURIComponent(ORG_DIRECTORY_CORP)}` });
  };

  if (authErr) {
    return <div style={{ padding: 24, color: '#D8364C' }}>마스터 관리자 권한이 필요합니다.</div>;
  }

  return (
    <div style={{ padding: 24, color: '#0F1E33' }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px' }}>조직 분류 (부서 / 직무)</h2>
      <p style={{ fontSize: 13, color: '#6B7A91', margin: '0 0 16px' }}>
        회원가입 화면의 <b>{ORG_DIRECTORY_CORP}</b> 부서·직무 드롭다운 목록입니다. 비활성 직무는 가입 폼에 노출되지 않습니다.
      </p>

      {error && <div style={{ background: '#FCE6EA', color: '#D8364C', padding: '8px 12px', borderRadius: 6, fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {/* 신규 부서 추가 */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 20, padding: 12, background: '#F8FAFC', borderRadius: 8 }}>
        <input value={newDept} onChange={e => setNewDept(e.target.value)} placeholder="새 부서명" maxLength={60} style={{ ...inputStyle, flex: '1 1 180px' }} />
        <input value={newDeptPos} onChange={e => setNewDeptPos(e.target.value)} placeholder="첫 직무명" maxLength={60} style={{ ...inputStyle, flex: '1 1 160px' }} />
        <button onClick={addDepartment} style={btn}>＋ 부서 추가</button>
      </div>

      {loading ? (
        <div style={{ color: '#6B7A91', fontSize: 13 }}>불러오는 중…</div>
      ) : grouped.length === 0 ? (
        <div style={{ color: '#6B7A91', fontSize: 13 }}>등록된 부서가 없습니다. 마이그레이션(M006)으로 시드하거나 위에서 추가하세요.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {grouped.map(([dept, list]) => (
            <div key={dept} style={{ border: '1px solid #E8EDF5', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 14px', background: '#F1F5F9' }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{dept} <span style={{ fontWeight: 400, color: '#94A3B8', fontSize: 12 }}>({list.length})</span></div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => renameDepartment(dept)} style={ghost}>부서명 수정</button>
                  <button onClick={() => deleteDepartment(dept)} style={{ ...ghost, color: '#D8364C', borderColor: '#F3C6CE' }}>부서 삭제</button>
                </div>
              </div>
              <div style={{ padding: '8px 14px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {list.map(u => (
                  <span key={u.id} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    border: '1px solid #E2E8F0', borderRadius: 999, padding: '4px 10px',
                    fontSize: 12.5, background: u.is_active ? '#fff' : '#F1F5F9',
                    color: u.is_active ? '#0F1E33' : '#94A3B8',
                    textDecoration: u.is_active ? 'none' : 'line-through',
                  }}>
                    {u.position}
                    <button title={u.is_active ? '비활성화' : '활성화'} onClick={() => toggleActive(u)}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: '#64748B', padding: 0 }}>
                      {u.is_active ? '◓' : '○'}
                    </button>
                    <button title="이름 수정" onClick={() => renamePosition(u.id, u.position)}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: '#64748B', padding: 0 }}>✎</button>
                    <button title="삭제" onClick={() => deletePosition(u)}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: '#D8364C', padding: 0 }}>×</button>
                  </span>
                ))}
                {/* 직무 추가 */}
                <span style={{ display: 'inline-flex', gap: 4 }}>
                  <input
                    value={posDraft[dept] || ''}
                    onChange={e => setPosDraft(d => ({ ...d, [dept]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') addPosition(dept); }}
                    placeholder="직무 추가" maxLength={60}
                    style={{ ...inputStyle, padding: '4px 8px', width: 120 }} />
                  <button onClick={() => addPosition(dept)} style={{ ...ghost, padding: '4px 8px' }}>＋</button>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
