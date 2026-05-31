'use client';

import { useEffect, useState } from 'react';
import { M } from '../_styles/tokens';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { serviceName: string; url: string; testAccount: string; description: string }) => Promise<{ ok: boolean; error?: string }>;
}

function isHttpsUrl(s: string) {
  try {
    const u = new URL(s);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

export default function MobileShareRegisterSheet({ open, onClose, onSubmit }: Props) {
  const [serviceName, setServiceName] = useState('');
  const [url, setUrl] = useState('');
  const [testAccount, setTestAccount] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setServiceName('');
      setUrl('');
      setTestAccount('');
      setDescription('');
      setError('');
    }
  }, [open]);

  // 배경 스크롤 잠금
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  const handleSubmit = async () => {
    setError('');
    const name = serviceName.trim();
    const u = url.trim();
    if (!name) return setError('서비스명을 입력해주세요.');
    if (!isHttpsUrl(u)) return setError('https://로 시작하는 URL을 입력해주세요.');

    setBusy(true);
    const res = await onSubmit({
      serviceName: name,
      url: u,
      testAccount: testAccount.trim(),
      description: description.trim(),
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error || '등록에 실패했습니다.');
      return;
    }
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal
      aria-label="서비스 공유 등록"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'rgba(15,30,51,0.55)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: M.maxW,
          maxHeight: '85vh',
          background: M.surface,
          borderRadius: `${M.r5}px ${M.r5}px 0 0`,
          padding: '12px 16px 16px',
          paddingBottom: `calc(16px + ${M.safeBottom})`,
          fontFamily: M.fontKo,
          overflowY: 'auto',
          boxShadow: M.shadowLg,
        }}
      >
        {/* 핸들 */}
        <div
          aria-hidden
          style={{
            width: 40,
            height: 4,
            borderRadius: 2,
            background: M.borderStrong,
            margin: '4px auto 16px',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: M.text, margin: 0 }}>서비스 공유</h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: 22,
              color: M.textMuted,
              cursor: 'pointer',
              lineHeight: 1,
              padding: 4,
            }}
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <p style={{ fontSize: 13, color: M.textBody, margin: '0 0 16px', lineHeight: 1.6 }}>
          내가 만든 AI 서비스나 동료에게 추천하고 싶은 서비스를 공유해주세요.<br />
          <span style={{ color: M.danger, fontSize: 12 }}>회사 기밀이나 외부 비공개 정보는 등록 금지.</span>
        </p>

        <Field label="서비스명">
          <input
            type="text"
            value={serviceName}
            onChange={(e) => setServiceName(e.target.value)}
            placeholder="예) Claude로 만든 사내 챗봇"
            style={inputStyle}
            maxLength={80}
            autoFocus
          />
        </Field>

        <Field label="URL">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            style={inputStyle}
            inputMode="url"
            autoComplete="off"
          />
        </Field>

        <Field label="테스트 계정 (선택)">
          <input
            type="text"
            value={testAccount}
            onChange={(e) => setTestAccount(e.target.value)}
            placeholder="공유 가능한 데모 계정/비번 (선택)"
            style={inputStyle}
            autoComplete="off"
          />
        </Field>

        <Field label="설명 (선택)">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="어떤 서비스인지, 어떤 점이 좋은지 짧게 적어주세요"
            style={{ ...inputStyle, minHeight: 80, resize: 'vertical', paddingTop: 12 }}
            maxLength={500}
          />
        </Field>

        {error && (
          <div
            role="alert"
            style={{
              background: M.dangerBg,
              color: M.danger,
              fontSize: 13,
              padding: '10px 12px',
              borderRadius: M.r2,
              margin: '0 0 12px',
            }}
          >
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={busy}
          style={{
            width: '100%',
            height: 52,
            borderRadius: M.r3,
            border: 'none',
            background: M.primary,
            color: '#fff',
            fontSize: 16,
            fontWeight: 700,
            cursor: busy ? 'not-allowed' : 'pointer',
            opacity: busy ? 0.6 : 1,
            fontFamily: M.fontKo,
          }}
        >
          {busy ? '등록 중...' : '공유하기'}
        </button>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 52,
  padding: '0 14px',
  borderRadius: M.r3,
  border: `1.5px solid ${M.border}`,
  background: M.surfaceAlt,
  fontSize: 15,
  color: '#0F1E33',
  outline: 'none',
  boxSizing: 'border-box' as const,
  fontFamily: '"Noto Sans KR", "Inter", system-ui, sans-serif',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: M.textMuted, marginBottom: 6 }}>
        {label}
      </span>
      {children}
    </label>
  );
}
