"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { GuideGroup, GuideServiceItem, TabType } from '../lib/types';
import { getGuideGroups, setGuideGroups } from '../lib/utils';

interface Props {
  isAdmin?: boolean;
  onNavigate?: (tab: TabType) => void;
}

/* ── Tone system ─────────────────────────────────────────────── */
type ToneKey = 'blue' | 'orange' | 'green' | 'purple' | 'slate' | 'pink' | 'amber';
const TONES: ToneKey[] = ['slate', 'amber', 'blue', 'green', 'purple', 'pink', 'orange'];

const TONE_VARS: Record<ToneKey, { bg: string; ink: string; border: string }> = {
  blue:   { bg: 'var(--tone-blue-bg)',   ink: 'var(--tone-blue-ink)',   border: 'var(--tone-blue-line)'   },
  orange: { bg: 'var(--tone-orange-bg)', ink: 'var(--tone-orange-ink)', border: 'var(--tone-orange-line)' },
  green:  { bg: 'var(--tone-green-bg)',  ink: 'var(--tone-green-ink)',  border: 'var(--tone-green-line)'  },
  purple: { bg: 'var(--tone-purple-bg)', ink: 'var(--tone-purple-ink)', border: 'var(--tone-purple-line)' },
  slate:  { bg: 'var(--tone-slate-bg)',  ink: 'var(--tone-slate-ink)',  border: 'var(--tone-slate-line)'  },
  pink:   { bg: 'var(--tone-pink-bg)',   ink: 'var(--tone-pink-ink)',   border: 'var(--tone-pink-line)'   },
  amber:  { bg: 'var(--tone-amber-bg)',  ink: 'var(--tone-amber-ink)',  border: 'var(--tone-amber-line)'  },
};

const KNOWN_STYLES: Record<string, { monogram: string; tone: ToneKey }> = {
  github:          { monogram: 'Gh', tone: 'slate'  },
  codesandbox:     { monogram: 'Cs', tone: 'amber'  },
  'vs-code':       { monogram: 'Vs', tone: 'blue'   },
  vercel:          { monogram: 'Ve', tone: 'slate'  },
  netlify:         { monogram: 'Nl', tone: 'green'  },
  supabase:        { monogram: 'Sb', tone: 'green'  },
  neon:            { monogram: 'Ne', tone: 'purple' },
  firebase:        { monogram: 'Fb', tone: 'amber'  },
  gcp:             { monogram: 'Gc', tone: 'blue'   },
  aws:             { monogram: 'Aw', tone: 'amber'  },
  azure:           { monogram: 'Az', tone: 'blue'   },
  'google-play':   { monogram: 'Pl', tone: 'green'  },
  appstore:        { monogram: 'Ac', tone: 'slate'  },
  openai:          { monogram: 'Op', tone: 'green'  },
  claude:          { monogram: 'An', tone: 'orange' },
  chatgpt:         { monogram: 'Cg', tone: 'green'  },
  gemini:          { monogram: 'Gm', tone: 'blue'   },
  slack:           { monogram: 'Sl', tone: 'pink'   },
  notion:          { monogram: 'No', tone: 'slate'  },
  figma:           { monogram: 'Fg', tone: 'purple' },
  midjourney:      { monogram: 'Mj', tone: 'purple' },
  suno:            { monogram: 'Su', tone: 'pink'   },
};

function getMonogram(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return words[0][0].toUpperCase() + words[1][0].toLowerCase();
  return name.slice(0, 2);
}

function getItemStyle(id: string, name: string, index: number): { monogram: string; tone: ToneKey } {
  const known = KNOWN_STYLES[id.toLowerCase()];
  if (known) return known;
  return { monogram: getMonogram(name), tone: TONES[index % TONES.length] };
}

/* ── Group metadata ──────────────────────────────────────────── */
const GROUP_META: Record<string, { sub: string; flow: string }> = {
  'dev-env':       { sub: '코드 작성과 버전 관리',          flow: 'Code → Repo → Review'      },
  'deploy':        { sub: '자동 빌드와 배포',               flow: 'Push → Build → Deploy'     },
  'database':      { sub: '데이터 저장, 인증, 리얼타임',    flow: 'DB → Auth → Realtime'      },
  'cloud':         { sub: '확장 가능한 인프라와 AI API 제공', flow: 'Compute → Storage → AI'  },
  'mobile':        { sub: '안드로이드/iOS 앱 배포',         flow: 'Build → Review → Release'  },
  'ai':            { sub: '생성형 AI 및 모델 API',          flow: 'Prompt → Model → Output'   },
  'collaboration': { sub: '팀 커뮤니케이션과 문서화',        flow: 'Chat → Docs → Design'      },
};

/* ── Toast ───────────────────────────────────────────────────── */
function ToastEl({ msg, visible }: { msg: string; visible: boolean }) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', zIndex: 80,
      transform: visible ? 'translate(-50%, 0)' : 'translate(-50%, 20px)',
      opacity: visible ? 1 : 0, pointerEvents: 'none',
      transition: 'transform 240ms cubic-bezier(.2,.8,.2,1), opacity 240ms ease',
      background: 'var(--color-ink)', color: '#fff',
      padding: '12px 18px', borderRadius: 10, fontSize: 13, fontWeight: 500,
      boxShadow: 'var(--shadow-toast)',
      display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap',
    }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        style={{ width: 16, height: 16, color: 'var(--color-secondary)', flexShrink: 0 }}>
        <path d="M5 12l4 4 10-10" />
      </svg>
      {msg}
    </div>
  );
}

/* ── Edit / Add modal ────────────────────────────────────────── */
interface ModalData {
  id: string; name: string; description: string;
  cost: string; url: string; recommended: boolean;
}
const EMPTY_MODAL: ModalData = { id: '', name: '', description: '', cost: '', url: '', recommended: false };

function ServiceModal({ title, data, onSave, onClose }: {
  title: string;
  data: ModalData;
  onSave: (d: ModalData) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ModalData>(data);
  const set = (k: keyof ModalData, v: string | boolean) =>
    setForm(f => ({ ...f, [k]: v }));

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(20,24,31,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: '#fff', borderRadius: 12,
        padding: 28, width: '100%', maxWidth: 480,
        boxShadow: '0 16px 48px rgba(0,0,0,0.22)',
      }}>
        <h2 style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 700, color: 'var(--color-ink)' }}>
          {title}
        </h2>
        {([
          ['name',        '서비스 이름', 'text'],
          ['description', '설명',        'text'],
          ['cost',        '비용 정보',   'text'],
          ['url',         '공식 사이트 URL', 'url'],
        ] as [keyof ModalData, string, string][]).map(([key, label, type]) => (
          <div key={key} style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-ink-2)', marginBottom: 4 }}>
              {label}
            </label>
            <input
              type={type}
              value={form[key] as string}
              onChange={e => set(key, e.target.value)}
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 7, fontSize: 13.5,
                border: '1.5px solid var(--color-line)', background: 'var(--color-bg)',
                color: 'var(--color-ink)', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
        ))}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--color-ink-2)', cursor: 'pointer', marginBottom: 24 }}>
          <input type="checkbox" checked={form.recommended}
            onChange={e => set('recommended', e.target.checked)}
            style={{ width: 15, height: 15 }}
          />
          사내 추천 서비스 ★
        </label>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => onSave(form)}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 8, border: 'none',
              background: 'var(--color-primary)', color: '#fff',
              fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
            }}
          >저장</button>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 8,
              border: '1px solid var(--color-line)', background: 'var(--color-surface)',
              fontSize: 13.5, fontWeight: 500, cursor: 'pointer', color: 'var(--color-ink-2)',
            }}
          >취소</button>
        </div>
      </div>
    </div>
  );
}

/* ── Service card ────────────────────────────────────────────── */
function ServiceCard({ item, index, isEditing, onEdit, onDelete }: {
  item: GuideServiceItem;
  index: number;
  isEditing: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { monogram, tone } = getItemStyle(item.id, item.name, index);
  const t = TONE_VARS[tone];

  const handleClick = (e: React.MouseEvent) => {
    if (isEditing) return;
    e.preventDefault();
    window.open(item.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className="ac-svc"
      onClick={handleClick}
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-line)',
        borderRadius: 'var(--radius)',
        padding: 18, display: 'flex',
        flexDirection: 'column', gap: 12, minHeight: 168,
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {/* Recommended pin */}
      {item.recommended && (
        <span style={{
          position: 'absolute', top: 12, right: 12,
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontFamily: 'var(--font-eng)', fontSize: 10, fontWeight: 600,
          letterSpacing: '0.06em', textTransform: 'uppercase' as const,
          padding: '4px 8px', borderRadius: 4,
          background: 'var(--color-secondary-50)',
          color: 'var(--color-secondary-700)',
        }}>
          <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 10, height: 10 }}>
            <path d="M12 2l2.4 6.5h6.6l-5.3 4 2 6.5L12 15l-5.7 4 2-6.5-5.3-4h6.6z" />
          </svg>
          추천
        </span>
      )}

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Monogram badge */}
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: t.bg, color: t.ink, border: `1px solid ${t.border}`,
          display: 'grid', placeItems: 'center',
          fontFamily: 'var(--font-eng)', fontWeight: 700, fontSize: 14,
          letterSpacing: '-0.01em',
        }}>
          {monogram}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 15.5, fontWeight: 700, letterSpacing: '-0.01em',
            margin: '0 0 2px', color: 'var(--color-ink)',
          }}>
            {item.name}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--color-ink-3)', fontFamily: 'var(--font-eng)' }}>
            {item.cost}
          </div>
        </div>
      </div>

      {/* Description */}
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--color-ink-2)', flex: 1 }}>
        {item.description}
      </p>

      {/* Footer */}
      <div style={{
        marginTop: 'auto', paddingTop: 12,
        borderTop: '1px dashed var(--color-line)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontSize: 12, color: 'var(--color-ink-3)',
      }}>
        <span style={{ fontFamily: 'var(--font-eng)', fontWeight: 500 }}>
          {item.cost.toLowerCase().startsWith('무료') || item.cost.toLowerCase().includes('무료') ? (
            <><span style={{ color: 'var(--color-success-ink)', fontWeight: 600 }}>{item.cost.split('·')[0].trim()}</span>
            {item.cost.includes('·') ? ` · ${item.cost.split('·').slice(1).join('·').trim()}` : ''}</>
          ) : (
            <span style={{ color: 'var(--color-ink-2)' }}>{item.cost}</span>
          )}
        </span>
        <span style={{
          fontFamily: 'var(--font-eng)', fontWeight: 600, fontSize: 12,
          color: 'var(--color-primary)',
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          공식 사이트
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
            <path d="M7 17L17 7M9 7h8v8" />
          </svg>
        </span>
      </div>

      {/* Editing overlay */}
      {isEditing && (
        <div className="ac-svc-edit-overlay">
          <button
            onClick={e => { e.stopPropagation(); onEdit(); }}
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0, fontSize: 11 }}
          >
            편집 ✎
          </button>
          <span style={{ opacity: 0.4 }}>·</span>
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', padding: 0, fontSize: 11 }}
          >
            삭제 🗑
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Group section ───────────────────────────────────────────── */
function GroupSection({ group, groupNum, isEditing, onEditItem, onDeleteItem, onAddItem, sectionRef }: {
  group: GuideGroup;
  groupNum: number;
  isEditing: boolean;
  onEditItem: (item: GuideServiceItem) => void;
  onDeleteItem: (itemId: string) => void;
  onAddItem: () => void;
  sectionRef: (el: HTMLElement | null) => void;
}) {
  const meta = GROUP_META[group.id] ?? { sub: group.description, flow: '' };
  const numStr = String(groupNum).padStart(2, '0');

  return (
    <section
      id={`g${groupNum}`}
      ref={sectionRef}
      style={{
        paddingTop: groupNum === 1 ? 12 : 36,
        paddingBottom: 24,
        borderTop: groupNum === 1 ? 'none' : '1px solid var(--color-line)',
      }}
    >
      {/* Group head */}
      <div className="ac-group-head" style={{
        display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 18,
        alignItems: 'center', marginBottom: 22,
      }}>
        {/* Number tile */}
        <div style={{
          width: 44, height: 44, borderRadius: 10, flexShrink: 0,
          background: 'var(--color-primary-50)', color: 'var(--color-primary)',
          display: 'grid', placeItems: 'center',
          fontFamily: 'var(--font-eng)', fontWeight: 700, fontSize: 15,
          letterSpacing: '-0.01em',
        }}>
          {numStr}
        </div>

        {/* Titles */}
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 4px', color: 'var(--color-ink)' }}>
            {group.name}
          </h2>
          <div style={{
            fontSize: 13, color: 'var(--color-ink-3)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span>{meta.sub}</span>
            {meta.flow && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontFamily: 'var(--font-eng)', fontSize: 11, fontWeight: 500,
                padding: '3px 8px', borderRadius: 999,
                background: 'var(--color-bg)', border: '1px solid var(--color-line)',
                color: 'var(--color-ink-3)',
              }}>
                {meta.flow}
              </span>
            )}
          </div>
        </div>

        {/* Count pill */}
        <div className="ac-group-count" style={{
          fontFamily: 'var(--font-eng)', fontSize: 12, color: 'var(--color-ink-3)',
          padding: '6px 12px', borderRadius: 999,
          border: '1px solid var(--color-line)',
          background: 'var(--color-surface)',
          whiteSpace: 'nowrap',
        }}>
          <span style={{ color: 'var(--color-ink)', fontWeight: 600 }}>{group.items.length}</span> 서비스
        </div>
      </div>

      {/* Cards grid */}
      <div className="ac-services-grid">
        {group.items.map((item, i) => (
          <ServiceCard
            key={item.id}
            item={item}
            index={i}
            isEditing={isEditing}
            onEdit={() => onEditItem(item)}
            onDelete={() => onDeleteItem(item.id)}
          />
        ))}
        {/* Add card (editing mode only) */}
        <div className="ac-add-card" onClick={onAddItem}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ width: 24, height: 24 }}>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v8M8 12h8" />
          </svg>
          서비스 추가
        </div>
      </div>
    </section>
  );
}

/* ── Page component ──────────────────────────────────────────── */
export default function GuidePage({ isAdmin = false, onNavigate }: Props) {
  const [groups, setGroupsState] = useState<GuideGroup[]>([]);
  const [savedGroups, setSavedGroups] = useState<GuideGroup[]>([]);
  const [isEditing, setIsEditing] = useState(false);

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modal state
  const [editModal, setEditModal] = useState<{
    mode: 'edit' | 'add'; groupId: string; item?: GuideServiceItem;
  } | null>(null);

  const groupRefs = useRef<Record<string, HTMLElement | null>>({});

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), 1800);
  }, []);

  useEffect(() => {
    const load = () => { const g = getGuideGroups(); setGroupsState(g); setSavedGroups(g); };
    load();
    window.addEventListener('storage', load);
    return () => window.removeEventListener('storage', load);
  }, []);

  // Toggle body class for CSS-driven edit-mode styles
  useEffect(() => {
    if (isEditing) document.body.classList.add('ac-editing');
    else document.body.classList.remove('ac-editing');
    return () => document.body.classList.remove('ac-editing');
  }, [isEditing]);

  // Stats
  const totalServices = groups.reduce((s, g) => s + g.items.length, 0);
  const totalRecommended = groups.reduce((s, g) => s + g.items.filter(i => i.recommended).length, 0);

  // TOC scroll
  const scrollToGroup = (id: string) => {
    const el = groupRefs.current[id];
    if (el) {
      const y = el.getBoundingClientRect().top + window.pageYOffset - 80;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  // Editing actions
  const startEditing = () => { setSavedGroups(groups); setIsEditing(true); showToast('편집 모드 시작 — 카드를 수정하거나 새 카드를 추가하세요'); };
  const cancelEditing = () => { setGroupsState(savedGroups); setIsEditing(false); };
  const saveEditing = () => {
    setGuideGroups(groups);
    setSavedGroups(groups);
    setIsEditing(false);
    showToast('변경사항이 저장되었습니다');
    window.dispatchEvent(new Event('storage'));
  };

  const handleSaveModal = (data: {
    id: string; name: string; description: string;
    cost: string; url: string; recommended: boolean;
  }) => {
    if (!editModal) return;
    const { mode, groupId, item } = editModal;

    setGroupsState(prev => prev.map(g => {
      if (g.id !== groupId) return g;
      if (mode === 'edit' && item) {
        return { ...g, items: g.items.map(i => i.id === item.id ? { ...i, ...data } : i) };
      }
      // add
      const newItem: GuideServiceItem = {
        id: `${groupId}-${Date.now()}`,
        name: data.name,
        description: data.description,
        cost: data.cost,
        url: data.url,
        recommended: data.recommended,
      };
      return { ...g, items: [...g.items, newItem] };
    }));
    setEditModal(null);
  };

  const handleDeleteItem = (groupId: string, itemId: string) => {
    if (!confirm('이 서비스를 삭제하시겠습니까?')) return;
    setGroupsState(prev => prev.map(g =>
      g.id === groupId ? { ...g, items: g.items.filter(i => i.id !== itemId) } : g
    ));
  };

  return (
    <div style={{ background: 'var(--color-bg)', fontFamily: 'var(--font-sans)', minHeight: '100vh' }}>
      <div className="ac-container">

        {/* ── Page header ── */}
        <div className="ac-sg-page-head" style={{
          padding: '56px 0 36px',
          display: 'grid', gridTemplateColumns: '1fr auto',
          gap: 24, alignItems: 'end',
        }}>
          <div>
            {/* Breadcrumbs */}
            <div style={{
              fontFamily: 'var(--font-eng)', fontSize: 13, color: 'var(--color-ink-3)',
              marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <button
                onClick={() => onNavigate?.('home')}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  fontSize: 13, color: 'var(--color-ink-3)', fontFamily: 'var(--font-eng)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-primary)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-ink-3)')}
              >홈</button>
              <span>›</span>
              <span>만들기</span>
              <span>›</span>
              <span style={{ color: 'var(--color-ink-2)' }}>서비스 가입 가이드</span>
            </div>

            <h1 style={{
              fontSize: 'clamp(32px, 4vw, 44px)',
              lineHeight: 1.15, letterSpacing: '-0.025em',
              margin: '0 0 14px', fontWeight: 700, color: 'var(--color-ink)',
            }}>
              필수 서비스 가입 가이드
            </h1>
            <p style={{ fontSize: 16, lineHeight: 1.55, color: 'var(--color-ink-2)', maxWidth: 680, margin: 0 }}>
              AI 서비스를 구축하기 위한 필수 도구와 플랫폼을 한눈에 안내합니다.
              카테고리별 흐름을 따라가며 필요한 계정과 도구를 차근차근 준비하세요.
            </p>
          </div>

          {/* Action buttons (admin only) */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
            {isAdmin && !isEditing && (
              <button
                onClick={startEditing}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '10px 16px', borderRadius: 8,
                  background: 'var(--color-primary)', color: '#fff',
                  border: '1px solid var(--color-primary)',
                  fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                  <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                </svg>
                서비스 편집
              </button>
            )}
            {isAdmin && isEditing && (
              <button
                onClick={saveEditing}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '10px 16px', borderRadius: 8,
                  background: 'var(--color-primary)', color: '#fff',
                  border: '1px solid var(--color-primary)',
                  fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                  <path d="M5 13l4 4L19 7" />
                </svg>
                편집 완료
              </button>
            )}
          </div>
        </div>

        {/* ── Stats + TOC strip ── */}
        <div className="ac-strip" style={{
          display: 'grid', gridTemplateColumns: '1fr auto', gap: 24,
          alignItems: 'center',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-line)',
          borderRadius: 12, padding: '18px 22px',
          marginBottom: 32,
        }}>
          {/* Stats */}
          <div className="ac-stats" style={{ display: 'flex', gap: 28 }}>
            {[
              { value: String(groups.length), unit: '', label: '카테고리', color: 'var(--color-primary)' },
              { value: String(totalServices), unit: '', label: '필수·추천 서비스', color: 'var(--color-ink)' },
              { value: String(totalRecommended), unit: '', label: '사내 추천', color: 'var(--color-secondary)' },
              { value: '2026.05', unit: '기준', label: '마지막 업데이트', color: 'var(--color-ink)' },
            ].map(({ value, unit, label, color }) => (
              <div key={label}>
                <div style={{
                  fontFamily: 'var(--font-eng)', fontWeight: 700, fontSize: 22,
                  letterSpacing: '-0.02em', color,
                  display: 'flex', alignItems: 'baseline', gap: 2,
                }}>
                  {value}
                  {unit && <span style={{ fontSize: 12, color: 'var(--color-ink-3)', fontWeight: 500, marginLeft: 4 }}>{unit}</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-ink-3)', marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* TOC chips */}
          <nav className="ac-toc" style={{
            display: 'flex', flexWrap: 'wrap', gap: 6,
            justifyContent: 'flex-end', maxWidth: '60%',
          }}>
            {groups.map((g, i) => (
              <button key={g.id}
                onClick={() => scrollToGroup(g.id)}
                style={{
                  fontFamily: 'var(--font-eng)', fontSize: 12, fontWeight: 500,
                  padding: '6px 10px', borderRadius: 6,
                  background: 'var(--color-bg)', color: 'var(--color-ink-2)',
                  border: '1px solid var(--color-line)',
                  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
                  transition: 'all 120ms ease',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = 'var(--color-primary-50)';
                  (e.currentTarget as HTMLElement).style.color = 'var(--color-primary)';
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-primary-50)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = 'var(--color-bg)';
                  (e.currentTarget as HTMLElement).style.color = 'var(--color-ink-2)';
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-line)';
                }}
              >
                <span style={{ fontWeight: 600, color: 'var(--color-ink-3)' }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                {g.name.split('및')[0].split('·')[0].trim().slice(0, 6)}
              </button>
            ))}
          </nav>
        </div>

        {/* ── Admin editing banner ── */}
        {isEditing && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: 'linear-gradient(90deg, #FFF1E6, #FFE4D2)',
            border: '1px solid #F4C9A4',
            borderRadius: 10, padding: '12px 18px',
            marginBottom: 24, color: '#74390B', fontSize: 13.5,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'var(--color-secondary)', color: '#fff',
              display: 'grid', placeItems: 'center', flexShrink: 0,
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
              </svg>
            </div>
            <div>
              <strong>편집 모드</strong> · 카드를 클릭해 내용을 직접 수정하거나, 카드를 추가/삭제하세요.
              일반 사용자에게는 보이지 않습니다.
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexShrink: 0 }}>
              <button
                onClick={cancelEditing}
                style={{
                  background: '#fff', border: '1px solid #F4C9A4',
                  padding: '6px 12px', borderRadius: 6,
                  fontSize: 12, fontWeight: 600, color: '#74390B', cursor: 'pointer',
                }}
              >취소</button>
              <button
                onClick={saveEditing}
                style={{
                  background: 'var(--color-secondary)',
                  border: '1px solid var(--color-secondary)',
                  padding: '6px 12px', borderRadius: 6,
                  fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer',
                }}
              >저장</button>
            </div>
          </div>
        )}

        {/* ── Groups ── */}
        <main style={{ paddingBottom: 80 }}>
          {groups.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '64px 0',
              fontSize: 14, color: 'var(--color-ink-3)',
            }}>
              서비스 목록이 없습니다. 관리자에게 문의하세요.
            </div>
          ) : (
            groups.map((group, gi) => (
              <GroupSection
                key={group.id}
                group={group}
                groupNum={gi + 1}
                isEditing={isEditing}
                sectionRef={el => { groupRefs.current[group.id] = el; }}
                onEditItem={item => setEditModal({ mode: 'edit', groupId: group.id, item })}
                onDeleteItem={itemId => handleDeleteItem(group.id, itemId)}
                onAddItem={() => setEditModal({ mode: 'add', groupId: group.id })}
              />
            ))
          )}
        </main>

      </div>

      {/* Toast */}
      <ToastEl msg={toastMsg} visible={toastVisible} />

      {/* Edit / Add modal */}
      {editModal && (
        <ServiceModal
          title={editModal.mode === 'edit' ? '서비스 수정' : '서비스 추가'}
          data={editModal.item
            ? { id: editModal.item.id, name: editModal.item.name, description: editModal.item.description, cost: editModal.item.cost, url: editModal.item.url, recommended: editModal.item.recommended }
            : EMPTY_MODAL
          }
          onSave={handleSaveModal}
          onClose={() => setEditModal(null)}
        />
      )}
    </div>
  );
}
