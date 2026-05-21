"use client";

import { useState, useEffect } from 'react';
import { GuideGroup, GuideServiceItem } from '../lib/types';
import { getGuideGroups } from '../lib/utils';

const T = {
  primary: '#2563EB', primaryLight: '#EFF4FF', primaryBorder: '#BFDBFE',
  text: '#0F1E33', textBody: '#3B4A63', textMuted: '#6B7A90',
  border: '#E8EDF5', surface: '#FFFFFF', bg: '#F5F7FA',
  success: '#16A34A', successBg: '#DCFCE7', successBorder: '#BBF7D0',
  purple: '#7C3AED', purpleLight: '#F5F3FF',
  r: 8, r2: 12, r3: 16,
  shadow: '0 1px 4px rgba(0,0,0,0.06)',
  shadowMd: '0 4px 16px rgba(0,0,0,0.08)',
};

const GROUP_ICONS: Record<string, string> = {
  'dev-env': '🖥️',
  'deploy': '🚀',
  'database': '🗄️',
  'cloud': '☁️',
  'mobile': '📱',
  'ai': '🤖',
  'collaboration': '🤝',
};

function ServiceCard({ item }: { item: GuideServiceItem }) {
  const [hover, setHover] = useState(false);

  const isValidUrl = (url: string) => {
    try { const u = new URL(url); return u.protocol === 'https:' || u.protocol === 'http:'; }
    catch { return false; }
  };

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: T.surface,
        border: `1.5px solid ${hover ? T.primaryBorder : T.border}`,
        borderRadius: T.r2,
        padding: '20px',
        boxShadow: hover ? T.shadowMd : T.shadow,
        transform: hover ? 'translateY(-2px)' : 'none',
        transition: 'all .16s',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: T.text, letterSpacing: '-0.01em' }}>
          {item.name}
        </span>
        {item.recommended && (
          <span style={{
            fontSize: 10, fontWeight: 700, color: T.success,
            background: T.successBg, border: `1px solid ${T.successBorder}`,
            padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap', letterSpacing: '0.04em',
          }}>추천</span>
        )}
      </div>

      {/* 설명 */}
      <p style={{ margin: 0, fontSize: 13, color: T.textBody, lineHeight: 1.6, flex: 1 }}>
        {item.description}
      </p>

      {/* 비용 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 12, color: T.textMuted,
        background: T.bg, borderRadius: T.r, padding: '5px 10px',
      }}>
        <span>💰</span>
        <span>{item.cost || '비용 정보 없음'}</span>
      </div>

      {/* 링크 버튼 */}
      {isValidUrl(item.url) ? (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '9px 0', borderRadius: T.r,
            background: hover ? T.primary : T.primaryLight,
            color: hover ? '#fff' : T.primary,
            fontSize: 13, fontWeight: 600, textDecoration: 'none',
            border: `1.5px solid ${T.primaryBorder}`,
            transition: 'all .16s',
          }}
        >
          가입하러 가기 →
        </a>
      ) : (
        <div style={{ padding: '9px 0', textAlign: 'center', fontSize: 12, color: T.textMuted }}>
          링크 없음
        </div>
      )}
    </div>
  );
}

function GroupSection({ group }: { group: GuideGroup }) {
  const icon = GROUP_ICONS[group.id] || '📦';
  return (
    <section style={{ marginBottom: 48 }}>
      {/* 그룹 헤더 */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 14,
        background: 'linear-gradient(135deg, #1E3A5F 0%, #2563EB 100%)',
        borderRadius: T.r2, padding: '20px 24px', marginBottom: 20, color: '#fff',
      }}>
        <span style={{ fontSize: 28, lineHeight: 1 }}>{icon}</span>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em' }}>
            {group.name}
          </h2>
          <p style={{ margin: 0, fontSize: 13, opacity: 0.85, lineHeight: 1.5 }}>
            {group.description}
          </p>
        </div>
      </div>

      {/* 서비스 카드 그리드 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 16,
      }}>
        {group.items.map(item => (
          <ServiceCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}

export default function GuidePage() {
  const [groups, setGroups] = useState<GuideGroup[]>([]);

  useEffect(() => {
    setGroups(getGuideGroups());
    const handler = () => setGroups(getGuideGroups());
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px 64px' }}>
      {/* 페이지 헤더 */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 6 }}>홈 › 핵심 서비스 목록</div>
        <h1 style={{ margin: '0 0 8px', fontSize: 26, fontWeight: 800, color: T.text, letterSpacing: '-0.03em' }}>
          핵심 서비스 목록
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: T.textMuted, lineHeight: 1.6 }}>
          바이브코딩을 시작하는 데 필요한 핵심 서비스 목록입니다. 역할별로 정리되어 있으니 필요한 것부터 가입해보세요.
        </p>

        {/* 추천 배지 안내 */}
        <div style={{
          marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 8,
          background: T.successBg, border: `1px solid ${T.successBorder}`,
          borderRadius: T.r, padding: '8px 14px', fontSize: 13, color: T.success, fontWeight: 500,
        }}>
          <span style={{
            fontSize: 10, fontWeight: 700, color: T.success,
            background: T.surface, border: `1px solid ${T.successBorder}`,
            padding: '1px 6px', borderRadius: 999,
          }}>추천</span>
          표시는 팀에서 특히 권장하는 서비스입니다.
        </div>
      </div>

      {/* 그룹 목록 */}
      {groups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: T.textMuted, fontSize: 14 }}>
          서비스 목록이 없습니다. 관리자에게 문의하세요.
        </div>
      ) : (
        groups.map(group => <GroupSection key={group.id} group={group} />)
      )}
    </div>
  );
}
