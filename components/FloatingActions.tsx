"use client";

// 우측 하단 플로팅 액션 버튼 모음.
//   - 최상단: 미팅요청 (onNavigate prop 시 노출, 내부 #meeting 탭으로 이동)
//   - 중간:   안드로이드 앱 다운로드
//             · Android 기기  → Play Store / APK URL 직접 오픈
//             · PC / iOS 등   → 카카오톡 공유 다이얼로그 (Kakao SDK)
//   - 하단:   카카오톡 오픈채팅방 입장 (항상 표시)
//
// URL은 app_settings 의 chatroom_url / android_app_url 키.

import { useEffect, useState } from 'react';
import { addClickLog } from '../lib/utils';

// Kakao SDK 타입 선언 (전역)
declare global {
  interface Window {
    Kakao?: {
      isInitialized(): boolean;
      init(appKey: string): void;
      Share: {
        sendDefault(params: Record<string, unknown>): void;
      };
    };
  }
}

/** Android 기기 여부 판별 */
function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
}

const FALLBACK_CHATROOM = 'https://open.kakao.com/';

type NavigableTab = 'meeting';

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
    // width를 버튼과 같은 56px(모바일 52px)로 고정 → 모든 버튼이 우측 끝에 일렬 정렬됨.
    // 라벨은 박스 중앙 기준으로 좌우 overflow 허용(글자 수가 달라도 버튼 위치는 변동 X).
    <div className="ffa-item" style={{
      width: 56,
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

interface Props {
  onNavigate?: (tab: NavigableTab) => void;
}

export default function FloatingActions({ onNavigate }: Props = {}) {
  const [chatroomUrl, setChatroomUrl] = useState<string>(FALLBACK_CHATROOM);
  const [androidUrl, setAndroidUrl] = useState<string>('');
  const [showKakaoConfirm, setShowKakaoConfirm] = useState(false);

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
      {/* 미팅요청 — 멘토링 예약 페이지로 이동 (onNavigate prop 있을 때만) */}
      {onNavigate && (
        <FabButton
          label="미팅요청"
          ariaLabel="멘토링 예약 페이지로 이동"
          bg="#FF914D"
          icon={
            // 트렌디한 캘린더 + 체크마크 SVG (예약 확정 메타포)
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* 캘린더 본체 */}
              <rect x="5" y="8" width="22" height="19" rx="3" stroke="#fff" strokeWidth="2" fill="none" />
              {/* 상단 헤더 라인 */}
              <line x1="5" y1="13" x2="27" y2="13" stroke="#fff" strokeWidth="2" />
              {/* 상단 걸이 2개 */}
              <line x1="11" y1="5" x2="11" y2="10" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
              <line x1="21" y1="5" x2="21" y2="10" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
              {/* 본체 안 체크마크 */}
              <path d="M11 20l3.5 3 6.5-6.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          }
          onClick={() => {
            addClickLog('미팅요청 FAB');
            onNavigate('meeting');
          }}
        />
      )}

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
            // Android: 직접 오픈 / PC·iOS: 확인 팝업 먼저
            if (isAndroid()) {
              window.open(androidUrl, '_blank', 'noopener,noreferrer');
            } else {
              setShowKakaoConfirm(true);
            }
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

      {/* 카카오 공유 확인 팝업 */}
      {showKakaoConfirm && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 70,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(15,30,51,0.45)',
          }}
          onClick={() => setShowKakaoConfirm(false)}
        >
          <div
            style={{
              background: '#fff', borderRadius: 16,
              boxShadow: '0 8px 32px rgba(15,30,51,0.18)',
              padding: '28px 24px 20px', width: 300, margin: '0 16px',
              fontFamily: '"Noto Sans KR","Inter",system-ui,sans-serif',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* 카카오 아이콘 */}
            <div style={{ textAlign: 'center', marginBottom: 14 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 48, height: 48, borderRadius: 14,
                background: '#FEE500',
              }}>
                <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
                  <path d="M16 5C9.92 5 5 8.92 5 13.7c0 3.1 2.05 5.82 5.13 7.34l-.86 3.15a.5.5 0 0 0 .78.55l3.74-2.49c.74.12 1.51.18 2.21.18 6.08 0 11-3.92 11-8.7C27 8.92 22.08 5 16 5Z" fill="#181600"/>
                </svg>
              </div>
            </div>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#0F1E33', textAlign: 'center', marginBottom: 6 }}>
              카카오톡으로 공유
            </p>
            <p style={{ fontSize: 13, color: '#6B7A91', textAlign: 'center', lineHeight: 1.6, marginBottom: 20 }}>
              설치 링크를 카카오톡을 통해<br />모바일로 공유하시겠습니까?
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  setShowKakaoConfirm(false);
                  const kakao = window.Kakao;
                  if (!kakao) { window.open(androidUrl, '_blank', 'noopener,noreferrer'); return; }
                  if (!kakao.isInitialized()) kakao.init(process.env.NEXT_PUBLIC_KAKAO_JS_KEY || '');
                  kakao.Share.sendDefault({
                    objectType: 'feed',
                    content: {
                      title: '이랜드리테일 AI 캠퍼스 앱',
                      description: '모바일에서도 AI 캠퍼스를 이용해 보세요',
                      imageUrl: `${window.location.origin}/icon-512.png`,
                      link: { mobileWebUrl: androidUrl, webUrl: androidUrl },
                    },
                    buttons: [{ title: '앱 설치하기', link: { mobileWebUrl: androidUrl, webUrl: androidUrl } }],
                  });
                }}
                style={{
                  flex: 1, height: 40, borderRadius: 8, border: 'none',
                  background: '#FEE500', color: '#181600',
                  fontSize: 14, fontWeight: 700, cursor: 'pointer',
                }}
              >
                예
              </button>
              <button
                onClick={() => setShowKakaoConfirm(false)}
                style={{
                  flex: 1, height: 40, borderRadius: 8,
                  border: '1px solid #E5EAF1', background: 'transparent',
                  color: '#6B7A91', fontSize: 14, fontWeight: 500, cursor: 'pointer',
                }}
              >
                아니오
              </button>
            </div>
          </div>
        </div>
      )}

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
          .ffa-wrap :global(.ffa-item) {
            width: 52px !important;
          }
        }
      `}</style>
    </div>
  );
}
