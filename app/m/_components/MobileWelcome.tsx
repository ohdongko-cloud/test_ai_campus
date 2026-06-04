'use client';

import { useState } from 'react';
import { M } from '../_styles/tokens';
import { setUserInfo } from '../../../lib/utils';
import { isValidSimplePassword, PASSWORD_POLICY_MESSAGE } from '../../../lib/password';

type Step =
  | 'email'
  | 'verify'
  | 'signup'
  | 'login'
  | 'reset-verify'
  | 'reset-password';

interface Props {
  onSuccess: () => void;
}

const DOMAIN_REJECT = '회사 이메일(@eland.co.kr)로 가입할 수 있습니다.';

function isAllowedEmail(e: string) {
  // 기존 WelcomePopup 정책에 맞춤. 운영 측 화이트리스트는 서버에서 한 번 더 검증.
  return /@(eland\.co\.kr|eland\.com)$/i.test(e.trim());
}

export default function MobileWelcome({ onSuccess }: Props) {
  const [step, setStep] = useState<Step>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Common
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');

  // Signup
  const [code, setCode] = useState('');
  const [signupToken, setSignupToken] = useState('');
  const [nickname, setNickname] = useState('');
  const [corp, setCorp] = useState('');
  const [org, setOrg] = useState('');
  const [pos, setPos] = useState('');
  const [pw2, setPw2] = useState('');

  // Login
  const [rememberMe, setRememberMe] = useState(true);

  // Password reset
  const [resetCode, setResetCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resetPw, setResetPw] = useState('');
  const [resetPw2, setResetPw2] = useState('');

  const resetError = () => setError('');

  // ── Step 1: 이메일 → exists → signup-request or login ──
  const handleEmailNext = async () => {
    resetError();
    const e = email.toLowerCase().trim();
    if (!isAllowedEmail(e)) {
      setError(DOMAIN_REJECT);
      return;
    }
    setBusy(true);
    try {
      const existsRes = await fetch(`/api/users/exists?email=${encodeURIComponent(e)}`);
      const existsData = await existsRes.json().catch(() => ({}));
      if (existsData?.exists) {
        setStep('login');
        return;
      }
      const res = await fetch('/api/users/signup-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || '인증 메일 발송에 실패했습니다.');
        return;
      }
      if (data?.alreadyMember) {
        setStep('login');
        return;
      }
      setStep('verify');
    } catch {
      setError('서버에 연결할 수 없습니다. 네트워크를 확인해주세요.');
    } finally {
      setBusy(false);
    }
  };

  // ── Step 2: 인증 코드 → signupToken ──
  const handleVerify = async () => {
    resetError();
    const c = code.trim();
    if (!/^\d{6}$/.test(c)) {
      setError('6자리 숫자 코드를 입력해주세요.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/users/signup-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: c }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.signupToken) {
        setError(data?.error || '인증에 실패했습니다.');
        return;
      }
      setSignupToken(data.signupToken);
      setStep('signup');
    } catch {
      setError('서버에 연결할 수 없습니다.');
    } finally {
      setBusy(false);
    }
  };

  // ── Step 3: 회원가입 완료 ──
  const handleSignup = async () => {
    resetError();
    if (!nickname.trim()) return setError('닉네임을 입력해주세요.');
    if (!corp.trim()) return setError('법인을 입력해주세요.');
    if (!org.trim()) return setError('조직(브랜드/팀)을 입력해주세요.');
    if (!pos.trim()) return setError('직무를 입력해주세요.');
    if (!isValidSimplePassword(pw)) return setError(PASSWORD_POLICY_MESSAGE);
    if (pw !== pw2) return setError('비밀번호가 일치하지 않습니다.');

    setBusy(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signupToken,
          nickname: nickname.trim(),
          corporationName: corp.trim(),
          organizationName: org.trim(),
          position: pos.trim(),
          password: pw,
          passwordConfirm: pw2,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || '가입에 실패했습니다.');
        return;
      }
      setUserInfo({
        visited: true,
        name: data.nickname,
        org: data.organizationName,
        role: data.position,
        email: data.email,
        corporationName: data.corporationName,
        organizationName: data.organizationName,
        position: data.position,
        userId: data.userId,
      });
      onSuccess();
    } catch {
      setError('서버에 연결할 수 없습니다.');
    } finally {
      setBusy(false);
    }
  };

  // ── Step 4: 로그인 ──
  const handleLogin = async () => {
    resetError();
    if (!pw) return setError('비밀번호를 입력해주세요.');
    setBusy(true);
    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pw, rememberMe }),
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || '비밀번호가 올바르지 않습니다.');
        return;
      }
      setUserInfo({
        visited: true,
        name: data.nickname,
        org: data.organizationName,
        role: data.position,
        email: data.email,
        corporationName: data.corporationName,
        organizationName: data.organizationName,
        position: data.position,
        userId: data.userId,
      });
      onSuccess();
    } catch {
      setError('서버에 연결할 수 없습니다.');
    } finally {
      setBusy(false);
    }
  };

  // ── Step 5: 비밀번호 재설정 요청 (이메일로 6자리 코드 발송) ──
  const handleResetRequest = async () => {
    resetError();
    setBusy(true);
    try {
      const res = await fetch('/api/users/reset-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || '인증 메일 발송에 실패했습니다.');
        return;
      }
      setResetCode('');
      setStep('reset-verify');
    } catch {
      setError('서버에 연결할 수 없습니다.');
    } finally {
      setBusy(false);
    }
  };

  // ── Step 6: 재설정 코드 인증 → resetToken ──
  const handleResetVerify = async () => {
    resetError();
    const c = resetCode.trim();
    if (!/^\d{6}$/.test(c)) {
      setError('6자리 숫자 코드를 입력해주세요.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/users/reset-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: c }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.resetToken) {
        setError(data?.error || '인증에 실패했습니다.');
        return;
      }
      setResetToken(data.resetToken);
      setResetPw('');
      setResetPw2('');
      setStep('reset-password');
    } catch {
      setError('서버에 연결할 수 없습니다.');
    } finally {
      setBusy(false);
    }
  };

  // ── Step 7: 새 비밀번호 설정 → 로그인 단계 복귀 ──
  const handleResetPassword = async () => {
    resetError();
    if (!isValidSimplePassword(resetPw)) return setError(PASSWORD_POLICY_MESSAGE);
    if (resetPw !== resetPw2) return setError('비밀번호가 일치하지 않습니다.');
    setBusy(true);
    try {
      const res = await fetch('/api/users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resetToken,
          password: resetPw,
          passwordConfirm: resetPw2,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || '비밀번호 재설정에 실패했습니다.');
        return;
      }
      setPw('');
      setResetCode('');
      setResetToken('');
      setResetPw('');
      setResetPw2('');
      setStep('login');
      setError('비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요.');
    } catch {
      setError('서버에 연결할 수 없습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: M.bg,
        fontFamily: M.fontKo,
        paddingTop: M.safeTop,
      }}
    >
      {/* 상단 히어로 */}
      <div
        style={{
          background: M.primaryLight,
          padding: '48px 24px 40px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            margin: '0 auto 20px',
            borderRadius: 18,
            background: M.primary,
            display: 'grid',
            placeItems: 'center',
            color: '#fff',
            fontFamily: M.fontEn,
            fontWeight: 800,
            fontSize: 28,
            letterSpacing: '-0.04em',
          }}
        >
          AI
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: M.text, margin: '0 0 6px' }}>
          이랜드 AI 캠퍼스
        </h1>
        <p style={{ fontSize: 13, color: M.textBody, margin: 0 }}>
          사내 임직원을 위한 AI 학습·실습 허브
        </p>
      </div>

      {/* 카드 */}
      <div style={{ padding: 16, maxWidth: M.maxW, margin: '0 auto' }}>
        <div
          style={{
            background: M.surface,
            borderRadius: M.r5,
            border: `1px solid ${M.border}`,
            boxShadow: M.shadowMd,
            padding: 24,
          }}
        >
          {step === 'email' && (
            <>
              <Title>시작하기</Title>
              <Sub>회사 이메일을 입력하시면 다음 단계로 안내합니다</Sub>
              <Input
                label="이메일"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="name@eland.co.kr"
                autoFocus
              />
              <Err msg={error} />
              <PrimaryButton onClick={handleEmailNext} busy={busy}>
                다음
              </PrimaryButton>
              <Hint>사내 임직원 인증 후 이용 가능합니다</Hint>
            </>
          )}

          {step === 'verify' && (
            <>
              <Title>인증 코드 입력</Title>
              <Sub>{email} 으로 발송된 6자리 코드를 입력해주세요</Sub>
              <Input
                label="인증 코드"
                type="text"
                value={code}
                onChange={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                autoFocus
              />
              <Err msg={error} />
              <PrimaryButton onClick={handleVerify} busy={busy}>
                인증하기
              </PrimaryButton>
              <SecondaryButton onClick={() => setStep('email')}>이메일 다시 입력</SecondaryButton>
            </>
          )}

          {step === 'signup' && (
            <>
              <Title>회원 정보 입력</Title>
              <Sub>{email}</Sub>
              <Input label="닉네임" type="text" value={nickname} onChange={setNickname} placeholder="홍길동" />
              <Input label="법인" type="text" value={corp} onChange={setCorp} placeholder="이랜드리테일" />
              <Input label="조직(브랜드/팀)" type="text" value={org} onChange={setOrg} placeholder="DX센터" />
              <Input label="직무" type="text" value={pos} onChange={setPos} placeholder="AI 엔지니어" />
              <Input
                label="비밀번호"
                type="password"
                value={pw}
                onChange={setPw}
                placeholder="예: Eland@2026"
                maxLength={16}
              />
              <Input
                label="비밀번호 확인"
                type="password"
                value={pw2}
                onChange={setPw2}
                placeholder=""
                maxLength={16}
              />
              <PolicyHint>{PASSWORD_POLICY_MESSAGE}</PolicyHint>
              <Err msg={error} />
              <PrimaryButton onClick={handleSignup} busy={busy}>
                가입 완료
              </PrimaryButton>
            </>
          )}

          {step === 'login' && (
            <>
              <Title>로그인</Title>
              <Sub>{email}</Sub>
              <Input
                label="비밀번호"
                type="password"
                value={pw}
                onChange={setPw}
                placeholder=""
                maxLength={16}
                autoFocus
              />
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  margin: '4px 0 16px',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: M.primary, margin: 0 }}
                />
                <span style={{ fontSize: 13, color: M.textBody }}>
                  로그인 유지 <span style={{ color: M.textMuted }}>(30일)</span>
                </span>
              </label>
              <Err msg={error} />
              <PrimaryButton onClick={handleLogin} busy={busy}>
                로그인
              </PrimaryButton>
              <button
                type="button"
                onClick={handleResetRequest}
                disabled={busy}
                style={{
                  width: '100%',
                  height: 40,
                  marginTop: 8,
                  background: 'transparent',
                  border: 'none',
                  color: M.primary,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: busy ? 'not-allowed' : 'pointer',
                  opacity: busy ? 0.5 : 1,
                  fontFamily: M.fontKo,
                }}
              >
                비밀번호를 잊으셨나요?
              </button>
              <SecondaryButton onClick={() => { setStep('email'); setPw(''); }}>
                이메일 다시 입력
              </SecondaryButton>
            </>
          )}

          {step === 'reset-verify' && (
            <>
              <Title>비밀번호 재설정</Title>
              <Sub>{email} 으로 발송된 6자리 코드를 입력해주세요</Sub>
              <Input
                label="인증 코드"
                type="text"
                value={resetCode}
                onChange={(v) => setResetCode(v.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                autoFocus
              />
              <Err msg={error} />
              <PrimaryButton onClick={handleResetVerify} busy={busy}>
                인증하기
              </PrimaryButton>
              <SecondaryButton onClick={() => { setStep('login'); resetError(); }}>
                로그인으로 돌아가기
              </SecondaryButton>
            </>
          )}

          {step === 'reset-password' && (
            <>
              <Title>새 비밀번호 설정</Title>
              <Sub>{email}</Sub>
              <Input
                label="새 비밀번호"
                type="password"
                value={resetPw}
                onChange={setResetPw}
                placeholder="예: Eland@2026"
                maxLength={16}
                autoFocus
              />
              <Input
                label="새 비밀번호 확인"
                type="password"
                value={resetPw2}
                onChange={setResetPw2}
                placeholder=""
                maxLength={16}
              />
              <PolicyHint>{PASSWORD_POLICY_MESSAGE}</PolicyHint>
              <Err msg={error} />
              <PrimaryButton onClick={handleResetPassword} busy={busy}>
                비밀번호 변경
              </PrimaryButton>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 작은 컴포넌트들 ──
function Title({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: 20, fontWeight: 800, color: M.text, margin: '0 0 4px' }}>{children}</h2>;
}
function Sub({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 13, color: M.textMuted, margin: '0 0 24px' }}>{children}</p>;
}
function Hint({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 12, color: M.textMuted, margin: '12px 0 0', textAlign: 'center' }}>{children}</p>;
}
function PolicyHint({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 11, color: M.textMuted, margin: '-4px 0 12px', lineHeight: 1.4 }}>{children}</p>;
}
function Err({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div
      role="alert"
      style={{
        background: M.dangerBg,
        color: M.danger,
        fontSize: 13,
        padding: '10px 12px',
        borderRadius: M.r2,
        margin: '0 0 12px',
      }}
    >
      {msg}
    </div>
  );
}
function Input({
  label, type, value, onChange, placeholder, autoFocus, maxLength,
}: {
  label: string;
  type: 'text' | 'email' | 'password';
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  maxLength?: number;
}) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: M.textMuted, marginBottom: 6 }}>
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        maxLength={maxLength}
        autoComplete={type === 'password' ? 'current-password' : type === 'email' ? 'email' : undefined}
        style={{
          width: '100%',
          height: 56,
          padding: '0 16px',
          borderRadius: M.r3,
          border: `1.5px solid ${M.border}`,
          background: M.surfaceAlt,
          fontSize: 16,
          color: M.text,
          outline: 'none',
          boxSizing: 'border-box',
          fontFamily: M.fontKo,
        }}
        onFocus={(e) => {
          (e.currentTarget as HTMLInputElement).style.borderColor = M.primary;
          // 가상 키보드 안 가려지게
          setTimeout(() => e.currentTarget?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
        }}
        onBlur={(e) => ((e.currentTarget as HTMLInputElement).style.borderColor = M.border)}
      />
    </label>
  );
}
function PrimaryButton({
  onClick, busy, children,
}: {
  onClick: () => void;
  busy?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      style={{
        width: '100%',
        height: 56,
        borderRadius: M.r3,
        border: 'none',
        background: M.primary,
        color: '#fff',
        fontSize: 16,
        fontWeight: 700,
        cursor: busy ? 'not-allowed' : 'pointer',
        opacity: busy ? 0.6 : 1,
        marginBottom: 8,
        fontFamily: M.fontKo,
      }}
    >
      {busy ? '처리 중...' : children}
    </button>
  );
}
function SecondaryButton({
  onClick, children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        height: 48,
        borderRadius: M.r3,
        border: `1px solid ${M.border}`,
        background: M.surface,
        color: M.textBody,
        fontSize: 14,
        fontWeight: 600,
        cursor: 'pointer',
        marginTop: 4,
        fontFamily: M.fontKo,
      }}
    >
      {children}
    </button>
  );
}
