"use client";

import { useEffect, useMemo, useRef, useState, CSSProperties } from 'react';

interface Props {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  disabledHint?: string;          // 비활성 시 트리거에 표시할 안내문
  allowCustom?: boolean;          // '기타 직접입력' 허용 (기본 true)
  customLabel?: string;           // 기타 직접입력 항목 라벨
  backToListLabel?: string;       // 직접입력 → 목록 복귀 라벨
  customPlaceholder?: string;     // 직접입력 input placeholder
  maxLength?: number;
  triggerStyle?: CSSProperties;   // 닫힌 상태 트리거 스타일(다른 input과 일치시키기)
  ariaLabel?: string;
}

const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase();

const PANEL: CSSProperties = {
  position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
  background: '#fff', border: '1px solid #CBD5E1', borderRadius: 8,
  boxShadow: '0 8px 24px rgba(15,30,51,0.14)', overflow: 'hidden',
};

export default function SearchableSelect({
  options, value, onChange,
  placeholder = '선택하세요',
  disabled = false,
  disabledHint,
  allowCustom = true,
  customLabel = '+ 기타 직접입력',
  backToListLabel = '목록에서 선택',
  customPlaceholder = '직접 입력',
  maxLength = 40,
  triggerStyle,
  ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hi, setHi] = useState(0);
  // 직접입력 모드: 사용자가 '기타 직접입력'을 골랐거나, value가 옵션에 없을 때.
  const [custom, setCustom] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const inOptions = useMemo(() => options.includes(value), [options, value]);

  // value가 옵션 밖의 값(직접입력 결과)으로 들어오면 직접입력 모드 유지
  useEffect(() => {
    if (value && !inOptions && allowCustom) setCustom(true);
  }, [value, inOptions, allowCustom]);

  const filtered = useMemo(() => {
    const q = norm(query);
    if (!q) return options;
    return options.filter(o => norm(o).includes(q));
  }, [options, query]);

  useEffect(() => { setHi(0); }, [query, open]);

  // 외부 클릭 닫기
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // 열릴 때 검색창 포커스
  useEffect(() => {
    if (open) { setQuery(''); setTimeout(() => searchRef.current?.focus(), 0); }
  }, [open]);

  const pick = (v: string) => { onChange(v); setOpen(false); };

  const enterCustom = () => { setCustom(true); setOpen(false); onChange(''); };
  const backToList = () => { setCustom(false); onChange(''); };

  const baseTrigger: CSSProperties = {
    width: '100%', textAlign: 'left', cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    background: disabled ? '#F1F5F9' : '#fff',
    color: value ? '#0F1E33' : '#94A3B8',
    ...triggerStyle,
  };

  // ── 직접입력 모드 ──
  if (custom && !disabled) {
    return (
      <div ref={rootRef} style={{ position: 'relative' }}>
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={customPlaceholder}
          maxLength={maxLength}
          aria-label={ariaLabel}
          style={{ ...triggerStyle, width: '100%', boxSizing: 'border-box' }}
        />
        {allowCustom && (
          <button type="button" onClick={backToList}
            style={{ marginTop: 6, background: 'none', border: 'none', padding: 0,
              color: '#2563EB', fontSize: 12, cursor: 'pointer' }}>
            ← {backToListLabel}
          </button>
        )}
      </div>
    );
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[hi]) pick(filtered[hi]);
      else if (allowCustom) enterCustom();
    } else if (e.key === 'Escape') { setOpen(false); }
  };

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <div
        role="button" tabIndex={disabled ? -1 : 0}
        aria-label={ariaLabel} aria-disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        onKeyDown={e => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setOpen(o => !o); } }}
        style={baseTrigger}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value || (disabled ? (disabledHint || placeholder) : placeholder)}
        </span>
        <span style={{ flexShrink: 0, color: '#94A3B8', fontSize: 12 }}>▾</span>
      </div>

      {open && !disabled && (
        <div style={PANEL}>
          <div style={{ padding: 8, borderBottom: '1px solid #EEF2F7' }}>
            <input
              ref={searchRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="검색…"
              style={{
                width: '100%', boxSizing: 'border-box', border: '1px solid #E2E8F0',
                borderRadius: 6, padding: '7px 10px', fontSize: 13, outline: 'none', color: '#0F1E33',
              }}
            />
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {filtered.length === 0 && (
              <div style={{ padding: '10px 12px', fontSize: 13, color: '#94A3B8' }}>결과 없음</div>
            )}
            {filtered.map((o, i) => (
              <div
                key={o}
                onMouseEnter={() => setHi(i)}
                onClick={() => pick(o)}
                style={{
                  padding: '9px 12px', fontSize: 13, cursor: 'pointer',
                  background: i === hi ? '#EFF4FF' : '#fff',
                  color: o === value ? '#2563EB' : '#0F1E33',
                  fontWeight: o === value ? 600 : 400,
                }}
              >
                {o}
              </div>
            ))}
          </div>
          {allowCustom && (
            <div
              onClick={enterCustom}
              style={{
                padding: '10px 12px', fontSize: 13, cursor: 'pointer',
                borderTop: '1px solid #EEF2F7', color: '#2563EB', fontWeight: 500, background: '#F8FAFF',
              }}
            >
              {customLabel}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
