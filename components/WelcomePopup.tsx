"use client";

import { useState, useEffect } from 'react';
import { setUserInfo } from '../lib/utils';
import { isAllowedSignupEmail, DOMAIN_REJECT_MESSAGE } from '../lib/email-allowlist';
import { isValidSimplePassword, PASSWORD_POLICY_MESSAGE } from '../lib/password';
import SearchableSelect from './SearchableSelect';
import { CORPORATIONS, ORG_DIRECTORY_CORP, CORP_OTHER, type OrgDepartment } from '../lib/org';

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

type Step = 'email' | 'verify' | 'signup' | 'login' | 'welcome' | 'reset-verify' | 'reset-password';

interface Props { onClose: (target?: 'home' | 'videos') => void; }

const inputStyle: React.CSSProperties = {
  width: '100%', height: 42, padding: '0 14px',
  border: `1.5px solid ${T.border}`, borderRadius: T.r,
  fontSize: 14, color: T.text, fontFamily: T.fontKo,
  outline: 'none', background: T.surface, boxSizing: 'border-box',
};

// 비밀번호 입력 + 눈 아이콘 토글
function PasswordField({
  value, onChange, placeholder, maxLength = 16, autoFocus, onEnter,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  autoFocus?: boolean;
  onEnter?: () => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        autoFocus={autoFocus}
        onKeyDown={e => e.key === 'Enter' && onEnter && onEnter()}
        style={{ ...inputStyle, paddingRight: 44 }}
      />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        aria-label={visible ? '비밀번호 숨기기' : '비밀번호 보기'}
        style={{
          position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
          width: 32, height: 32, border: 'none', background: 'transparent',
          cursor: 'pointer', color: T.textMuted, padding: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {visible ? (
          // eye-off
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"/>
          </svg>
        ) : (
          // eye
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        )}
      </button>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: T.text, marginBottom: 6,
};

const errorStyle: React.CSSProperties = {
  fontSize: 12, color: T.danger, marginTop: 6, fontWeight: 500,
};

const primaryBtn: React.CSSProperties = {
  width: '100%', height: 44, border: 'none', borderRadius: T.r,
  background: T.primary, color: '#fff', fontSize: 14, fontWeight: 600,
  cursor: 'pointer', fontFamily: T.fontKo,
};

const ghostBtn: React.CSSProperties = {
  width: '100%', height: 44, border: `1.5px solid ${T.border}`, borderRadius: T.r,
  background: T.surface, color: T.text, fontSize: 14, fontWeight: 500,
  cursor: 'pointer', fontFamily: T.fontKo,
};

export default function WelcomePopup({ onClose }: Props) {
  const [step, setStep] = useState<Step>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // 공통
  const [email, setEmail] = useState('');

  // 인증 코드
  const [code, setCode] = useState('');
  const [signupToken, setSignupToken] = useState('');

  // 가입 폼
  const [nickname, setNickname] = useState('');
  const [corporationName, setCorporationName] = useState('');
  const [corpOther, setCorpOther] = useState('');           // 법인=기타 직접입력
  const [organizationName, setOrganizationName] = useState('');
  const [position, setPosition] = useState('');
  const [pw, setPw] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');

  // 조직 분류(부서/직무) — 이랜드리테일 선택 시 드롭다운 소스
  const [orgDepartments, setOrgDepartments] = useState<OrgDepartment[]>([]);
  const [orgLoaded, setOrgLoaded] = useState(false);
  const [orgError, setOrgError] = useState(false);

  // signup step 진입 시 1회 조회 (비PII·no-store)
  useEffect(() => {
    if (step !== 'signup' || orgLoaded) return;
    let cancelled = false;
    fetch(`/api/org-units?corp=${encodeURIComponent(ORG_DIRECTORY_CORP)}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('load'))))
      .then((d: { departments?: OrgDepartment[] }) => {
        if (!cancelled) { setOrgDepartments(d.departments || []); setOrgLoaded(true); }
      })
      .catch(() => { if (!cancelled) { setOrgError(true); setOrgLoaded(true); } });
    return () => { cancelled = true; };
  }, [step, orgLoaded]);

  // 로그인 폼
  const [loginPw, setLoginPw] = useState('');
  // 자동로그인 기본 ON (30일) — 모바일·문서 정책과 일치. 서버 세션 6h 만료로 인한 '로그인했는데 401' 방지.
  const [rememberMe, setRememberMe] = useState(true);

  // 비밀번호 재설정
  const [resetCode, setResetCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resetPw, setResetPw] = useState('');
  const [resetPwConfirm, setResetPwConfirm] = useState('');

  const resetError = () => setError('');

  // Step 1: 이메일 입력 → 인증 코드 요청 (or 로그인 분기)
  const handleEmailNext = async () => {
    resetError();
    const e = email.toLowerCase().trim();
    if (!isAllowedSignupEmail(e)) {
      setError(DOMAIN_REJECT_MESSAGE);
      return;
    }
    setEmail(e);
    setBusy(true);
    try {
      // 인증 코드 발송 (가입 여부는 signup-request 응답으로 판단)
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
      setError('서버에 연결할 수 없습니다.');
    } finally {
      setBusy(false);
    }
  };

  // Step 2: 인증 코드 입력 → 검증
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

  const handleResendCode = async () => {
    resetError();
    setBusy(true);
    try {
      const res = await fetch('/api/users/signup-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || '재발송에 실패했습니다.');
        return;
      }
      setError('새 인증 코드를 발송했습니다.');
    } catch {
      setError('서버에 연결할 수 없습니다.');
    } finally {
      setBusy(false);
    }
  };

  // Step 3: 회원가입 완료
  const handleSignup = async () => {
    resetError();
    // 법인=기타면 직접입력한 법인명을 최종값으로 사용
    const finalCorp = corporationName === CORP_OTHER ? corpOther.trim() : corporationName.trim();
    if (!corporationName.trim()) return setError('법인을 선택해주세요.');
    if (corporationName === CORP_OTHER && !corpOther.trim()) return setError('법인명을 입력해주세요.');
    if (!nickname.trim()) return setError('닉네임을 입력해주세요.');
    if (!organizationName.trim()) return setError('부서(브랜드/팀)을 입력해주세요.');
    if (!position.trim()) return setError('직무를 입력해주세요.');
    if (!isValidSimplePassword(pw)) return setError(PASSWORD_POLICY_MESSAGE);
    if (pw !== pwConfirm) return setError('비밀번호가 일치하지 않습니다.');

    setBusy(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signupToken,
          nickname: nickname.trim(),
          corporationName: finalCorp,
          organizationName: organizationName.trim(),
          position: position.trim(),
          password: pw,
          passwordConfirm: pwConfirm,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || '가입에 실패했습니다.');
        return;
      }
      // 로컬에도 사용자 정보 저장 (클라이언트 표시용)
      setUserInfo({
        visited: true,
        name: data.nickname,
        org: data.organizationName,
        role: data.position,
        email: data.email,
        corporationName: data.corporationName,
        organizationName: data.organizationName,
        position: data.position,
        userId: data.id,
      });
      // 가입 성공 → 환영 화면으로 전환 (홈/영상 분기 선택)
      setStep('welcome');
    } catch {
      setError('서버에 연결할 수 없습니다.');
    } finally {
      setBusy(false);
    }
  };

  // 로그인
  const handleLogin = async () => {
    resetError();
    if (!loginPw) return setError('비밀번호를 입력해주세요.');
    setBusy(true);
    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: loginPw, rememberMe }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || '로그인에 실패했습니다.');
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
        userId: data.id,
      });
      onClose();
    } catch {
      setError('서버에 연결할 수 없습니다.');
    } finally {
      setBusy(false);
    }
  };

  // 비밀번호 재설정 — 로그인 단계에서 진입 (email 이미 입력됨)
  const handleResetRequest = async () => {
    resetError();
    setBusy(true);
    try {
      const res = await fetch('/api/users/reset-request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data?.error || '인증 메일 발송에 실패했습니다.'); return; }
      setStep('reset-verify');
    } catch {
      setError('서버에 연결할 수 없습니다.');
    } finally {
      setBusy(false);
    }
  };

  const handleResetVerify = async () => {
    resetError();
    const c = resetCode.trim();
    if (!/^\d{6}$/.test(c)) { setError('6자리 숫자 코드를 입력해주세요.'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/users/reset-verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: c }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.resetToken) { setError(data?.error || '인증에 실패했습니다.'); return; }
      setResetToken(data.resetToken);
      setStep('reset-password');
    } catch {
      setError('서버에 연결할 수 없습니다.');
    } finally {
      setBusy(false);
    }
  };

  const handleResetPassword = async () => {
    resetError();
    if (!isValidSimplePassword(resetPw)) { setError(PASSWORD_POLICY_MESSAGE); return; }
    if (resetPw !== resetPwConfirm) { setError('비밀번호가 일치하지 않습니다.'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/users/reset-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken, password: resetPw, passwordConfirm: resetPwConfirm }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data?.error || '비밀번호 재설정에 실패했습니다.'); return; }
      // 성공 → 로그인 단계로 복귀 + 안내
      setLoginPw(''); setResetPw(''); setResetPwConfirm(''); setResetCode(''); setResetToken('');
      setStep('login');
      setError('비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요.');
    } catch {
      setError('서버에 연결할 수 없습니다.');
    } finally {
      setBusy(false);
    }
  };

  const goBack = () => {
    resetError();
    if (step === 'verify') { setStep('email'); setCode(''); }
    else if (step === 'signup') { setStep('verify'); }
    else if (step === 'login') { setStep('email'); setLoginPw(''); }
    else if (step === 'reset-verify') { setStep('login'); setResetCode(''); }
    else if (step === 'reset-password') { setStep('reset-verify'); }
  };

  // 부서/직무 드롭다운 노출 조건 및 소스
  const isRetail = corporationName === ORG_DIRECTORY_CORP;
  const useOrgDropdown = isRetail && orgLoaded && !orgError && orgDepartments.length > 0;
  const departmentNames = orgDepartments.map(d => d.department);
  const positionsForDept = orgDepartments.find(d => d.department === organizationName)?.positions ?? [];
  const deptInList = departmentNames.includes(organizationName);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(15,30,51,0.55)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      fontFamily: T.fontKo,
    }}>
      <div style={{
        background: T.surface, borderRadius: T.r3, padding: 28,
        width: '100%', maxWidth: 420, maxHeight: 'calc(100vh - 32px)',
        overflowY: 'auto', boxShadow: T.shadowLg,
      }}>
        {/* 헤더 */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, margin: '0 auto 12px',
            background: 'linear-gradient(135deg, #1647A8 0%, #0A1530 100%)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 700, letterSpacing: '-0.04em',
          }}>Eland</div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: T.text }}>
            {step === 'email' && '이랜드 AI 캠퍼스에 오신 것을 환영합니다'}
            {step === 'verify' && '인증 코드 입력'}
            {step === 'signup' && '회원 정보 입력'}
            {step === 'login' && '로그인'}
            {step === 'reset-verify' && '비밀번호 재설정'}
            {step === 'reset-password' && '새 비밀번호 설정'}
            {step === 'welcome' && (<>환영합니다, <span style={{ color: T.primary }}>{nickname}</span>님!</>)}
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: T.textMuted, lineHeight: 1.5 }}>
            {step === 'email' && '사내 메일 주소(@eland.co.kr)로 시작하세요'}
            {step === 'verify' && (<>
              <strong style={{ color: T.text }}>{email}</strong>로 전송된 6자리 코드를 입력하세요
            </>)}
            {step === 'signup' && '닉네임과 소속 정보를 입력해주세요'}
            {step === 'login' && (<>{email} 비밀번호를 입력해주세요</>)}
            {step === 'reset-verify' && (<>
              <strong style={{ color: T.text }}>{email}</strong>로 전송된 6자리 코드를 입력하세요
            </>)}
            {step === 'reset-password' && '새로 사용할 비밀번호를 입력하세요'}
            {step === 'welcome' && '지금 바로 AI 학습을 시작해보세요.'}
          </p>
        </div>

        {error && (
          <div style={{
            background: T.dangerBg, border: `1px solid #FBCBD2`, borderRadius: T.r,
            padding: '10px 12px', marginBottom: 14, fontSize: 13, color: T.danger, lineHeight: 1.5,
          }}>
            {error}
          </div>
        )}

        {/* Step: email */}
        {step === 'email' && (
          <>
            <label style={labelStyle}>이메일 *</label>
            <input type="email" value={email}
              placeholder="hong.gd@eland.co.kr"
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !busy && handleEmailNext()}
              style={inputStyle} autoFocus />
            <button onClick={handleEmailNext} disabled={busy}
              style={{ ...primaryBtn, marginTop: 16, opacity: busy ? 0.6 : 1 }}>
              {busy ? '확인 중...' : '다음'}
            </button>
          </>
        )}

        {/* Step: verify */}
        {step === 'verify' && (
          <>
            <label style={labelStyle}>인증 코드 (6자리) *</label>
            <input type="text" inputMode="numeric" maxLength={6}
              value={code}
              placeholder="123456"
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => e.key === 'Enter' && !busy && handleVerify()}
              style={{ ...inputStyle, fontSize: 18, letterSpacing: 4, textAlign: 'center', fontWeight: 600 }} autoFocus />
            <p style={{ margin: '8px 0 0', fontSize: 12, color: T.textFaint }}>
              코드가 안 왔다면 스팸함도 확인하시고, 10분 후에는 만료됩니다.
            </p>
            <button onClick={handleVerify} disabled={busy}
              style={{ ...primaryBtn, marginTop: 16, opacity: busy ? 0.6 : 1 }}>
              {busy ? '확인 중...' : '인증하기'}
            </button>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={goBack} disabled={busy} style={{ ...ghostBtn, height: 36, fontSize: 12 }}>
                이메일 변경
              </button>
              <button onClick={handleResendCode} disabled={busy} style={{ ...ghostBtn, height: 36, fontSize: 12 }}>
                코드 재발송
              </button>
            </div>
          </>
        )}

        {/* Step: signup */}
        {step === 'signup' && (
          <>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>닉네임 *</label>
              <input value={nickname} onChange={e => setNickname(e.target.value)}
                placeholder="예: 김캠퍼스" style={inputStyle} maxLength={20} />
            </div>
            {/* 법인 — 고정 7개 드롭다운. '기타' 선택 시 직접입력 */}
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>법인 *</label>
              <SearchableSelect
                options={CORPORATIONS}
                value={corporationName}
                onChange={v => { setCorporationName(v); setOrganizationName(''); setPosition(''); if (v !== CORP_OTHER) setCorpOther(''); }}
                allowCustom={false}
                placeholder="법인을 선택하세요"
                triggerStyle={inputStyle}
                ariaLabel="법인 선택"
              />
              {corporationName === CORP_OTHER && (
                <input value={corpOther} onChange={e => setCorpOther(e.target.value)}
                  placeholder="법인명을 입력하세요" style={{ ...inputStyle, marginTop: 8 }} maxLength={40} />
              )}
            </div>

            {/* 부서 — 이랜드리테일이면 검색 드롭다운, 그 외 직접입력 */}
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>부서(브랜드/팀) *</label>
              {useOrgDropdown ? (
                <SearchableSelect
                  options={departmentNames}
                  value={organizationName}
                  onChange={v => { setOrganizationName(v); setPosition(''); }}
                  placeholder="부서를 검색·선택하세요"
                  customPlaceholder="부서 직접 입력"
                  triggerStyle={inputStyle}
                  maxLength={40}
                  ariaLabel="부서 선택"
                />
              ) : (
                <input value={organizationName} onChange={e => setOrganizationName(e.target.value)}
                  placeholder="예: 뉴발란스 상품기획팀" style={inputStyle} maxLength={40} />
              )}
              {isRetail && orgError && (
                <p style={{ margin: '6px 0 0', fontSize: 11, color: T.textMuted }}>
                  목록을 불러오지 못해 직접 입력합니다.
                </p>
              )}
            </div>

            {/* 직무 — 부서에 종속(cascading) */}
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>직무 *</label>
              {!useOrgDropdown ? (
                <input value={position} onChange={e => setPosition(e.target.value)}
                  placeholder="예: 상품기획, 생산, OO OO점 점장, 지점 인사팀"
                  style={inputStyle} maxLength={40} />
              ) : deptInList ? (
                <SearchableSelect
                  options={positionsForDept}
                  value={position}
                  onChange={setPosition}
                  placeholder="직무를 검색·선택하세요"
                  customPlaceholder="직무 직접 입력"
                  triggerStyle={inputStyle}
                  maxLength={40}
                  ariaLabel="직무 선택"
                />
              ) : organizationName ? (
                <input value={position} onChange={e => setPosition(e.target.value)}
                  placeholder="직무 직접 입력" style={inputStyle} maxLength={40} />
              ) : (
                <div style={{ ...inputStyle, display: 'flex', alignItems: 'center',
                  color: T.textFaint, background: '#F1F5F9', cursor: 'not-allowed' }}>
                  부서를 먼저 선택하세요
                </div>
              )}
            </div>
            <div style={{ marginBottom: 4 }}>
              <label style={labelStyle}>비밀번호 *</label>
              <PasswordField value={pw} onChange={setPw} placeholder="예: Eland@2026" maxLength={16} />
              <p style={{ margin: '6px 0 12px', fontSize: 11, color: T.textMuted, lineHeight: 1.5 }}>
                8~16자, 영문 / 숫자 / 특수문자를 각 1개 이상 포함해주세요.
              </p>
            </div>
            <div style={{ marginBottom: 6 }}>
              <label style={labelStyle}>비밀번호 확인 *</label>
              <PasswordField
                value={pwConfirm}
                onChange={setPwConfirm}
                placeholder="비밀번호를 다시 입력하세요"
                maxLength={16}
                onEnter={() => !busy && handleSignup()}
              />
              {pwConfirm && pw !== pwConfirm && (
                <p style={errorStyle}>비밀번호가 일치하지 않습니다.</p>
              )}
            </div>
            <button onClick={handleSignup} disabled={busy}
              style={{ ...primaryBtn, marginTop: 16, opacity: busy ? 0.6 : 1 }}>
              {busy ? '가입 처리 중...' : '가입 완료'}
            </button>
          </>
        )}

        {/* Step: login */}
        {step === 'login' && (
          <>
            <label style={labelStyle}>간편 비밀번호 *</label>
            <PasswordField
              value={loginPw}
              onChange={setLoginPw}
              placeholder="비밀번호 입력"
              autoFocus
              onEnter={() => !busy && handleLogin()}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, cursor: 'pointer' }}>
              <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: T.primary }} />
              <span style={{ fontSize: 13, color: T.textMuted }}>로그인 유지 (30일)</span>
            </label>
            <button onClick={handleLogin} disabled={busy}
              style={{ ...primaryBtn, marginTop: 16, opacity: busy ? 0.6 : 1 }}>
              {busy ? '로그인 중...' : '로그인'}
            </button>
            <button onClick={goBack} disabled={busy}
              style={{ ...ghostBtn, marginTop: 8, height: 36, fontSize: 12 }}>
              다른 이메일로 시도
            </button>
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <button onClick={handleResetRequest} disabled={busy}
                style={{ background: 'none', border: 'none', color: T.textMuted, fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline', fontFamily: T.fontKo }}>
                비밀번호를 잊으셨나요?
              </button>
            </div>
          </>
        )}

        {/* Step: reset-verify */}
        {step === 'reset-verify' && (
          <>
            <label style={labelStyle}>인증 코드 (6자리) *</label>
            <input type="text" inputMode="numeric" maxLength={6}
              value={resetCode}
              placeholder="123456"
              onChange={e => setResetCode(e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => e.key === 'Enter' && !busy && handleResetVerify()}
              style={{ ...inputStyle, fontSize: 18, letterSpacing: 4, textAlign: 'center', fontWeight: 600 }} autoFocus />
            <p style={{ margin: '8px 0 0', fontSize: 12, color: T.textFaint }}>
              코드가 안 왔다면 스팸함도 확인하시고, 10분 후에는 만료됩니다.
            </p>
            <button onClick={handleResetVerify} disabled={busy}
              style={{ ...primaryBtn, marginTop: 16, opacity: busy ? 0.6 : 1 }}>
              {busy ? '확인 중...' : '인증하기'}
            </button>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={goBack} disabled={busy} style={{ ...ghostBtn, height: 36, fontSize: 12 }}>
                뒤로
              </button>
              <button onClick={handleResetRequest} disabled={busy} style={{ ...ghostBtn, height: 36, fontSize: 12 }}>
                코드 재발송
              </button>
            </div>
          </>
        )}

        {/* Step: reset-password */}
        {step === 'reset-password' && (
          <>
            <div style={{ marginBottom: 4 }}>
              <label style={labelStyle}>새 비밀번호 *</label>
              <PasswordField value={resetPw} onChange={setResetPw} placeholder="예: Eland@2026" maxLength={16} autoFocus />
              <p style={{ margin: '6px 0 12px', fontSize: 11, color: T.textMuted, lineHeight: 1.5 }}>
                8~16자, 영문 / 숫자 / 특수문자를 각 1개 이상 포함해주세요.
              </p>
            </div>
            <div style={{ marginBottom: 6 }}>
              <label style={labelStyle}>새 비밀번호 확인 *</label>
              <PasswordField
                value={resetPwConfirm}
                onChange={setResetPwConfirm}
                placeholder="비밀번호를 다시 입력하세요"
                maxLength={16}
                onEnter={() => !busy && handleResetPassword()}
              />
              {resetPwConfirm && resetPw !== resetPwConfirm && (
                <p style={errorStyle}>비밀번호가 일치하지 않습니다.</p>
              )}
            </div>
            <button onClick={handleResetPassword} disabled={busy}
              style={{ ...primaryBtn, marginTop: 16, opacity: busy ? 0.6 : 1 }}>
              {busy ? '변경 중...' : '비밀번호 변경'}
            </button>
          </>
        )}

        {/* Step: welcome (가입 직후 분기) */}
        {step === 'welcome' && (
          <>
            <div style={{
              background: T.primaryLight, border: `1px solid ${T.border}`,
              borderRadius: T.r2, padding: 18, marginBottom: 14, textAlign: 'center',
            }}>
              <div style={{ fontSize: 36, marginBottom: 6 }}>🎉</div>
              <p style={{ margin: 0, fontSize: 13, color: T.text, lineHeight: 1.6 }}>
                회원가입이 완료되었습니다.<br/>
                무엇부터 시작할까요?
              </p>
            </div>
            <button onClick={() => onClose('videos')}
              style={{ ...primaryBtn, marginBottom: 8 }}>
              AI 학습 시작하기
            </button>
            <button onClick={() => onClose('home')}
              style={ghostBtn}>
              홈에서 둘러보기
            </button>
          </>
        )}
      </div>
    </div>
  );
}
