'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminFetch } from '../lib/admin-client';

// 관리자 — AI 레벨 매트릭스 (법인/부서/직무별). 첨부 이미지 구조:
// 구분(부서·이름) | 측정지표(목표·점수Lv·전월·성장률) | EBG(이머니·EBG적용) | 행동(코딩·서비스수) | 지식(보안·운영도구·자동화)

interface Row {
  id: string; name: string | null; corporation_name: string | null; organization_name: string | null; position: string | null;
  level: number | null; auto_score: number | null; c1_score: number | null; c2_score: number | null; c3_score: number | null;
  area_ratio: Record<string, number> | null; coding_status: string | null; coding_score: number | null;
  prev_score: number | null; goal: string | null; emoney: string | null; note: string | null;
}

const pct = (r: number | null | undefined) => (r == null ? '-' : Math.round(r * 100));

export default function AdminAiLevelMatrix() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [corp, setCorp] = useState(''); const [dept, setDept] = useState(''); const [position, setPosition] = useState('');
  const [edit, setEdit] = useState<Record<string, { goal: string; emoney: string }>>({});

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await adminFetch('/api/admin/ai-level-matrix');
      const data = await res.json();
      if (!res.ok) { setError(data?.error || '불러오기 실패'); return; }
      setRows(data.items || []);
    } catch { setError('네트워크 오류'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const corps = useMemo(() => [...new Set(rows.map(r => r.corporation_name).filter(Boolean))] as string[], [rows]);
  const depts = useMemo(() => [...new Set(rows.filter(r => !corp || r.corporation_name === corp).map(r => r.organization_name).filter(Boolean))] as string[], [rows, corp]);
  const positions = useMemo(() => [...new Set(rows.filter(r => (!corp || r.corporation_name === corp) && (!dept || r.organization_name === dept)).map(r => r.position).filter(Boolean))] as string[], [rows, corp, dept]);

  const shown = rows.filter(r => (!corp || r.corporation_name === corp) && (!dept || r.organization_name === dept) && (!position || r.position === position));

  const growth = (r: Row) => {
    if (r.prev_score == null || !r.prev_score) return null;
    return Math.round(((Number(r.auto_score) - r.prev_score) / r.prev_score) * 100);
  };
  // 레벨 신호등: 낮음(빨강)·중간(노랑)·높음(초록)
  const lvBg = (lv: number | null) => lv == null ? '#F4F6F9' : lv <= 2 ? '#FDECEC' : lv <= 5 ? '#FFF6E0' : '#E7F6EE';
  const lvFg = (lv: number | null) => lv == null ? '#B6C0CC' : lv <= 2 ? '#A3331F' : lv <= 5 ? '#8A5A00' : '#1F7A4D';

  const exportCsv = () => {
    const head = ['법인', '부서', '직무', '이름', '목표', '레벨', '점수', '전월', '성장률%', '이머니', 'EBG', '코딩', '서비스수', '보안', '운영도구', '자동화'];
    const lines = [head.join(',')];
    for (const r of shown) {
      const g = growth(r);
      const row = [r.corporation_name, r.organization_name, r.position, r.name, r.goal,
        r.level, r.auto_score == null ? '' : Number(r.auto_score).toFixed(0), r.prev_score == null ? '' : Number(r.prev_score).toFixed(0),
        g == null ? '' : g, r.emoney, pct(r.c3_score == null ? null : Number(r.c3_score) / 100),
        r.coding_status === 'scored' ? Number(r.coding_score) : '', pct(r.area_ratio?.service_count),
        pct(r.area_ratio?.security), pct(r.area_ratio?.ops), pct(r.area_ratio?.automation)]
        .map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',');
      lines.push(row);
    }
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ai-level-matrix-${shown.length}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  };

  const saveManual = async (r: Row) => {
    const d = edit[r.id]; if (!d) return;
    try {
      await adminFetch('/api/admin/ai-level-matrix', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: r.id, goal: d.goal, emoney: d.emoney }) });
      setRows(rs => rs.map(x => x.id === r.id ? { ...x, goal: d.goal, emoney: d.emoney } : x));
    } catch { setError('저장 실패'); }
  };

  const sel: React.CSSProperties = { padding: '6px 10px', fontSize: 13, border: '1px solid #D5DBE3', borderRadius: 7, background: '#fff' };
  const th: React.CSSProperties = { padding: '6px 8px', fontSize: 11.5, fontWeight: 700, color: '#33414F', border: '1px solid #E2E6EC', background: '#F4F6F9', whiteSpace: 'nowrap', textAlign: 'center' };
  const td: React.CSSProperties = { padding: '6px 8px', fontSize: 12.5, border: '1px solid #EEF1F5', textAlign: 'center', whiteSpace: 'nowrap' };
  const mini: React.CSSProperties = { width: 64, padding: '4px 6px', border: '1px solid #D5DBE3', borderRadius: 5, fontSize: 12 };
  const cell = (v: number | null | undefined) => { const n = pct(v); return <td style={{ ...td, color: n === '-' ? '#B6C0CC' : '#21384F', background: typeof n === 'number' ? `rgba(27,108,214,${0.04 + (n / 100) * 0.18})` : undefined }}>{n}</td>; };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>AI 레벨 매트릭스 <span style={{ fontSize: 12.5, fontWeight: 500, color: '#8A97A8' }}>({shown.length}명)</span></h2>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <select style={sel} value={corp} onChange={e => { setCorp(e.target.value); setDept(''); setPosition(''); }}>
            <option value="">법인 전체</option>{corps.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select style={sel} value={dept} onChange={e => { setDept(e.target.value); setPosition(''); }}>
            <option value="">부서 전체</option>{depts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select style={sel} value={position} onChange={e => setPosition(e.target.value)}>
            <option value="">직무 전체</option>{positions.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <button onClick={load} style={{ ...sel, cursor: 'pointer', color: '#5B6B7E' }}>새로고침</button>
          <button onClick={exportCsv} disabled={shown.length === 0} style={{ ...sel, cursor: 'pointer', color: '#11447F', borderColor: '#1B6CD6', background: '#EAF1FB', fontWeight: 600 }}>CSV 내보내기</button>
        </div>
      </div>
      {error && <p style={{ color: '#A3331F', fontSize: 13, marginBottom: 8 }}>{error}</p>}
      {loading ? <p style={{ color: '#73839A', fontSize: 13 }}>불러오는 중…</p> : shown.length === 0 ? (
        <p style={{ color: '#73839A', fontSize: 13 }}>응시 결과가 없습니다. (배포 후 직원 응시·마이그레이션 필요)</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', minWidth: 1080 }}>
            <thead>
              <tr>
                <th style={th} colSpan={2}>구분</th>
                <th style={th} colSpan={4}>측정지표</th>
                <th style={th} colSpan={2}>(EBG) 큰 숫자</th>
                <th style={th} colSpan={2}>(행동) 50%</th>
                <th style={th} colSpan={3}>(지식) 10%</th>
              </tr>
              <tr>
                <th style={th}>부서</th><th style={th}>이름</th>
                <th style={th}>목표</th><th style={th}>점수(Lv)</th><th style={th}>전월</th><th style={th}>성장률</th>
                <th style={th}>이머니</th><th style={th}>EBG적용</th>
                <th style={th}>코딩</th><th style={th}>서비스수</th>
                <th style={th}>보안</th><th style={th}>운영도구</th><th style={th}>자동화</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(r => {
                const g = growth(r); const e = edit[r.id] || { goal: r.goal || '', emoney: r.emoney || '' };
                return (
                  <tr key={r.id}>
                    <td style={{ ...td, textAlign: 'left' }}>{r.organization_name || '-'}<div style={{ fontSize: 10.5, color: '#9AA6B5' }}>{r.position || ''}</div></td>
                    <td style={{ ...td, textAlign: 'left', fontWeight: 600 }}>{r.name || '-'}</td>
                    <td style={td}><input style={mini} value={e.goal} placeholder="목표"
                      onChange={ev => setEdit(s => ({ ...s, [r.id]: { ...e, goal: ev.target.value } }))} onBlur={() => saveManual(r)} /></td>
                    <td style={{ ...td, fontWeight: 700, background: lvBg(r.level), color: lvFg(r.level) }}>Lv {r.level ?? '-'}<div style={{ fontSize: 10.5, color: '#8A97A8' }}>{r.auto_score == null ? '' : Number(r.auto_score).toFixed(0) + '점'}</div></td>
                    <td style={{ ...td, color: '#8A97A8' }}>{r.prev_score == null ? '-' : Number(r.prev_score).toFixed(0)}</td>
                    <td style={{ ...td, color: g == null ? '#B6C0CC' : g >= 0 ? '#1F7A4D' : '#A3331F', fontWeight: 600 }}>{g == null ? '-' : (g >= 0 ? '+' : '') + g + '%'}</td>
                    <td style={td}><input style={mini} value={e.emoney} placeholder="이머니"
                      onChange={ev => setEdit(s => ({ ...s, [r.id]: { ...e, emoney: ev.target.value } }))} onBlur={() => saveManual(r)} /></td>
                    {cell(r.c3_score == null ? null : Number(r.c3_score) / 100)}
                    <td style={{ ...td, color: r.coding_status === 'scored' ? '#21384F' : '#B6C0CC' }}>{r.coding_status === 'scored' ? Number(r.coding_score) : '미채점'}</td>
                    {cell(r.area_ratio?.service_count)}
                    {cell(r.area_ratio?.security)}
                    {cell(r.area_ratio?.ops)}
                    {cell(r.area_ratio?.automation)}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p style={{ fontSize: 11.5, color: '#9AA6B5', marginTop: 8 }}>지식·행동·EBG 칸은 0~100 점수. 목표·이머니는 입력 후 칸을 벗어나면 자동 저장됩니다.</p>
        </div>
      )}
    </div>
  );
}
