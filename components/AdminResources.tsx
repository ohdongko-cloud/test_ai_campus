"use client";

import { useState, useEffect, useCallback } from 'react';
import { Resource } from '../lib/types';
import { adminFetch } from '../lib/admin-client';

const S = {
  primary: '#2563EB', primaryLight: '#EFF4FF', primaryBorder: '#BFDBFE',
  text: '#0F1E33', textMuted: '#6B7A90', textBody: '#3B4A63',
  border: '#E8EDF5', surface: '#FFFFFF', bg: '#F5F7FA',
  danger: '#D8364C', dangerBg: '#FEE2E2',
  r: 8, r2: 12,
  shadow: '0 1px 4px rgba(0,0,0,0.06)',
};

const iStyle: React.CSSProperties = {
  width: '100%', border: `1.5px solid ${S.border}`, borderRadius: S.r,
  padding: '8px 12px', fontSize: 13, color: S.text,
  outline: 'none', boxSizing: 'border-box', background: S.surface,
};

type LinkType = 'drive' | 'notion' | 'url';

const LINK_TYPE_LABELS: Record<LinkType, string> = {
  drive: '구글 드라이브',
  notion: 'Notion',
  url: '외부 링크',
};

// ────────────────────────── 등록/수정 폼 ──────────────────────────
interface FormState {
  title: string;
  description: string;
  category: string;
  external_url: string;
  is_pinned: boolean;
  sort_order: number;
}

const EMPTY_FORM: FormState = {
  title: '', description: '', category: '', external_url: '', is_pinned: false, sort_order: 0,
};

function ResourceForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: FormState;
  onSave: (f: FormState) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [f, setF] = useState<FormState>(initial);
  const set = (k: keyof FormState, v: string | boolean | number) =>
    setF(prev => ({ ...prev, [k]: v }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 제목 */}
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: S.text, marginBottom: 4 }}>
          제목 <span style={{ color: S.danger }}>*</span>
        </label>
        <input
          value={f.title}
          onChange={e => set('title', e.target.value)}
          placeholder="자료 제목"
          style={iStyle}
        />
      </div>

      {/* 설명 */}
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: S.text, marginBottom: 4 }}>설명</label>
        <textarea
          value={f.description}
          onChange={e => set('description', e.target.value)}
          placeholder="자료에 대한 간단한 설명 (선택)"
          rows={3}
          style={{ ...iStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.55 }}
        />
      </div>

      {/* 카테고리 */}
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: S.text, marginBottom: 4 }}>카테고리</label>
        <input
          value={f.category}
          onChange={e => set('category', e.target.value)}
          placeholder="예: AI 기초, 프롬프트, 코딩 실습 (선택)"
          style={iStyle}
        />
      </div>

      {/* 외부 URL */}
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: S.text, marginBottom: 4 }}>
          외부 링크 <span style={{ color: S.danger }}>*</span>
        </label>
        <input
          value={f.external_url}
          onChange={e => set('external_url', e.target.value)}
          placeholder="https:// 로 시작하는 URL (구글 드라이브·Notion·외부 링크)"
          style={iStyle}
        />
        <p style={{ margin: '4px 0 0', fontSize: 11, color: S.textMuted }}>
          반드시 https:// 로 시작해야 합니다. 링크 유형(드라이브/Notion/URL)은 자동 판별됩니다.
        </p>
      </div>

      {/* 상단고정 + 순서 */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, color: S.text, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={f.is_pinned}
            onChange={e => set('is_pinned', e.target.checked)}
            style={{ width: 16, height: 16, cursor: 'pointer' }}
          />
          상단 고정
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: S.text }}>정렬 순서</label>
          <input
            type="number"
            value={f.sort_order}
            onChange={e => set('sort_order', Number(e.target.value))}
            style={{ ...iStyle, width: 80 }}
          />
        </div>
      </div>

      {/* 버튼 */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
        <button
          onClick={onCancel}
          style={{ padding: '8px 18px', borderRadius: S.r, border: `1.5px solid ${S.border}`, background: S.surface, color: S.textBody, fontSize: 13, cursor: 'pointer' }}
        >
          취소
        </button>
        <button
          onClick={() => onSave(f)}
          disabled={saving}
          style={{ padding: '8px 22px', borderRadius: S.r, border: 'none', background: S.primary, color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
        >
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  );
}

// ────────────────────────── 메인 AdminResources ──────────────────────────
export default function AdminResources() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'list' | 'add' | 'edit'>('list');
  const [editing, setEditing] = useState<Resource | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminFetch('/api/admin/resources');
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error || '자료 목록을 불러오지 못했습니다.');
        setLoading(false);
        return;
      }
      const data: Resource[] = await res.json();
      setResources(data);
    } catch {
      setError('서버 오류가 발생했습니다.');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toast = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 2500);
  };

  const handleAdd = async (f: FormState) => {
    setFormError('');
    if (!f.title.trim()) { setFormError('제목은 필수입니다.'); return; }
    if (!f.external_url.trim()) { setFormError('외부 링크는 필수입니다.'); return; }
    setSaving(true);
    try {
      const res = await adminFetch('/api/admin/resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: f.title.trim(),
          description: f.description.trim() || null,
          category: f.category.trim() || null,
          external_url: f.external_url.trim(),
          is_pinned: f.is_pinned,
          sort_order: f.sort_order,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setFormError(json.error || '서버 오류가 발생했습니다.'); setSaving(false); return; }
      await load();
      setMode('list');
      toast('자료가 등록되었습니다.');
    } catch {
      setFormError('서버 오류가 발생했습니다.');
    }
    setSaving(false);
  };

  const handleEdit = async (f: FormState) => {
    if (!editing) return;
    setFormError('');
    if (!f.title.trim()) { setFormError('제목은 필수입니다.'); return; }
    if (!f.external_url.trim()) { setFormError('외부 링크는 필수입니다.'); return; }
    setSaving(true);
    try {
      const res = await adminFetch(`/api/admin/resources/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: f.title.trim(),
          description: f.description.trim() || null,
          category: f.category.trim() || null,
          external_url: f.external_url.trim(),
          is_pinned: f.is_pinned,
          sort_order: f.sort_order,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setFormError(json.error || '서버 오류가 발생했습니다.'); setSaving(false); return; }
      await load();
      setMode('list');
      setEditing(null);
      toast('자료가 수정되었습니다.');
    } catch {
      setFormError('서버 오류가 발생했습니다.');
    }
    setSaving(false);
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`'${title}' 자료를 삭제할까요? 댓글·좋아요도 함께 삭제됩니다.`)) return;
    try {
      const res = await adminFetch(`/api/admin/resources/${id}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { alert(json.error || '삭제에 실패했습니다.'); return; }
      await load();
      toast('삭제되었습니다.');
    } catch {
      alert('서버 오류가 발생했습니다.');
    }
  };

  const handleTogglePin = async (item: Resource) => {
    try {
      await adminFetch(`/api/admin/resources/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_pinned: !item.is_pinned }),
      });
      await load();
    } catch { /* ignore */ }
  };

  // ── 폼 렌더 ──
  if (mode === 'add') {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 0' }}>
        <button
          onClick={() => { setMode('list'); setFormError(''); }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: S.textMuted, fontSize: 13, cursor: 'pointer', marginBottom: 20, padding: 0 }}
        >
          ← 목록으로
        </button>
        <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, color: S.text }}>자료 등록</h2>
        {formError && (
          <p style={{ margin: '0 0 12px', fontSize: 13, color: S.danger, background: S.dangerBg, padding: '8px 12px', borderRadius: S.r }}>{formError}</p>
        )}
        <ResourceForm initial={EMPTY_FORM} onSave={handleAdd} onCancel={() => { setMode('list'); setFormError(''); }} saving={saving} />
      </div>
    );
  }

  if (mode === 'edit' && editing) {
    const initial: FormState = {
      title: editing.title,
      description: editing.description ?? '',
      category: editing.category ?? '',
      external_url: editing.external_url,
      is_pinned: editing.is_pinned,
      sort_order: editing.sort_order,
    };
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 0' }}>
        <button
          onClick={() => { setMode('list'); setEditing(null); setFormError(''); }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: S.textMuted, fontSize: 13, cursor: 'pointer', marginBottom: 20, padding: 0 }}
        >
          ← 목록으로
        </button>
        <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, color: S.text }}>자료 수정</h2>
        {formError && (
          <p style={{ margin: '0 0 12px', fontSize: 13, color: S.danger, background: S.dangerBg, padding: '8px 12px', borderRadius: S.r }}>{formError}</p>
        )}
        <ResourceForm
          initial={initial}
          onSave={handleEdit}
          onCancel={() => { setMode('list'); setEditing(null); setFormError(''); }}
          saving={saving}
        />
      </div>
    );
  }

  // ── 목록 ──
  return (
    <div>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: S.text }}>자료실 관리</h2>
        <button
          onClick={() => { setMode('add'); setFormError(''); }}
          style={{ padding: '8px 18px', borderRadius: S.r, border: 'none', background: S.primary, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          + 자료 등록
        </button>
      </div>

      {/* 성공 토스트 */}
      {successMsg && (
        <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: S.r, background: '#D1FAE5', color: '#065F46', fontSize: 13, fontWeight: 500 }}>
          {successMsg}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: S.textMuted, fontSize: 14 }}>불러오는 중...</div>
      ) : error ? (
        <div style={{ padding: '16px', background: S.dangerBg, color: S.danger, borderRadius: S.r2, fontSize: 14 }}>{error}</div>
      ) : resources.length === 0 ? (
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: S.r2, padding: '48px 24px', textAlign: 'center', boxShadow: S.shadow }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: S.text }}>등록된 자료가 없습니다</p>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: S.textMuted }}>우측 상단 '+ 자료 등록' 버튼을 눌러 첫 번째 자료를 추가해보세요.</p>
        </div>
      ) : (
        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: S.r2, overflow: 'hidden', boxShadow: S.shadow }}>
          {resources.map((item, idx) => (
            <div
              key={item.id}
              style={{ padding: '16px 20px', borderBottom: idx < resources.length - 1 ? `1px solid ${S.border}` : 'none', display: 'flex', gap: 12, alignItems: 'flex-start' }}
            >
              {/* 고정 표시 */}
              <div style={{ flexShrink: 0, marginTop: 2, fontSize: 14 }}>
                {item.is_pinned ? '📌' : ''}
              </div>

              {/* 본문 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4, alignItems: 'center' }}>
                  {item.category && (
                    <span style={{ padding: '1px 7px', borderRadius: 5, fontSize: 11, fontWeight: 600, color: '#7C3AED', background: '#EDE9FE' }}>{item.category}</span>
                  )}
                  <span style={{ padding: '1px 7px', borderRadius: 5, fontSize: 11, fontWeight: 600, color: '#1A73E8', background: '#E8F0FE' }}>
                    {LINK_TYPE_LABELS[item.link_type]}
                  </span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: S.text, marginBottom: 4, letterSpacing: '-0.01em' }}>
                  {item.title}
                </div>
                {item.description && (
                  <div style={{ fontSize: 12, color: S.textBody, marginBottom: 4, lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>
                    {item.description}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10, fontSize: 11, color: S.textMuted, flexWrap: 'wrap' }}>
                  <span>조회 {item.view_count}</span>
                  <span>좋아요 {item.like_count}</span>
                  <span>댓글 {item.comment_count}</span>
                  <span>순서 {item.sort_order}</span>
                  <a
                    href={item.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{ color: S.primary, textDecoration: 'none', fontWeight: 500 }}
                  >
                    링크 열기 ↗
                  </a>
                </div>
              </div>

              {/* 액션 버튼 */}
              <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={() => handleTogglePin(item)}
                  title={item.is_pinned ? '상단 고정 해제' : '상단 고정'}
                  style={{ padding: '4px 10px', borderRadius: S.r, border: `1px solid ${S.border}`, background: item.is_pinned ? '#FEF3C7' : S.surface, color: item.is_pinned ? '#92400E' : S.textMuted, fontSize: 11, cursor: 'pointer' }}
                >
                  {item.is_pinned ? '고정 해제' : '상단 고정'}
                </button>
                <button
                  onClick={() => { setEditing(item); setMode('edit'); setFormError(''); }}
                  style={{ padding: '4px 10px', borderRadius: S.r, border: `1px solid ${S.border}`, background: S.surface, color: S.textBody, fontSize: 11, cursor: 'pointer' }}
                >
                  수정
                </button>
                <button
                  onClick={() => handleDelete(item.id, item.title)}
                  style={{ padding: '4px 10px', borderRadius: S.r, border: `1px solid #FECACA`, background: S.dangerBg, color: S.danger, fontSize: 11, cursor: 'pointer' }}
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
