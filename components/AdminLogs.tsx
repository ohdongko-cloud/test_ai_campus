"use client";

import { useEffect, useState } from 'react';
import { adminFetch, AdminAuthError } from '../lib/admin-client';

type Source = 'auth' | 'audit' | 'access';

interface AuthRow { id: number; type: string; email: string|null; ip: string|null; user_agent: string|null; success: boolean; detail: string|null; created_at: string }
interface AuditRow { id: number; action: string; target_type: string|null; target_id: string|null; ip: string|null; detail: unknown; created_at: string }
interface AccessRow { id: number; session_id: string|null; user_id: string|null; path: string|null; ip: string|null; user_agent: string|null; created_at: string }

const AUTH_TYPES = ['', 'login_attempt', 'login_success', 'login_failure', 'signup_request', 'signup_verify_success', 'signup_verify_failure', 'signup_complete', 'admin_login_success', 'admin_login_failure', 'rate_limited', 'logout'];

function fmtTime(iso: string): string {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch { return iso; }
}

export default function AdminLogs() {
  const [source, setSource] = useState<Source>('auth');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<(AuthRow|AuditRow|AccessRow)[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const load = async () => {
    setLoading(true);
    setErr('');
    try {
      const url = `/api/admin/logs?source=${source}&page=${page}${source==='auth' && type ? `&type=${encodeURIComponent(type)}` : ''}`;
      const res = await adminFetch(url);
      if (!res.ok) throw new Error(await res.text());
      setRows(await res.json());
    } catch (e) {
      if (e instanceof AdminAuthError) setErr('관리자 세션이 만료되었습니다.');
      else setErr('로그 조회에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [source, type, page]);

  const Tab = ({ k, label }: { k: Source; label: string }) => (
    <button
      onClick={() => { setSource(k); setPage(1); setType(''); }}
      style={{
        padding: '8px 14px', borderRadius: 8,
        border: `1.5px solid ${source === k ? '#0F1E33' : '#E5EAF1'}`,
        background: source === k ? '#0F1E33' : '#fff',
        color: source === k ? '#fff' : '#3B4A63',
        fontSize: 13, fontWeight: 600, cursor: 'pointer',
      }}>
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Tab k="auth"   label="인증 로그" />
        <Tab k="audit"  label="관리자 작업" />
        <Tab k="access" label="접속 로그" />
      </div>

      {source === 'auth' && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#6B7A91' }}>유형:</span>
          <select value={type} onChange={e => { setType(e.target.value); setPage(1); }}
            style={{
              padding: '6px 10px', border: '1px solid #E5EAF1', borderRadius: 6,
              fontSize: 13, color: '#0F1E33', background: '#fff', outline: 'none',
            }}>
            {AUTH_TYPES.map(t => <option key={t || 'all'} value={t}>{t || '전체'}</option>)}
          </select>
        </div>
      )}

      {err && (
        <div style={{ background: '#FCE6EA', border: '1px solid #FBCBD2', padding: 10, borderRadius: 8, color: '#D8364C', fontSize: 13 }}>
          {err}
        </div>
      )}

      <div style={{ background: '#fff', border: '1px solid #E5EAF1', borderRadius: 12, padding: 16 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 24, color: '#9BA7BC', fontSize: 13 }}>로딩 중...</div>
        ) : rows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: '#9BA7BC', fontSize: 13 }}>로그가 없습니다.</div>
        ) : source === 'auth' ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#F5F7FA' }}>
                {['시각', '유형', '결과', '이메일', 'IP', '상세'].map(h => (
                  <th key={h} style={{ padding: 8, textAlign: 'left', fontWeight: 600, color: '#3B4A63', borderBottom: '1px solid #E5EAF1' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(rows as AuthRow[]).map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid #F5F7FA' }}>
                  <td style={{ padding: 8, whiteSpace: 'nowrap', color: '#0F1E33' }}>{fmtTime(r.created_at)}</td>
                  <td style={{ padding: 8, color: '#3B4A63' }}>{r.type}</td>
                  <td style={{ padding: 8 }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                      background: r.success ? '#E6F6EE' : '#FCE6EA',
                      color: r.success ? '#1E9E6A' : '#D8364C',
                    }}>
                      {r.success ? '성공' : '실패'}
                    </span>
                  </td>
                  <td style={{ padding: 8, color: '#3B4A63', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.email || '-'}</td>
                  <td style={{ padding: 8, color: '#6B7A91', fontFamily: 'monospace' }}>{r.ip || '-'}</td>
                  <td style={{ padding: 8, color: '#6B7A91', fontSize: 11 }}>{r.detail || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : source === 'audit' ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#F5F7FA' }}>
                {['시각', '액션', '대상', 'IP', '상세'].map(h => (
                  <th key={h} style={{ padding: 8, textAlign: 'left', fontWeight: 600, color: '#3B4A63', borderBottom: '1px solid #E5EAF1' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(rows as AuditRow[]).map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid #F5F7FA' }}>
                  <td style={{ padding: 8, whiteSpace: 'nowrap', color: '#0F1E33' }}>{fmtTime(r.created_at)}</td>
                  <td style={{ padding: 8, color: '#3B4A63', fontWeight: 600 }}>{r.action}</td>
                  <td style={{ padding: 8, color: '#6B7A91' }}>{r.target_type ? `${r.target_type}/${r.target_id || '-'}` : '-'}</td>
                  <td style={{ padding: 8, color: '#6B7A91', fontFamily: 'monospace' }}>{r.ip || '-'}</td>
                  <td style={{ padding: 8, color: '#6B7A91', fontSize: 11, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.detail ? JSON.stringify(r.detail) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#F5F7FA' }}>
                {['시각', '경로', 'IP', 'UA'].map(h => (
                  <th key={h} style={{ padding: 8, textAlign: 'left', fontWeight: 600, color: '#3B4A63', borderBottom: '1px solid #E5EAF1' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(rows as AccessRow[]).map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid #F5F7FA' }}>
                  <td style={{ padding: 8, whiteSpace: 'nowrap', color: '#0F1E33' }}>{fmtTime(r.created_at)}</td>
                  <td style={{ padding: 8, color: '#3B4A63' }}>{r.path || '/'}</td>
                  <td style={{ padding: 8, color: '#6B7A91', fontFamily: 'monospace' }}>{r.ip || '-'}</td>
                  <td style={{ padding: 8, color: '#6B7A91', fontSize: 11, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.user_agent || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center' }}>
        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || loading}
          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #E5EAF1', background: '#fff', cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: 12 }}>← 이전</button>
        <span style={{ fontSize: 13, color: '#6B7A91' }}>페이지 {page}</span>
        <button onClick={() => setPage(p => p + 1)} disabled={rows.length < 50 || loading}
          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #E5EAF1', background: '#fff', cursor: rows.length < 50 ? 'not-allowed' : 'pointer', fontSize: 12 }}>다음 →</button>
      </div>
    </div>
  );
}
