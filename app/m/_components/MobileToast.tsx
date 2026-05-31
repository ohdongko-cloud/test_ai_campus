'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { M } from '../_styles/tokens';

type ToastKind = 'info' | 'success' | 'error' | 'warn';

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  action?: { label: string; onClick: () => void };
}

interface Ctx {
  show: (message: string, opts?: { kind?: ToastKind; action?: Toast['action']; ttl?: number }) => void;
  error: (message: string, action?: Toast['action']) => void;
  success: (message: string) => void;
}

const ToastCtx = createContext<Ctx | null>(null);

export function useToast(): Ctx {
  const ctx = useContext(ToastCtx);
  if (!ctx) {
    // SSR or 사용 위치가 Provider 밖 — no-op 안전 처리
    return {
      show: () => {},
      error: () => {},
      success: () => {},
    };
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts(t => t.filter(x => x.id !== id));
  }, []);

  const show: Ctx['show'] = useCallback(
    (message, opts) => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      const t: Toast = {
        id,
        kind: opts?.kind || 'info',
        message,
        action: opts?.action,
      };
      setToasts(prev => [...prev, t]);
      const ttl = opts?.ttl ?? 4000;
      if (ttl > 0) {
        window.setTimeout(() => remove(id), ttl);
      }
    },
    [remove]
  );

  const ctx = useMemo<Ctx>(
    () => ({
      show,
      error: (m, action) => show(m, { kind: 'error', action }),
      success: m => show(m, { kind: 'success' }),
    }),
    [show]
  );

  return (
    <ToastCtx.Provider value={ctx}>
      {children}
      <div
        aria-live="polite"
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: `calc(${M.tabBarH}px + env(safe-area-inset-bottom, 0px) + 12px)`,
          zIndex: 200,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          pointerEvents: 'none',
          padding: '0 16px',
        }}
      >
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const palette: Record<ToastKind, { bg: string; fg: string; border: string }> = {
    info: { bg: M.text, fg: '#fff', border: 'rgba(255,255,255,0.1)' },
    success: { bg: M.success, fg: '#fff', border: 'rgba(255,255,255,0.1)' },
    error: { bg: M.danger, fg: '#fff', border: 'rgba(255,255,255,0.1)' },
    warn: { bg: M.warn, fg: '#fff', border: 'rgba(255,255,255,0.1)' },
  };
  const p = palette[toast.kind];

  // 마운트 시 살짝 슬라이드 업
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setVisible(true), 20);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div
      role="status"
      style={{
        pointerEvents: 'auto',
        maxWidth: 480,
        width: '100%',
        background: p.bg,
        color: p.fg,
        border: `1px solid ${p.border}`,
        borderRadius: M.r3,
        padding: '12px 14px',
        fontSize: 13,
        fontWeight: 600,
        boxShadow: M.shadowLg,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
        opacity: visible ? 1 : 0,
        transition: 'opacity 180ms ease, transform 180ms ease',
        fontFamily: M.fontKo,
      }}
    >
      <span style={{ flex: 1 }}>{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action?.onClick();
            onClose();
          }}
          style={{
            background: 'rgba(255,255,255,0.18)',
            border: 'none',
            color: '#fff',
            padding: '6px 10px',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: M.fontKo,
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        onClick={onClose}
        aria-label="닫기"
        style={{
          width: 24,
          height: 24,
          background: 'transparent',
          border: 'none',
          color: '#fff',
          cursor: 'pointer',
          fontSize: 14,
          fontWeight: 700,
          padding: 0,
        }}
      >
        ✕
      </button>
    </div>
  );
}
