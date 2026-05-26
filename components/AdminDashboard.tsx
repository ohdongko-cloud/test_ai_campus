"use client";

import { useState } from 'react';
import { AdminTabType } from '../lib/types';
import AdminStats from './AdminStats';
import AdminVideos from './AdminVideos';
import AdminMeetings from './AdminMeetings';
import AdminChatroom from './AdminChatroom';
import AdminServices from './AdminServices';
import AdminBoardStats from './AdminBoardStats';
import AdminGuide from './AdminGuide';
import AdminImport from './AdminImport';

interface Props {
  onExit: () => void;
}

interface TabInfo {
  key: AdminTabType;
  label: string;
}

const TABS: TabInfo[] = [
  { key: 'stats', label: '통계 현황' },
  { key: 'videos', label: '영상 관리' },
  { key: 'meetings', label: '미팅 관리' },
  { key: 'chatroom', label: '오픈채팅방 관리' },
  { key: 'services', label: '서비스 공유 관리' },
  { key: 'board', label: '게시판 관리' },
  { key: 'guide', label: '가이드 관리' },
];

export default function AdminDashboard({ onExit }: Props) {
  const [activeTab, setActiveTab] = useState<AdminTabType>('stats');
  const [showImport, setShowImport] = useState(false);

  const renderContent = () => {
    switch (activeTab) {
      case 'stats': return <AdminStats />;
      case 'videos': return <AdminVideos />;
      case 'meetings': return <AdminMeetings />;
      case 'chatroom': return <AdminChatroom />;
      case 'services': return <AdminServices />;
      case 'board':    return <AdminBoardStats />;
      case 'guide':    return <AdminGuide />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen font-sans" style={{ background: '#F5F7FA', color: '#0F1E33' }}>
      {/* 상단 헤더 */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #E8EDF5',
        padding: '0 24px', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'linear-gradient(135deg, #2563EB 0%, #1E40AF 100%)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 700, boxShadow: '0 2px 8px rgba(37,99,235,0.25)',
          }}>A</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0F1E33', letterSpacing: '-0.02em', lineHeight: 1 }}>
              이랜드리테일 AI 캠퍼스
            </div>
            <div style={{ fontSize: 10, color: '#8A96A8', letterSpacing: '0.06em', marginTop: 2 }}>
              ADMIN DASHBOARD
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setShowImport(true)}
            title="이 브라우저의 localStorage 데이터를 서버 DB로 일괄 업로드"
            style={{
              padding: '8px 14px', borderRadius: 8,
              border: '1.5px solid #BFDBFE', background: '#EFF6FF',
              color: '#1D4ED8', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            🔄 로컬→서버 업로드
          </button>
          <button
            onClick={onExit}
            style={{
              padding: '8px 16px', borderRadius: 8,
              border: '1.5px solid #E2E8F0', background: 'white',
              color: '#4A5568', fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}
          >
            관리자 모드 종료
          </button>
        </div>
      </header>

      {showImport && <AdminImport onClose={() => setShowImport(false)} />}

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 64px)' }}>
        {/* 좌측 사이드바 — PC */}
        <aside className="hidden md:block" style={{
          width: 200, background: 'white',
          borderRight: '1px solid #E8EDF5', paddingTop: 24, flexShrink: 0,
        }}>
          <nav style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  width: '100%', textAlign: 'left', padding: '10px 14px',
                  borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: 13.5, fontWeight: activeTab === tab.key ? 600 : 500,
                  background: activeTab === tab.key ? '#EFF4FF' : 'transparent',
                  color: activeTab === tab.key ? '#2563EB' : '#4A5568',
                  transition: 'all 0.12s',
                }}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* 모바일 상단 탭 */}
        <div className="md:hidden w-full">
          <div style={{
            background: 'white', borderBottom: '1px solid #E8EDF5',
            display: 'flex', overflowX: 'auto', padding: '8px 16px', gap: 8,
          }}>
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  whiteSpace: 'nowrap', padding: '6px 14px', borderRadius: 8,
                  fontSize: 12, fontWeight: activeTab === tab.key ? 600 : 500,
                  background: activeTab === tab.key ? '#EFF4FF' : 'transparent',
                  color: activeTab === tab.key ? '#2563EB' : '#4A5568',
                  border: activeTab === tab.key ? '1.5px solid #BFDBFE' : '1.5px solid #E8EDF5',
                  cursor: 'pointer',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div style={{ padding: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0F1E33', marginBottom: 16 }}>
              {TABS.find(t => t.key === activeTab)?.label}
            </h2>
            {renderContent()}
          </div>
        </div>

        {/* PC 콘텐츠 영역 */}
        <main className="hidden md:block" style={{ flex: 1, padding: 32 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0F1E33', marginBottom: 24 }}>
            {TABS.find(t => t.key === activeTab)?.label}
          </h2>
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
