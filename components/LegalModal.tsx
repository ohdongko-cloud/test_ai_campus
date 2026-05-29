"use client";

import { useEffect } from 'react';

interface Props {
  title: string;
  effectiveDate?: string; // 예: '2026.05.26'
  onClose: () => void;
  children: React.ReactNode;
}

export default function LegalModal({ title, effectiveDate, onClose, children }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(15,30,51,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, fontFamily: 'var(--font-sans)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 16,
          width: '100%', maxWidth: 720,
          maxHeight: 'calc(100vh - 32px)',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 16px 40px rgba(15,30,51,0.18)',
        }}
      >
        {/* 헤더 */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid #E5EAF1',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
        }}>
          <div>
            <h2 style={{
              margin: 0, fontSize: 18, fontWeight: 700, color: '#0F1E33',
              letterSpacing: '-0.01em',
            }}>{title}</h2>
            {effectiveDate && (
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6B7A91' }}>
                시행일: {effectiveDate}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            style={{
              width: 32, height: 32, borderRadius: 8, border: 'none',
              background: '#F5F7FA', color: '#6B7A91', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 6l12 12M18 6l-12 12" />
            </svg>
          </button>
        </div>

        {/* 본문 */}
        <div style={{
          padding: '20px 24px 24px', overflowY: 'auto', flex: 1,
          fontSize: 13.5, color: '#3B4A63', lineHeight: 1.75,
        }}>
          {children}
        </div>

        {/* 푸터 */}
        <div style={{
          padding: '12px 24px', borderTop: '1px solid #E5EAF1',
          display: 'flex', justifyContent: 'flex-end',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px', borderRadius: 8,
              border: '1.5px solid #E5EAF1', background: '#fff',
              fontSize: 13, fontWeight: 600, color: '#3B4A63', cursor: 'pointer',
            }}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
