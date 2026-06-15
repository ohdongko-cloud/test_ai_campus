'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '../lib/admin-client';

// 관리자 — AI 레벨테스트 코딩(질) 채점.
// 제출물을 클로드코드로 오프라인 리뷰 후 0~100 점수를 입력하면 해당 사용자 총점·레벨이 재산출된다.

interface Item {
  id: string; user_id: string | null; email: string | null;
  submit_kind: string; link_url: string | null; blob_url: string | null; filename: string | null;
  service_desc: string | null; needs_account: boolean | null; test_account: string | null;
  status: string; score: number | null; reviewer_note: string | null; created_at: string;
  name: string | null; organization_name: string | null; position: string | null;
}

export default function AdminAiLevelCoding() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<Record<string, { score: string; note: string }>>({});
  const [savingId, setSavingId] = useState('');
  const [filter, setFilter] = useState<'all' | 'submitted' | 'scored'>('submitted');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await adminFetch('/api/admin/ai-level-coding');
      const data = await res.json();
      if (!res.ok) { setError(data?.error || '불러오기 실패'); return; }
      setItems(data.items || []);
    } catch { setError('네트워크 오류'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (id: string) => {
    const d = draft[id]; if (!d || d.score === '') { setError('점수를 입력해주세요.'); return; }
    const score = Number(d.score);
    if (!Number.isFinite(score) || score < 0 || score > 100) { setError('점수는 0~100.'); return; }
    setSavingId(id); setError('');
    try {
      const res = await adminFetch('/api/admin/ai-level-coding', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, score, note: d.note || '' }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data?.error || '저장 실패'); return; }
      await load();
    } catch { setError('네트워크 오류'); } finally { setSavingId(''); }
  };

  const shown = items.filter(i => filter === 'all' ? true : i.status === filter);
  const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', fontSize: 12, color: '#5B6B7E', borderBottom: '1px solid #E2E6EC', whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { padding: '10px', fontSize: 13, borderBottom: '1px solid #EEF1F5', verticalAlign: 'top' };
  const input: React.CSSProperties = { width: 64, padding: '6px 8px', border: '1px solid #D5DBE3', borderRadius: 6, fontSize: 13 };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>AI 레벨 — 코딩 채점</h2>
          <p style={{ fontSize: 12.5, color: '#6B7888', margin: '4px 0 0' }}>제출물을 클로드코드로 리뷰 후 0~100점 입력 → 해당 사용자 총점·레벨 자동 재산출.</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['submitted', 'scored', 'all'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 12px', fontSize: 12.5, borderRadius: 7, cursor: 'pointer', border: filter === f ? '1.5px solid #1B6CD6' : '1px solid #D5DBE3', background: filter === f ? '#EAF1FB' : '#fff', color: filter === f ? '#11447F' : '#5B6B7E', fontWeight: 600 }}>
              {f === 'submitted' ? '미채점' : f === 'scored' ? '채점완료' : '전체'}
            </button>
          ))}
          <button onClick={load} style={{ padding: '6px 12px', fontSize: 12.5, borderRadius: 7, cursor: 'pointer', border: '1px solid #D5DBE3', background: '#fff', color: '#5B6B7E' }}>새로고침</button>
        </div>
      </div>
      {error && <p style={{ color: '#A3331F', fontSize: 13, marginBottom: 8 }}>{error}</p>}
      {loading ? <p style={{ color: '#73839A', fontSize: 13 }}>불러오는 중…</p> : shown.length === 0 ? (
        <p style={{ color: '#73839A', fontSize: 13 }}>제출물이 없습니다.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
            <thead><tr>
              <th style={th}>제출자</th><th style={th}>서비스 설명</th><th style={th}>산출물</th>
              <th style={th}>계정</th><th style={th}>상태</th><th style={th}>채점</th>
            </tr></thead>
            <tbody>
              {shown.map(i => (
                <tr key={i.id}>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>{i.name || '(이름없음)'}</div>
                    <div style={{ fontSize: 11.5, color: '#8A97A8' }}>{i.organization_name || '-'} · {i.position || '-'}</div>
                  </td>
                  <td style={{ ...td, maxWidth: 220, whiteSpace: 'pre-wrap' }}>{i.service_desc || '-'}</td>
                  <td style={td}>
                    {i.link_url && <a href={i.link_url} target="_blank" rel="noopener noreferrer" style={{ color: '#1B6CD6' }}>링크 열기 ↗</a>}
                    {i.blob_url && <a href={i.blob_url} target="_blank" rel="noopener noreferrer" style={{ color: '#1B6CD6', display: 'block' }}>{i.filename || '파일'} ↓</a>}
                    {!i.link_url && !i.blob_url && '-'}
                  </td>
                  <td style={td}>{i.needs_account ? `필요${i.test_account ? ` · ${i.test_account}` : ''}` : '불필요'}</td>
                  <td style={td}>{i.status === 'scored' ? <span style={{ color: '#1F7A4D' }}>채점 {Number(i.score)}점</span> : <span style={{ color: '#A05A1F' }}>미채점</span>}</td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input style={input} type="number" min={0} max={100} placeholder="0~100"
                        defaultValue={i.score ?? ''}
                        onChange={e => setDraft(d => ({ ...d, [i.id]: { score: e.target.value, note: d[i.id]?.note || i.reviewer_note || '' } }))} />
                      <button onClick={() => save(i.id)} disabled={savingId === i.id}
                        style={{ padding: '6px 12px', fontSize: 12.5, borderRadius: 6, cursor: 'pointer', border: 'none', background: savingId === i.id ? '#9AB6E0' : '#1B6CD6', color: '#fff', fontWeight: 600 }}>
                        {savingId === i.id ? '저장…' : '저장'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
