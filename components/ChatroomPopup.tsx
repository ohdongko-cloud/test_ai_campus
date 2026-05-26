"use client";

import { useState, useEffect } from 'react';

interface Props {
  onClose: () => void;
}

export default function ChatroomPopup({ onClose }: Props) {
  const [password, setPassword] = useState('');
  const [rules, setRules] = useState('');
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/settings?keys=chatroom_url,chatroom_password,chatroom_rules');
        if (!res.ok) return;
        const s = await res.json();
        if (typeof s.chatroom_password === 'string') setPassword(s.chatroom_password);
        if (typeof s.chatroom_rules === 'string') setRules(s.chatroom_rules);
        if (typeof s.chatroom_url === 'string') setUrl(s.chatroom_url || 'https://open.kakao.com');
      } catch {
        setUrl('https://open.kakao.com');
      }
    })();
  }, []);

  const handleCopy = () => {
    if (password) {
      navigator.clipboard.writeText(password).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const handleEnter = () => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(15,30,51,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 20,
          width: '100%', maxWidth: 480,
          boxShadow: '0 4px 12px rgba(15,30,51,0.06), 0 16px 40px rgba(15,30,51,0.14)',
          overflow: 'hidden',
        }}
      >
        {/* 헤더 */}
        <div style={{
          background: 'linear-gradient(135deg, #FEF08A 0%, #FDE047 100%)',
          padding: '24px 24px 20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{
                fontSize: 11, fontWeight: 600, color: '#92400E',
                letterSpacing: '0.06em', marginBottom: 4,
              }}>
                카카오톡 오픈채팅방
              </div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1C1917' }}>
                입장 안내
              </h2>
            </div>
            <button
              onClick={onClose}
              style={{
                width: 32, height: 32, borderRadius: 8, border: 'none',
                background: 'rgba(0,0,0,0.12)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#78350F',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M6 6l12 12M18 6l-12 12"/>
              </svg>
            </button>
          </div>
        </div>

        {/* 본문 */}
        <div style={{ padding: '20px 24px 24px' }}>
          {/* 비밀번호 */}
          {password && (
            <div style={{
              background: '#F8FAFC', border: '1.5px solid #E2E8F0',
              borderRadius: 12, padding: '14px 16px', marginBottom: 16,
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748B', marginBottom: 10 }}>
                입장 비밀번호
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  flex: 1, fontSize: 22, fontWeight: 700, letterSpacing: '0.18em',
                  color: '#0F172A', fontFamily: 'monospace',
                }}>
                  {showPw ? password : '•'.repeat(Math.min(password.length, 8))}
                </span>
                <button
                  onClick={() => setShowPw(v => !v)}
                  style={{
                    border: '1px solid #E2E8F0', background: '#fff',
                    borderRadius: 6, cursor: 'pointer',
                    padding: '5px 10px', color: '#64748B', fontSize: 12, fontWeight: 500,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {showPw ? '숨기기' : '보기'}
                </button>
                <button
                  onClick={handleCopy}
                  style={{
                    background: copied ? '#22C55E' : '#0F172A',
                    color: '#fff', border: 'none', borderRadius: 8,
                    padding: '7px 14px', fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', transition: 'background .2s', whiteSpace: 'nowrap',
                  }}
                >
                  {copied ? '복사됨 ✓' : '복사'}
                </button>
              </div>
            </div>
          )}

          {/* 이용 규칙 */}
          {rules && (
            <div style={{
              background: '#FFFBEB', border: '1.5px solid #FDE68A',
              borderRadius: 12, padding: '14px 16px', marginBottom: 20,
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#92400E', marginBottom: 8 }}>
                이용 규칙
              </div>
              <div style={{
                fontSize: 13, color: '#78350F', lineHeight: 1.8,
                whiteSpace: 'pre-line',
              }}>
                {rules}
              </div>
            </div>
          )}

          {/* 버튼 */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={onClose}
              style={{
                flex: 1, background: '#F1F5F9', color: '#64748B',
                border: 'none', borderRadius: 10,
                padding: '12px', fontSize: 14, fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              닫기
            </button>
            <button
              onClick={handleEnter}
              style={{
                flex: 2, background: '#FEE500', color: '#1C1917',
                border: 'none', borderRadius: 10,
                padding: '12px', fontSize: 14, fontWeight: 700,
                cursor: 'pointer', transition: 'opacity .15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              카카오톡 채팅방 입장하기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
