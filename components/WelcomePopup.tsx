"use client";

import { useState } from 'react';
import { setUserInfo } from '../lib/utils';
import { UserInfo } from '../lib/types';

const T = {
  primary: '#004A99', primaryDark: '#003A78', primaryLight: '#E6EEF7',
  secondary: '#FF914D', secondaryDark: '#E67835', secondaryLight: '#FFF1E6',
  text: '#0F1E33', textMuted: '#6B7A91',
  border: '#E5EAF1', surface: '#FFFFFF', bg: '#F5F7FA',
  r: 8, r2: 12, r3: 16,
  shadowLg: '0 4px 12px rgba(15,30,51,0.06), 0 16px 40px rgba(15,30,51,0.12)',
  fontKo: '"Noto Sans KR", "Inter", system-ui, sans-serif',
};

interface Props {
  onClose: () => void;
}

function FieldInput({
  label, required, placeholder, type = 'text', icon, value, onChange,
}: {
  label: string; required?: boolean; placeholder: string;
  type?: string; icon: string; value: string; onChange: (v: string) => void;
}) {
  const [focus, setFocus] = useState(false);
  const icons: Record<string, JSX.Element> = {
    user: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.5-3.5 3.5-6 7-6s6.5 2.5 7 6"/></svg>,
    building: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3"/></svg>,
    briefcase: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M3 12h18"/></svg>,
    mail: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 7l8.5 6 8.5-6"/></svg>,
  };
  return (
    <label style={{ display: 'block', width: '100%', fontFamily: T.fontKo }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: T.text, marginBottom: 6 }}>
        {label}
        {required && <span style={{ color: T.secondary, marginLeft: 4 }}>*</span>}
      </div>
      <div style={{ position: 'relative' }}>
        <div style={{
          position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)',
          color: T.textMuted, pointerEvents: 'none',
        }}>
          {icons[icon]}
        </div>
        <input
          type={type} value={value} placeholder={placeholder}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            width: '100%', height: 40, paddingLeft: 34, paddingRight: 12,
            border: `1.5px solid ${focus ? T.primary : T.border}`,
            borderRadius: T.r, background: T.surface,
            fontSize: 13.5, fontFamily: T.fontKo, color: T.text,
            outline: 'none',
            boxShadow: focus ? `0 0 0 3px ${T.primaryLight}` : 'none',
            transition: 'all .15s', boxSizing: 'border-box' as const,
          }}
        />
      </div>
    </label>
  );
}

export default function WelcomePopup({ onClose }: Props) {
  const [name, setName] = useState('');
  const [org, setOrg] = useState('');
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');

  const handleSubmit = () => {
    const info: UserInfo = { visited: true, name, org, role, email };
    setUserInfo(info);
    onClose();
  };

  const handleSkip = () => {
    setUserInfo({ visited: true, name: '', org: '', role: '', email: '' });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(15,30,51,0.55)', backdropFilter: 'blur(4px)', padding: 16 }}
      onClick={handleSkip}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: T.surface, borderRadius: T.r3,
          boxShadow: T.shadowLg,
          width: '100%', maxWidth: 520,
          overflow: 'hidden', fontFamily: T.fontKo,
        }}
      >
        {/* 그라데이션 헤더 */}
        <div style={{
          background: `linear-gradient(135deg, ${T.primary} 0%, ${T.primaryDark} 100%)`,
          padding: '32px 32px 24px', color: '#fff', position: 'relative', overflow: 'hidden',
        }}>
          {/* 장식 원형 */}
          <div style={{
            position: 'absolute', top: -40, right: -40,
            width: 200, height: 200, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,145,77,0.35) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />
          {/* WELCOME 뱃지 */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', borderRadius: 999,
            background: 'rgba(255,255,255,0.18)',
            fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
            textTransform: 'uppercase' as const, marginBottom: 14,
            position: 'relative', whiteSpace: 'nowrap' as const,
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z"/>
              <path d="M19 16l.7 1.8L21.5 18.5l-1.8.7L19 21l-.7-1.8L16.5 18.5l1.8-.7L19 16z"/>
            </svg>
            Welcome
          </div>
          <h2 style={{
            margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em',
            position: 'relative', lineHeight: 1.3,
          }}>
            이랜드리테일 AI 캠퍼스에<br />오신 것을 환영합니다
          </h2>
          <p style={{
            margin: '10px 0 0', fontSize: 13.5, opacity: 0.85,
            position: 'relative', lineHeight: 1.55,
          }}>
            더 나은 경험을 위해 몇 가지 정보를 알려주세요.<br />
            입력하지 않아도 계속 이용하실 수 있습니다.
          </p>
        </div>

        {/* 폼 영역 */}
        <div style={{ padding: '24px 32px 28px' }}>
          <div style={{ display: 'grid', gap: 14 }}>
            {/* 이름 + 소속 2열 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <FieldInput label="이름" required placeholder="홍길동"
                icon="user" value={name} onChange={setName} />
              <FieldInput label="소속 조직명" required placeholder="예: 마케팅팀"
                icon="building" value={org} onChange={setOrg} />
            </div>
            <FieldInput label="직무" required placeholder="예: AI 기획, 콘텐츠 담당"
              icon="briefcase" value={role} onChange={setRole} />
            <FieldInput label="이메일" required type="email" placeholder="you@company.com"
              icon="mail" value={email} onChange={setEmail} />
          </div>

          {/* 안내 배너 */}
          <div style={{
            marginTop: 14, padding: '10px 14px', borderRadius: T.r,
            background: T.secondaryLight,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.secondaryDark} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 21V4M5 4h11l-2 4 2 4H5"/>
            </svg>
            <span style={{ fontSize: 12, color: T.secondaryDark, fontWeight: 500 }}>
              <strong style={{ fontWeight: 700 }}>*</strong> 표시 항목은 교육 현황 파악을 위해 권장됩니다.
            </span>
          </div>

          {/* 버튼 */}
          <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              onClick={handleSkip}
              style={{
                height: 40, padding: '0 18px', borderRadius: T.r,
                border: `1.5px solid ${T.border}`, background: 'transparent',
                color: T.textMuted, fontSize: 14, fontWeight: 500,
                cursor: 'pointer', fontFamily: T.fontKo,
              }}
            >
              나중에 입력
            </button>
            <button
              onClick={handleSubmit}
              style={{
                height: 40, padding: '0 20px', borderRadius: T.r,
                border: 'none',
                background: T.primary,
                color: '#fff', fontSize: 14, fontWeight: 600,
                cursor: 'pointer', fontFamily: T.fontKo,
                display: 'flex', alignItems: 'center', gap: 6,
                boxShadow: '0 1px 2px rgba(15,30,51,0.08)',
              }}
            >
              시작하기
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
