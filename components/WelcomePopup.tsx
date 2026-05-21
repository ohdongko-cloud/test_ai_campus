"use client";

import { useState } from 'react';
import { setUserInfo } from '../lib/utils';

const T = {
  primary: '#004A99', primaryDark: '#003A78', primaryLight: '#E6EEF7',
  secondary: '#FF914D', secondaryDark: '#E67835', secondaryLight: '#FFF1E6',
  text: '#0F1E33', textMuted: '#6B7A91', textFaint: '#9BA7BC',
  border: '#E5EAF1', surface: '#FFFFFF', bg: '#F5F7FA',
  danger: '#D8364C', dangerBg: '#FCE6EA',
  r: 8, r2: 12, r3: 16,
  shadowLg: '0 4px 12px rgba(15,30,51,0.06), 0 16px 40px rgba(15,30,51,0.12)',
  fontKo: '"Noto Sans KR", "Inter", system-ui, sans-serif',
};

type Step = 'email' | 'signup' | 'login';

interface Props { onClose: () => void; }

// ── 아이콘 맵 ──
const ICONS: Record<string, JSX.Element> = {
  user:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.5-3.5 3.5-6 7-6s6.5 2.5 7 6"/></svg>,
  building:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M10 21v-3h4v3"/></svg>,
  briefcase: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M3 12h18"/></svg>,
  mail:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 7l8.5 6 8.5-6"/></svg>,
  lock:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>,
  eye:       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  eyeOff:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"/></svg>,
};

// ── 단일 입력 필드 컴포넌트 ──
function Field({
  label, required, placeholder, type = 'text', iconKey,
  value, onChange, error, disabled, showToggle, onToggle,
}: {
  label: string; required?: boolean; placeholder: string; type?: string;
  iconKey: string; value: string; onChange?: (v: string) => void;
  error?: string; disabled?: boolean; showToggle?: boolean; onToggle?: () => void;
}) {
  const [focus, setFocus] = useState(false);
  const hasError = !!error;
  return (
    <div style={{ width: '100%', fontFamily: T.fontKo }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: T.text, marginBottom: 5 }}>
        {label}
        {required && <span style={{ color: T.secondary, marginLeft: 3 }}>*</span>}
      </div>
      <div style={{ position: 'relative' }}>
        <div style={{
          position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)',
          color: hasError ? T.danger : (focus ? T.primary : T.textMuted), pointerEvents: 'none',
        }}>
          {ICONS[iconKey]}
        </div>
        <input
          type={type} value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={e => onChange?.(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            width: '100%', height: 40, paddingLeft: 34,
            paddingRight: showToggle ? 44 : 12,
            border: `1.5px solid ${hasError ? T.danger : (focus ? T.primary : T.border)}`,
            borderRadius: T.r,
            background: disabled ? '#F8FAFC' : T.surface,
            fontSize: 13.5, fontFamily: T.fontKo, color: disabled ? T.textMuted : T.text,
            outline: 'none',
            boxShadow: focus && !disabled ? `0 0 0 3px ${hasError ? T.dangerBg : T.primaryLight}` : 'none',
            transition: 'all .15s', boxSizing: 'border-box' as const,
            cursor: disabled ? 'default' : 'text',
          }}
        />
        {showToggle && (
          <button
            type="button"
            onClick={onToggle}
            style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer',
              color: T.textMuted, padding: 2, display: 'flex', alignItems: 'center',
            }}
          >
            {type === 'password' ? ICONS.eye : ICONS.eyeOff}
          </button>
        )}
      </div>
      {hasError && (
        <p style={{ margin: '4px 0 0', fontSize: 11, color: T.danger, fontWeight: 500 }}>{error}</p>
      )}
    </div>
  );
}

// ── 진행 단계 표시 ──
function StepDots({ step }: { step: Step }) {
  const dots = [
    { key: 'email', label: '이메일' },
    { key: 'form', label: step === 'signup' ? '회원가입' : '로그인' },
  ];
  const active = step === 'email' ? 0 : 1;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 16 }}>
      {dots.map((d, i) => (
        <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: i <= active ? 20 : 8, height: 8, borderRadius: 999,
            background: i <= active ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)',
            transition: 'all .3s',
          }} />
          {i < dots.length - 1 && (
            <div style={{ width: 16, height: 1, background: 'rgba(255,255,255,0.35)' }} />
          )}
        </div>
      ))}
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginLeft: 4 }}>
        {active + 1} / {dots.length}
      </span>
    </div>
  );
}

export default function WelcomePopup({ onClose }: Props) {
  const [step, setStep] = useState<Step>('email');
  const [loading, setLoading] = useState(false);

  // Step 1
  const [emailInput, setEmailInput] = useState('');
  const [emailError, setEmailError] = useState('');

  // Step 2a — 회원가입
  const [name, setName] = useState('');
  const [corporationName, setCorporationName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [position, setPosition] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [signupErrors, setSignupErrors] = useState<Record<string, string>>({});

  // Step 2b — 로그인
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showLoginPw, setShowLoginPw] = useState(false);

  // ── 이메일 체크 ──
  const handleEmailNext = async () => {
    const trimmed = emailInput.trim().toLowerCase();
    if (!trimmed) { setEmailError('이메일을 입력해주세요.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError('올바른 이메일 형식을 입력해주세요.');
      return;
    }
    setEmailError('');
    setLoading(true);
    try {
      const res = await fetch(`/api/users/exists?email=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (data.exists) {
        setStep('login');
      } else {
        setStep('signup');
      }
    } catch {
      setEmailError('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  // ── 회원가입 제출 ──
  const handleSignup = async () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = '이름을 입력해주세요.';
    if (!corporationName.trim()) errs.corporationName = '법인명을 입력해주세요.';
    if (!organizationName.trim()) errs.organizationName = '조직명을 입력해주세요.';
    if (!position.trim()) errs.position = '직무를 입력해주세요.';
    if (!password) errs.password = '비밀번호를 입력해주세요.';
    else if (password.length < 8) errs.password = '비밀번호는 8자 이상이어야 합니다.';
    setSignupErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          corporationName: corporationName.trim(),
          organizationName: organizationName.trim(),
          position: position.trim(),
          email: emailInput.trim().toLowerCase(),
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setEmailError('이미 등록된 이메일입니다.');
          setStep('email');
        } else {
          setSignupErrors({ _: data.error || '오류가 발생했습니다.' });
        }
        return;
      }
      // 성공: localStorage 저장 후 메인 화면으로
      setUserInfo({
        visited: true,
        name: data.name,
        org: data.organization_name,
        role: data.position,
        email: data.email,
        corporationName: data.corporation_name,
        organizationName: data.organization_name,
        position: data.position,
        userId: data.id,
      });
      onClose();
    } catch {
      setSignupErrors({ _: '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' });
    } finally {
      setLoading(false);
    }
  };

  // ── 로그인 제출 ──
  const handleLogin = async () => {
    if (!loginPassword) { setLoginError('비밀번호를 입력해주세요.'); return; }
    setLoginError('');
    setLoading(true);
    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput.trim().toLowerCase(), password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || '비밀번호가 올바르지 않습니다.');
        return;
      }
      setUserInfo({
        visited: true,
        name: data.name,
        org: data.organization_name,
        role: data.position,
        email: data.email,
        corporationName: data.corporation_name,
        organizationName: data.organization_name,
        position: data.position,
        userId: data.id,
      });
      onClose();
    } catch {
      setLoginError('네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    setStep('email');
    setLoginPassword('');
    setLoginError('');
    setSignupErrors({});
    setPassword('');
  };

  // ── 헤더 텍스트 ──
  const headerTitle = step === 'email'
    ? '이랜드리테일 AI 캠퍼스에\n오신 것을 환영합니다'
    : step === 'signup'
    ? '신규 계정 만들기'
    : '다시 오셨군요!';

  const headerSub = step === 'email'
    ? '이메일을 입력하면 로그인 또는 회원가입 화면으로 이동합니다.'
    : step === 'signup'
    ? '정보를 입력하고 AI 캠퍼스 여정을 시작하세요.'
    : `${emailInput} 계정으로 로그인합니다.`;

  const badgeLabel = step === 'email' ? 'Welcome' : step === 'signup' ? '신규 가입' : '로그인';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(15,30,51,0.60)', backdropFilter: 'blur(5px)', padding: 16 }}
      // 배경 클릭으로 닫기 불가 — 반드시 로그인/가입 완료 필요
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: T.surface, borderRadius: T.r3,
          boxShadow: T.shadowLg,
          width: '100%', maxWidth: 520,
          overflow: 'hidden', fontFamily: T.fontKo,
          maxHeight: 'calc(100vh - 32px)', display: 'flex', flexDirection: 'column',
        }}
      >
        {/* ── 그라데이션 헤더 ── */}
        <div style={{
          background: `linear-gradient(135deg, ${T.primary} 0%, ${T.primaryDark} 100%)`,
          padding: '28px 32px 24px', color: '#fff', position: 'relative', overflow: 'hidden', flexShrink: 0,
        }}>
          <div style={{
            position: 'absolute', top: -40, right: -40,
            width: 200, height: 200, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,145,77,0.35) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', borderRadius: 999,
            background: 'rgba(255,255,255,0.18)',
            fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
            textTransform: 'uppercase' as const, marginBottom: 12,
            position: 'relative',
          }}>
            {step === 'email' && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z"/>
              </svg>
            )}
            {badgeLabel}
          </div>
          <h2 style={{
            margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em',
            position: 'relative', lineHeight: 1.35, whiteSpace: 'pre-line',
          }}>
            {headerTitle}
          </h2>
          <p style={{ margin: '8px 0 0', fontSize: 13, opacity: 0.85, position: 'relative', lineHeight: 1.55 }}>
            {headerSub}
          </p>
          <StepDots step={step} />
        </div>

        {/* ── 폼 영역 ── */}
        <div style={{ padding: '24px 32px 28px', overflowY: 'auto', flex: 1 }}>

          {/* ─ STEP 1: 이메일 입력 ─ */}
          {step === 'email' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Field
                label="이메일" required placeholder="you@eland.co.kr"
                type="email" iconKey="mail"
                value={emailInput} onChange={v => { setEmailInput(v); setEmailError(''); }}
                error={emailError}
              />
              <button
                onClick={handleEmailNext}
                disabled={loading}
                style={{
                  height: 44, borderRadius: T.r, border: 'none',
                  background: loading ? '#93AACC' : T.primary,
                  color: '#fff', fontSize: 14, fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontFamily: T.fontKo,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  transition: 'background .15s',
                }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.background = T.primaryDark; }}
                onMouseLeave={e => { if (!loading) e.currentTarget.style.background = T.primary; }}
              >
                {loading ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}>
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                    </svg>
                    확인 중...
                  </>
                ) : (
                  <>
                    다음
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M13 6l6 6-6 6"/>
                    </svg>
                  </>
                )}
              </button>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* ─ STEP 2a: 회원가입 ─ */}
          {step === 'signup' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              {signupErrors._ && (
                <div style={{
                  padding: '10px 14px', borderRadius: T.r,
                  background: T.dangerBg, color: T.danger, fontSize: 13, fontWeight: 500,
                }}>
                  {signupErrors._}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="이름" required placeholder="홍길동"
                  iconKey="user" value={name} onChange={setName} error={signupErrors.name} />
                <Field label="법인명" required placeholder="(주)이랜드리테일"
                  iconKey="building" value={corporationName} onChange={setCorporationName} error={signupErrors.corporationName} />
              </div>
              <Field label="조직명 (브랜드/점포/팀명)" required placeholder="예: 스파오 홍대점, 마케팅팀"
                iconKey="building" value={organizationName} onChange={setOrganizationName} error={signupErrors.organizationName} />
              <Field label="직무" required placeholder="예: AI 기획, 콘텐츠 담당"
                iconKey="briefcase" value={position} onChange={setPosition} error={signupErrors.position} />
              <Field label="이메일" required placeholder=""
                iconKey="mail" value={emailInput} disabled />
              <Field
                label="간편 로그인 비밀번호" required
                placeholder="8자 이상 (영문·숫자·특수문자 조합 권장)"
                type={showPw ? 'text' : 'password'} iconKey="lock"
                value={password} onChange={setPassword} error={signupErrors.password}
                showToggle onToggle={() => setShowPw(v => !v)}
              />

              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  onClick={goBack}
                  style={{
                    height: 44, flex: '0 0 auto', padding: '0 18px', borderRadius: T.r,
                    border: `1.5px solid ${T.border}`, background: 'transparent',
                    color: T.textMuted, fontSize: 13, fontWeight: 500,
                    cursor: 'pointer', fontFamily: T.fontKo,
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 12H5M12 19l-7-7 7-7"/>
                  </svg>
                  이전
                </button>
                <button
                  onClick={handleSignup}
                  disabled={loading}
                  style={{
                    height: 44, flex: 1, borderRadius: T.r, border: 'none',
                    background: loading ? '#93AACC' : T.primary,
                    color: '#fff', fontSize: 14, fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontFamily: T.fontKo,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    transition: 'background .15s',
                  }}
                  onMouseEnter={e => { if (!loading) e.currentTarget.style.background = T.primaryDark; }}
                  onMouseLeave={e => { if (!loading) e.currentTarget.style.background = T.primary; }}
                >
                  {loading ? '처리 중...' : (
                    <>
                      시작하기
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M13 6l6 6-6 6"/>
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ─ STEP 2b: 로그인 ─ */}
          {step === 'login' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="이메일" placeholder="" iconKey="mail" value={emailInput} disabled />
              <Field
                label="간편 로그인 비밀번호" required placeholder="비밀번호를 입력하세요"
                type={showLoginPw ? 'text' : 'password'} iconKey="lock"
                value={loginPassword} onChange={v => { setLoginPassword(v); setLoginError(''); }}
                error={loginError}
                showToggle onToggle={() => setShowLoginPw(v => !v)}
              />

              {/* 비밀번호 분실 안내 */}
              <div style={{
                padding: '10px 14px', borderRadius: T.r,
                background: '#FFFBEB', border: '1px solid #FDE68A',
                display: 'flex', alignItems: 'flex-start', gap: 8,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
                </svg>
                <span style={{ fontSize: 12, color: '#92400E', lineHeight: 1.55 }}>
                  비밀번호를 잊으셨습니까?{' '}
                  <a
                    href="mailto:oh_dongha01@eland.co.kr"
                    style={{ color: T.primary, fontWeight: 600, textDecoration: 'underline' }}
                  >
                    oh_dongha01@eland.co.kr
                  </a>
                  로 문의하세요.
                </span>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
                <button
                  onClick={goBack}
                  style={{
                    height: 44, flex: '0 0 auto', padding: '0 18px', borderRadius: T.r,
                    border: `1.5px solid ${T.border}`, background: 'transparent',
                    color: T.textMuted, fontSize: 13, fontWeight: 500,
                    cursor: 'pointer', fontFamily: T.fontKo,
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 12H5M12 19l-7-7 7-7"/>
                  </svg>
                  이전
                </button>
                <button
                  onClick={handleLogin}
                  disabled={loading}
                  style={{
                    height: 44, flex: 1, borderRadius: T.r, border: 'none',
                    background: loading ? '#93AACC' : T.primary,
                    color: '#fff', fontSize: 14, fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontFamily: T.fontKo,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    transition: 'background .15s',
                  }}
                  onMouseEnter={e => { if (!loading) e.currentTarget.style.background = T.primaryDark; }}
                  onMouseLeave={e => { if (!loading) e.currentTarget.style.background = T.primary; }}
                  onKeyDown={e => { if (e.key === 'Enter') handleLogin(); }}
                >
                  {loading ? '로그인 중...' : (
                    <>
                      시작하기
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M13 6l6 6-6 6"/>
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
