'use client';

import { M } from '../_styles/tokens';

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export default function MobileSearchBar({ value, onChange, placeholder = '검색' }: Props) {
  return (
    <div
      style={{
        position: 'relative',
        margin: '0 16px',
      }}
    >
      <input
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          height: 48,
          padding: '0 16px 0 44px',
          borderRadius: 14,
          border: `1px solid ${M.border}`,
          background: M.surface,
          fontSize: 14,
          color: M.text,
          outline: 'none',
          boxSizing: 'border-box',
          fontFamily: M.fontKo,
          appearance: 'none',
        }}
      />
      {/* 돋보기 아이콘 (원 + 핸들) */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: '50%',
          left: 16,
          transform: 'translateY(-50%)',
          width: 18,
          height: 18,
          borderRadius: 9,
          border: `2px solid ${M.textMuted}`,
          boxSizing: 'border-box',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: '50%',
          left: 30,
          transform: 'translateY(0) rotate(45deg)',
          width: 8,
          height: 2,
          background: M.textMuted,
          borderRadius: 1,
        }}
      />
    </div>
  );
}
