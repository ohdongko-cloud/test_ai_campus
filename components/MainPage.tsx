"use client";

import { useState } from 'react';
import { TabType } from '../lib/types';
import { addClickLog, getNoaUrl } from '../lib/utils';
import ChatroomPopup from './ChatroomPopup';

interface Props {
  onNavigate: (tab: TabType) => void;
}

type CardDef = {
  title: string;
  desc: string;
  badge: string;
  badgeColor: string;
  action: string;
  buttonText?: string;
  tab?: TabType;
  external?: boolean;
  externalKey?: 'chatroom' | 'noa';
};

const CARDS: CardDef[] = [
  {
    title: 'AI 딸깍, 강의 따라하기',
    desc: '수준별 AI 교육 영상을 골라 시청하세요',
    badge: '강의',
    badgeColor: '#EFF4FF',
    action: '강의영상',
    tab: 'videos',
  },
  {
    title: 'NOA 사용하기',
    desc: '사내 NOA 시스템에 즉시 접속합니다',
    badge: 'NOA',
    badgeColor: '#ECFDF5',
    action: 'NOA',
    external: true,
    externalKey: 'noa',
  },
  {
    title: '미팅 요청하기',
    desc: 'AI서비스 구현 어려울 경우 미팅 요청해주세요. 일정 확인 후 메일로 개별 연락 드립니다.',
    badge: '1:1 상담',
    badgeColor: '#FFF7ED',
    action: '미팅요청',
    tab: 'meeting',
  },
  {
    title: '오픈채팅방 입장',
    desc: 'AI 사용 꿀팁과 고민을 나누는 공간입니다.',
    badge: '카카오톡',
    badgeColor: '#FEFCE8',
    action: '오픈채팅방',
    buttonText: '입장하기',
    external: true,
    externalKey: 'chatroom',
  },
  {
    title: '내가 만든 서비스 공유',
    desc: '내가 만든 AI 서비스를 동료들과 공유하세요',
    badge: '공유',
    badgeColor: '#F5F3FF',
    action: '서비스공유',
    buttonText: '공유하기',
    tab: 'share',
  },
  {
    title: '핵심 서비스 목록',
    desc: '바이브코딩에 필요한 핵심 서비스 목록을 확인하세요',
    badge: '서비스',
    badgeColor: '#FDF4FF',
    action: '서비스가이드',
    tab: 'guide',
  },
];

const BOARD_CARD: CardDef = {
  title: '게시판 작성',
  desc: '익명으로 질문을 남기고 동료와 소통하세요',
  badge: '커뮤니티',
  badgeColor: '#F0FDF4',
  action: '게시판',
  tab: 'board',
};

export default function MainPage({ onNavigate }: Props) {
  const [showChatroomPopup, setShowChatroomPopup] = useState(false);

  const handleCardClick = (card: CardDef) => {
    addClickLog(card.action);
    if (card.externalKey === 'chatroom') {
      setShowChatroomPopup(true);
    } else if (card.external) {
      window.open(getNoaUrl(), '_blank', 'noopener,noreferrer');
    } else if (card.tab) {
      onNavigate(card.tab);
    }
  };

  const renderCard = (card: CardDef) => (
    <div
      key={card.action}
      onClick={() => handleCardClick(card)}
      style={{
        background: 'white',
        border: '1.5px solid #E8EDF5',
        borderRadius: 16,
        padding: '24px',
        cursor: 'pointer',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        transition: 'all 0.18s',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.boxShadow = '0 8px 24px rgba(37,99,235,0.10)';
        el.style.borderColor = '#BFDBFE';
        el.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)';
        el.style.borderColor = '#E8EDF5';
        el.style.transform = 'translateY(0)';
      }}
    >
      <div style={{
        display: 'inline-block',
        background: card.badgeColor,
        color: '#2563EB',
        fontSize: 11, fontWeight: 600,
        padding: '3px 10px', borderRadius: 999,
        width: 'fit-content',
        letterSpacing: '0.02em',
      }}>
        {card.badge}
      </div>
      <div style={{ flex: 1 }}>
        <h3 style={{
          fontSize: 15, fontWeight: 700,
          color: '#0F1E33', marginBottom: 6,
          letterSpacing: '-0.02em', lineHeight: 1.3,
        }}>
          {card.title}
        </h3>
        <p style={{ fontSize: 13, color: '#6B7A90', lineHeight: 1.6 }}>
          {card.desc}
        </p>
      </div>
      <button
        onClick={e => { e.stopPropagation(); handleCardClick(card); }}
        style={{
          width: '100%',
          background: '#0F1E33',
          color: '#fff',
          border: 'none',
          borderRadius: 10,
          padding: '10px',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'background 0.12s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = '#2563EB')}
        onMouseLeave={e => (e.currentTarget.style.background = '#0F1E33')}
      >
        {card.buttonText || '바로가기'}
      </button>
    </div>
  );

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px 64px' }}>
      {/* 히어로 섹션 */}
      <div style={{
        background: 'linear-gradient(135deg, #1E3A5F 0%, #2563EB 60%, #3B82F6 100%)',
        borderRadius: 20,
        padding: '48px 40px',
        marginBottom: 40,
        marginTop: 32,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* 장식 원형 */}
        <div style={{
          position: 'absolute', top: -40, right: -40,
          width: 200, height: 200, borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)',
        }} />
        <div style={{
          position: 'absolute', bottom: -60, right: 80,
          width: 140, height: 140, borderRadius: '50%',
          background: 'rgba(255,255,255,0.04)',
        }} />
        <div style={{
          display: 'inline-block',
          background: 'rgba(255,255,255,0.18)',
          color: '#fff', fontSize: 11, fontWeight: 600,
          padding: '4px 12px', borderRadius: 999, marginBottom: 16,
          letterSpacing: '0.08em',
        }}>ELAND RETAIL AI CAMPUS</div>
        <h1 style={{
          fontSize: 28, fontWeight: 800, color: '#fff',
          marginBottom: 10, letterSpacing: '-0.03em', lineHeight: 1.2,
        }}>
          이랜드리테일 AI 캠퍼스에<br />오신 것을 환영합니다
        </h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', lineHeight: 1.6 }}>
          AI 교육 영상 시청부터 미팅 요청, 서비스 공유까지 — 한 곳에서 시작하세요.
        </p>
      </div>

      {/* 기능 카드 그리드 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 20,
      }}>
        {CARDS.map(card => renderCard(card))}
      </div>

      {/* 커뮤니티 섹션 — 게시판 */}
      <div style={{ marginTop: 32 }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: '#8A96A8',
          letterSpacing: '0.06em', marginBottom: 12, textTransform: 'uppercase',
        }}>커뮤니티</div>
        <div style={{ maxWidth: 340 }}>
          {renderCard(BOARD_CARD)}
        </div>
      </div>

      {/* 오픈채팅방 팝업 */}
      {showChatroomPopup && (
        <ChatroomPopup onClose={() => setShowChatroomPopup(false)} />
      )}
    </div>
  );
}
