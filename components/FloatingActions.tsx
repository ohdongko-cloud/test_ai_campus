"use client";

// 우측 하단 플로팅 액션 버튼 모음.
//   - 위: 안드로이드 앱 다운로드 (URL 미설정 시 숨김)
//   - 아래: 카카오톡 오픈채팅방 입장 (항상 표시)
//
// URL은 app_settings 의 chatroom_url / android_app_url 키.

import { useEffect, useState } from 'react';
import { addClickLog } from '../lib/utils';

const FALLBACK_CHATROOM = 'https://open.kakao.com/';

interface FabProps {
  label: string;
  ariaLabel: string;
  bg: string;
  icon: React.ReactNode;
  onClick: () => void;
}

function FabButton({ label, ariaLabel, bg, icon, onClick }: FabProps) {
  const [hover, setHover] = useState(false);
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 4,
    }}>
      <button
        onClick={onClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        aria-label={ariaLabel}
        title={ariaLabel}
        style={{
          width: 56, height: 56, borderRadius: 16,
          border: 'none', cursor: 'pointer',
          background: bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: hover
            ? '0 8px 24px rgba(0,0,0,0.18), 0 4px 8px rgba(0,0,0,0.08)'
            : '0 4px 14px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.06)',
          transform: hover ? 'scale(1.05)' : 'scale(1)',
          transition: 'transform .15s ease, box-shadow .15s ease',
        }}
        className="ffa-btn"
      >
        {icon}
      </button>
      <span style={{
        fontSize: 10, fontWeight: 700, color: '#0F1E33',
        background: 'rgba(255,255,255,0.92)',
        padding: '2px 8px', borderRadius: 999,
        boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
        whiteSpace: 'nowrap', letterSpacing: '-0.01em',
      }}>
        {label}
      </span>
    </div>
  );
}

export default function FloatingActions() {
  const [chatroomUrl, setChatroomUrl] = useState<string>(FALLBACK_CHATROOM);
  const [androidUrl, setAndroidUrl] = useState<string>('');

  useEffect(() => {
    fetch('/api/settings?keys=chatroom_url,android_app_url')
      .then(r => r.ok ? r.json() : {})
      .then((d: Record<string, unknown>) => {
        const c = d?.chatroom_url;
        if (typeof c === 'string' && c) setChatroomUrl(c);
        const a = d?.android_app_url;
        if (typeof a === 'string' && a) setAndroidUrl(a);
      })
      .catch(() => { /* keep fallback */ });
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        right: 20, bottom: 20,
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
        gap: 14,
        zIndex: 999,
      }}
      className="ffa-wrap"
    >
      {/* 안드로이드 앱 — URL 설정된 경우만 표시 */}
      {androidUrl && (
        <FabButton
          label="안드로이드 앱"
          ariaLabel="AI 캠퍼스 안드로이드 앱 다운로드"
          bg="#1647A8"
          icon={
            // 폰 + 다운로드 화살표 (밝은 색, AI 캠퍼스 앱 식별)
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="9" y="3" width="14" height="26" rx="2.5" stroke="#fff" strokeWidth="2" fill="none" />
              <circle cx="16" cy="25" r="1.2" fill="#fff" />
              <path d="M16 9v7M13 13l3 3 3-3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
          onClick={() => {
            addClickLog('안드로이드 앱 FAB');
            window.open(androidUrl, '_blank', 'noopener,noreferrer');
          }}
        />
      )}

      {/* 카카오톡 오픈채팅방 */}
      <FabButton
        label="소통방 입장"
        ariaLabel="AI 오픈 채팅방 열기"
        bg="#FEE500"
        icon={
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M16 5C9.92 5 5 8.92 5 13.7c0 3.1 2.05 5.82 5.13 7.34l-.86 3.15a.5.5 0 0 0 .78.55l3.74-2.49c.74.12 1.51.18 2.21.18 6.08 0 11-3.92 11-8.7C27 8.92 22.08 5 16 5Z"
              fill="#181600"
            />
          </svg>
        }
        onClick={() => {
          addClickLog('오픈채팅방 FAB');
          window.open(chatroomUrl, '_blank', 'noopener,noreferrer');
        }}
      />

      <style jsx>{`
        @media (max-width: 640px) {
          .ffa-wrap {
            right: 16px !important;
            bottom: 16px !important;
          }
          .ffa-wrap :global(.ffa-btn) {
            width: 52px !important;
            height: 52px !important;
          }
        }
      `}</style>
    </div>
  );
}
