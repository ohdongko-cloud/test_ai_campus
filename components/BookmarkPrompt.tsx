"use client";

import { useState, useEffect } from 'react';

// BeforeInstallPromptEvent is not in standard TS lib — declare locally
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface Props {
  show: boolean;
  deferredPrompt: BeforeInstallPromptEvent | null;
  onDismiss: () => void;
}

type OS = 'mac' | 'windows' | 'ios' | 'android' | 'other';

function detectOS(): OS {
  if (typeof window === 'undefined') return 'other';
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Mac/.test(ua)) return 'mac';
  if (/Win/.test(ua)) return 'windows';
  return 'other';
}

const T = {
  primary: '#004A99',
  text: '#0F1E33',
  textMuted: '#6B7A91',
  border: '#E5EAF1',
  surface: '#FFFFFF',
  fontKo: '"Noto Sans KR", "Inter", system-ui, sans-serif',
};

export default function BookmarkPrompt({ show, deferredPrompt, onDismiss }: Props) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<'prompt' | 'guide'>('prompt');
  const [mounted, setMounted] = useState(false);
  const [os, setOs] = useState<OS>('other');

  useEffect(() => {
    setMounted(true);
    setOs(detectOS());
  }, []);

  // Trigger animation when show changes
  useEffect(() => {
    if (!show) {
      setVisible(false);
      setStep('prompt');
      return;
    }
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, [show]);

  if (!mounted || !show) return null;

  const handleAdd = async () => {
    if (deferredPrompt) {
      // Chrome/Edge: trigger native PWA install dialog
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      onDismiss();
    } else {
      // Other browsers: show keyboard/manual guide
      setStep('guide');
    }
  };

  // Guide content varies by OS
  const guideContent = () => {
    if (os === 'ios') {
      return (
        <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.8 }}>
          Safari 하단{' '}
          <strong style={{ color: T.text }}>공유 버튼(□↑)</strong>을 탭한 후<br />
          <strong style={{ color: T.primary }}>&ldquo;홈 화면에 추가&rdquo;</strong>를 선택하세요
        </div>
      );
    }
    const shortcut = os === 'mac' ? '⌘ + D' : 'Ctrl + D';
    return (
      <div>
        <div style={{ fontSize: 12.5, color: T.textMuted, marginBottom: 8 }}>
          키보드 단축키로 즐겨찾기에 추가하세요
        </div>
        <div style={{
          padding: '10px 14px', borderRadius: 8,
          background: '#EEF4FF', border: '1px solid #C7D9F5',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <kbd style={{
            fontSize: 15, fontWeight: 700, color: T.primary,
            fontFamily: '"SFMono-Regular", Consolas, "Courier New", monospace',
            letterSpacing: '0.04em', background: 'none', border: 'none',
          }}>
            {shortcut}
          </kbd>
          <span style={{ fontSize: 12, color: T.textMuted }}>를 눌러주세요</span>
        </div>
      </div>
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="즐겨찾기 추가 안내"
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 60,
        width: 304,
        background: T.surface,
        borderRadius: 16,
        boxShadow: '0 4px 16px rgba(15,30,51,0.10), 0 24px 56px rgba(15,30,51,0.16)',
        border: `1px solid ${T.border}`,
        padding: '20px 20px 18px',
        transform: visible ? 'translateY(0)' : 'translateY(calc(100% + 32px))',
        opacity: visible ? 1 : 0,
        transition: 'transform 380ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 280ms ease',
        fontFamily: T.fontKo,
      }}
    >
      {/* Close button */}
      <button
        onClick={onDismiss}
        style={{
          position: 'absolute', top: 10, right: 10,
          width: 26, height: 26, border: 'none', background: 'transparent',
          cursor: 'pointer', color: T.textMuted, fontSize: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 6,
        }}
        aria-label="닫기"
      >
        ✕
      </button>

      {step === 'prompt' ? (
        <>
          {/* Icon + Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, paddingRight: 20 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
              background: 'linear-gradient(135deg, #004A99 0%, #1B6CD6 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18,
            }}>
              📌
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text, lineHeight: 1.35 }}>
                {deferredPrompt ? '앱으로 설치하시겠어요?' : '즐겨찾기에 추가하시겠어요?'}
              </div>
              <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 2 }}>
                바로가기를 추가하면 빠르게 접속할 수 있어요
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleAdd}
              style={{
                flex: 1, height: 38, borderRadius: 8, border: 'none',
                background: T.primary, color: '#fff',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                fontFamily: T.fontKo,
              }}
            >
              {deferredPrompt ? '앱으로 추가' : os === 'ios' ? '방법 보기' : '추가하기'}
            </button>
            <button
              onClick={onDismiss}
              style={{
                flex: 1, height: 38, borderRadius: 8,
                border: `1px solid ${T.border}`, background: 'transparent',
                color: T.textMuted, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                fontFamily: T.fontKo,
              }}
            >
              다음에
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Guide step */}
          <div style={{ paddingRight: 20, marginBottom: 14 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text, marginBottom: 10 }}>
              {os === 'ios' ? '📱 홈 화면에 추가하기' : '⌨️ 즐겨찾기 추가 방법'}
            </div>
            {guideContent()}
          </div>
          <button
            onClick={onDismiss}
            style={{
              width: '100%', height: 36, borderRadius: 8,
              border: `1px solid ${T.border}`, background: 'transparent',
              color: T.textMuted, fontSize: 13, fontWeight: 500, cursor: 'pointer',
              fontFamily: T.fontKo,
            }}
          >
            확인
          </button>
        </>
      )}
    </div>
  );
}
