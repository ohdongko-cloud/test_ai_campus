"use client";

import { useEffect, useState } from 'react';
import { AdminTabType } from '../lib/types';
import AdminStats from './AdminStats';
import AdminVideos from './AdminVideos';
import AdminLectureRequests from './AdminLectureRequests';
import AdminMeetings from './AdminMeetings';
import AdminChatroom from './AdminChatroom';
import AdminServices from './AdminServices';
import AdminBoardStats from './AdminBoardStats';
import AdminGuide from './AdminGuide';
import AdminImport from './AdminImport';
import AdminLogs from './AdminLogs';
import AdminUsersManage from './AdminUsersManage';
import AdminMembers from './AdminMembers';
import BrandMark from './BrandMark';

interface Props {
  onExit: () => void;
}

interface TabInfo {
  key: AdminTabType;
  label: string;
  perm?: string; // permissions JSON key. 누락 = 항상 표시 (예: stats는 항상)
}

const TABS: TabInfo[] = [
  { key: 'stats',    label: '통계 현황',         perm: 'stats' },
  { key: 'videos',   label: '영상 관리',         perm: 'videos' },
  { key: 'lectureRequests', label: '강의 요청',  perm: 'videos' },
  { key: 'meetings', label: '미팅 관리',         perm: 'meetings' },
  { key: 'chatroom', label: '오픈채팅방 관리',   perm: 'chatroom' },
  { key: 'services', label: '서비스 공유 관리',  perm: 'services' },
  { key: 'board',    label: '게시판 관리',       perm: 'board' },
  { key: 'guide',    label: '가이드 관리',       perm: 'guide' },
  { key: 'members',  label: '회원 관리',         perm: 'members' },
  { key: 'logs',     label: '로그',              perm: 'logs' },
  { key: 'admins',   label: '관리자 관리',       perm: 'admins' }, // master 전용
];

interface MeUser {
  nickname: string;
  email: string;
  role: 'user' | 'admin' | 'master' | 'legacy';
  isAdmin: boolean;
  isMaster: boolean;
  permissions: Record<string, boolean> | null;
}

export default function AdminDashboard({ onExit }: Props) {
  const [activeTab, setActiveTab] = useState<AdminTabType>('videos');
  const [showImport, setShowImport] = useState(false);
  const [me, setMe] = useState<MeUser | null>(null);

  useEffect(() => {
    fetch('/api/users/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : { user: null })
      .then(d => setMe(d.user))
      .catch(() => setMe(null));
  }, []);

  // 권한 보유 여부
  const hasPermission = (perm?: string): boolean => {
    if (!perm) return true;
    // legacy/master 는 모든 권한 보유
    if (!me || me.role === 'legacy' || me.role === 'master') return true;
    if (me.role === 'admin') return !!me.permissions?.[perm];
    return false;
  };

  // 보이는 탭만 필터
  const visibleTabs = TABS.filter(t => hasPermission(t.perm));

  // activeTab이 권한 없는 탭이면 첫 번째 가능한 탭으로 보정
  useEffect(() => {
    if (visibleTabs.length === 0) return;
    if (!visibleTabs.some(t => t.key === activeTab)) {
      setActiveTab(visibleTabs[0].key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, activeTab]);

  const renderContent = () => {
    switch (activeTab) {
      case 'stats': return <AdminStats />;
      case 'videos': return <AdminVideos />;
      case 'lectureRequests': return <AdminLectureRequests />;
      case 'meetings': return <AdminMeetings />;
      case 'chatroom': return <AdminChatroom />;
      case 'services': return <AdminServices />;
      case 'board':    return <AdminBoardStats />;
      case 'guide':    return <AdminGuide />;
      case 'members':  return <AdminMembers />;
      case 'logs':     return <AdminLogs />;
      case 'admins':   return <AdminUsersManage />;
      default: return null;
    }
  };

  const roleLabel = me?.role === 'master' ? '마스터'
    : me?.role === 'legacy' ? '비상 모드'
    : me?.role === 'admin'  ? '관리자'
    : '';

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
          <BrandMark size={36} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0F1E33', letterSpacing: '-0.02em', lineHeight: 1 }}>
              이랜드리테일 AI 캠퍼스
            </div>
            <div style={{ fontSize: 10, color: '#8A96A8', letterSpacing: '0.06em', marginTop: 2 }}>
              ADMIN DASHBOARD
              {roleLabel && (
                <span style={{
                  marginLeft: 8, padding: '2px 6px', borderRadius: 4,
                  background: me?.role === 'master' ? '#FEF3C7' : me?.role === 'legacy' ? '#FCE6EA' : '#E0F2FE',
                  color:      me?.role === 'master' ? '#92400E' : me?.role === 'legacy' ? '#D8364C' : '#1E3A8A',
                  fontSize: 9, fontWeight: 700, textTransform: 'none',
                }}>
                  {roleLabel}
                  {me?.nickname && me.role !== 'legacy' ? ` · ${me.nickname}` : ''}
                </span>
              )}
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
            {visibleTabs.map(tab => (
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
            {visibleTabs.map(tab => (
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
