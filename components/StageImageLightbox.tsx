"use client";

// 스테이지 인라인 이미지 — 클릭 시 원본 크기 라이트박스.
// ESC / 백드롭 / X 버튼 닫기, 좌/우 화살표로 이동.

import { useEffect } from 'react';

interface Props {
  images: string[];
  index: number;
  onChangeIndex: (next: number) => void;
  onClose: () => void;
}

export default function StageImageLightbox({ images, index, onChangeIndex, onClose }: Props) {
  const total = images.length;
  const url = images[index];

  // 키보드 단축키 + body scroll 잠금
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && index > 0) onChangeIndex(index - 1);
      else if (e.key === 'ArrowRight' && index < total - 1) onChangeIndex(index + 1);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [index, total, onChangeIndex, onClose]);

  if (!url) return null;

  return (
    <div
      onClick={onClose}
      onContextMenu={e => e.preventDefault()}
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      {/* 닫기 버튼 */}
      <button
        onClick={onClose}
        aria-label="닫기"
        style={{
          position: 'absolute', top: 16, right: 16,
          width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(255,255,255,0.15)', color: '#fff',
          border: 'none', cursor: 'pointer', fontSize: 18, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 2,
        }}
      >✕</button>

      {/* 카운터 */}
      {total > 1 && (
        <div style={{
          position: 'absolute', top: 16, left: 16,
          padding: '6px 14px', borderRadius: 999,
          background: 'rgba(255,255,255,0.15)', color: '#fff',
          fontSize: 12, fontWeight: 600, zIndex: 2,
        }}>
          {index + 1} / {total}
        </div>
      )}

      {/* 이전 버튼 */}
      {index > 0 && (
        <button
          onClick={e => { e.stopPropagation(); onChangeIndex(index - 1); }}
          aria-label="이전 이미지"
          style={{
            position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
            width: 44, height: 44, borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)', color: '#fff',
            border: 'none', cursor: 'pointer', zIndex: 2,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
      )}

      {/* 다음 버튼 */}
      {index < total - 1 && (
        <button
          onClick={e => { e.stopPropagation(); onChangeIndex(index + 1); }}
          aria-label="다음 이미지"
          style={{
            position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
            width: 44, height: 44, borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)', color: '#fff',
            border: 'none', cursor: 'pointer', zIndex: 2,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>
      )}

      {/* 이미지 (우클릭 차단 + 드래그 차단) */}
      <div onClick={e => e.stopPropagation()} style={{ maxWidth: '95%', maxHeight: '95%' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={`스테이지 이미지 ${index + 1}`}
          draggable={false}
          onDragStart={e => e.preventDefault()}
          style={{
            maxWidth: '100%', maxHeight: '90vh',
            objectFit: 'contain', display: 'block',
            userSelect: 'none',
            borderRadius: 8, boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
          }}
        />
      </div>
    </div>
  );
}
