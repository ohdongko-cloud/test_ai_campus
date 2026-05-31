"use client";

// AI 서비스 공유 등록 모달.
// SharePage 에서 하단 CTA "+ 서비스 공유하기" 버튼 클릭 시 오픈.
// 입력/검증/POST/에러 모두 내부에서 처리 → 성공 시 onSubmitted(serviceName) 호출.

import { useEffect, useRef, useState } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** 등록 성공 시 부모에서 success 토스트 + 목록 갱신 처리 */
  onSubmitted: (serviceName: string) => void;
}

export default function ShareRegisterModal({ isOpen, onClose, onSubmitted }: Props) {
  const [serviceName, setServiceName] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [testAccount, setTestAccount] = useState('');
  const [modalError, setModalError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const firstInputRef = useRef<HTMLInputElement | null>(null);

  // ESC 닫기 + body 스크롤 잠금 + 열림 시 첫 input focus (LegalModal 패턴)
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    // focus 는 한 tick 뒤 (모달 mount 완료 후)
    const t = setTimeout(() => firstInputRef.current?.focus(), 0);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      clearTimeout(t);
    };
  }, [isOpen, onClose]);

  // 모달 닫힐 때 입력값 + 에러 초기화 (다음 오픈 시 깨끗한 상태)
  useEffect(() => {
    if (!isOpen) {
      setServiceName('');
      setDescription('');
      setUrl('');
      setTestAccount('');
      setModalError('');
      setSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const canSubmit = !!serviceName.trim() && !!description.trim() && !!url.trim() && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setModalError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/services', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceName: serviceName.trim(),
          description: description.trim(),
          url: url.trim(),
          testAccount: testAccount.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          setModalError('로그인이 필요합니다. 로그인 후 다시 시도해주세요.');
        } else if (res.status === 429) {
          setModalError(data?.error || '잠시 후 다시 시도해주세요.');
        } else {
          setModalError(data?.error || '등록에 실패했습니다.');
        }
        setSubmitting(false);
        return;
      }
      // 성공 → 부모에게 알리고 모달 닫기 (부모가 토스트 + 목록 갱신)
      onSubmitted(serviceName.trim());
      onClose();
    } catch {
      setModalError('서버 연결에 실패했습니다.');
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(15,30,51,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 16,
          width: '100%', maxWidth: 560,
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
            <h2 id="share-modal-title" style={{
              margin: 0, fontSize: 18, fontWeight: 700, color: '#0F1E33',
              letterSpacing: '-0.01em',
            }}>
              AI 서비스 공유하기
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6B7A91', lineHeight: 1.5 }}>
              회원 누구나 자유롭게 등록할 수 있습니다. 회사 기밀이나 외부 공개 불가 정보는 등록하지 말아주세요.
            </p>
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

        {/* 본문 (스크롤) */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {modalError && (
            <div
              role="alert"
              style={{
                marginBottom: 14,
                background: '#FCE6EA', border: '1px solid #F5B5C0',
                color: '#A51E32', padding: '10px 12px', borderRadius: 8,
                fontSize: 13, lineHeight: 1.5,
              }}
            >
              {modalError}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="서비스 이름" required>
              <input
                ref={firstInputRef}
                type="text"
                value={serviceName}
                onChange={e => setServiceName(e.target.value)}
                placeholder="예: 상품 추천 AI"
                disabled={submitting}
                style={inputStyle}
              />
            </Field>

            <Field label="간단한 설명" required>
              <textarea
                rows={3}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="어떤 문제를 해결하는 서비스인지 간단히 설명해주세요."
                disabled={submitting}
                style={{ ...inputStyle, resize: 'vertical', minHeight: 72 }}
              />
            </Field>

            <Field label="서비스 URL" required>
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://..."
                disabled={submitting}
                style={inputStyle}
              />
            </Field>

            <Field label="테스트 계정 정보" optional>
              <input
                type="text"
                value={testAccount}
                onChange={e => setTestAccount(e.target.value)}
                placeholder="ID: test / PW: 1234"
                disabled={submitting}
                style={inputStyle}
              />
            </Field>
          </div>
        </div>

        {/* 푸터 */}
        <div style={{
          padding: '12px 24px', borderTop: '1px solid #E5EAF1',
          display: 'flex', justifyContent: 'flex-end', gap: 8,
        }}>
          <button
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: '8px 18px', borderRadius: 8,
              border: '1.5px solid #E5EAF1', background: '#fff',
              fontSize: 13, fontWeight: 600, color: '#3B4A63',
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.5 : 1,
            }}
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              padding: '8px 20px', borderRadius: 8, border: 'none',
              background: canSubmit ? '#0F1E33' : '#9BA7BC',
              color: '#fff', fontSize: 13, fontWeight: 700,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
            }}
          >
            {submitting ? '공유 중...' : '공유하기'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 공용 input 스타일 ──
const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  border: '1.5px solid #D4DBE6', borderRadius: 8,
  padding: '9px 12px', fontSize: 13.5, color: '#0F1E33',
  outline: 'none', background: '#fff',
  fontFamily: 'inherit',
};

// ── 라벨 + children 래퍼 ──
function Field({
  label, required, optional, children,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: '#3B4A63' }}>
        {label}
        {required && <span style={{ color: '#D8364C', marginLeft: 4 }}>*</span>}
        {optional && <span style={{ color: '#9BA7BC', marginLeft: 6, fontWeight: 400 }}>(선택)</span>}
      </span>
      {children}
    </label>
  );
}
