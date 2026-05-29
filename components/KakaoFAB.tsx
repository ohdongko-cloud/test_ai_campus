"use client";

import { useEffect, useState } from 'react';
import { addClickLog } from '../lib/utils';

const FALLBACK_URL = 'https://open.kakao.com/';

export default function KakaoFAB() {
  const [chatroomUrl, setChatroomUrl] = useState<string>(FALLBACK_URL);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    fetch('/api/settings?keys=chatroom_url')
      .then(r => r.ok ? r.json() : {})
      .then((d: Record<string, unknown>) => {
        const v = d?.chatroom_url;
        if (typeof v === 'string' && v) setChatroomUrl(v);
      })
      .catch(() => { /* keep fallback */ });
  }, []);

  const handleClick = () => {
    addClickLog('오픈채팅방 FAB');
    window.open(chatroomUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <button
      onClick={handleClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label="오픈 채팅방 열기"
      title="AI 오픈 채팅방"
      style={{
        position: 'fixed',
        right: 20, bottom: 20,
        width: 56, height: 56,
        borderRadius: 16,
        border: 'none', cursor: 'pointer',
        background: '#FEE500',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: hover
          ? '0 8px 24px rgba(0,0,0,0.18), 0 4px 8px rgba(0,0,0,0.08)'
          : '0 4px 14px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.06)',
        transform: hover ? 'scale(1.05)' : 'scale(1)',
        transition: 'transform .15s ease, box-shadow .15s ease',
        zIndex: 999,
      }}
      className="kakao-fab"
    >
      {/* 카카오톡 말풍선 아이콘 (정사각형 비율) */}
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M16 5C9.92 5 5 8.92 5 13.7c0 3.1 2.05 5.82 5.13 7.34l-.86 3.15a.5.5 0 0 0 .78.55l3.74-2.49c.74.12 1.51.18 2.21.18 6.08 0 11-3.92 11-8.7C27 8.92 22.08 5 16 5Z"
          fill="#181600"
        />
      </svg>
      <style jsx>{`
        @media (max-width: 640px) {
          .kakao-fab {
            right: 16px !important;
            bottom: 16px !important;
            width: 52px !important;
            height: 52px !important;
          }
        }
      `}</style>
    </button>
  );
}
