"use client";

import { useState } from 'react';
import { UserInfo } from '../lib/utils';

const T = {
  primary: '#004A99', primaryLight: '#E6EEF7',
  text: '#0F1E33', textBody: '#3B4A63', textMuted: '#6B7A91', textFaint: '#9BA7BC',
  border: '#E5EAF1', surface: '#FFFFFF', bg: '#F5F7FA',
  danger: '#D8364C', dangerBg: '#FCE6EA',
  success: '#1E9E6A', successBg: '#E6F6EE',
  r: 8, r2: 12, r3: 16,
  fontKo: '"Noto Sans KR", "Inter", system-ui, sans-serif',
};

interface Props {
  user: UserInfo;
  onClose: () => void;
  onAccountDeleted: () => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%', height: 42, padding: '0 44px 0 12px', boxSizing: 'border-box',
  border: `1.5px solid ${T.border}`, borderRadius: T.r,
  fontSize: 14, color: T.text, outline: 'none', fontFamily: T.fontKo, background: T.surface,
};

function PwInput({ value, onChange, placeholder, autoFocus }: {
  value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={16}
        autoFocus={autoFocus}
        style={inputStyle}
      />
      <button type="button" onClick={() => setShow(s => !s)}
        aria-label={show ? '숨기기' : '보기'}
        style={{
          position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
          width: 32, height: 32, border: 'none', background: 'transparent', cursor: 'pointer',
          color: T.textMuted, fontSize: 11, fontWeight: 600,
        }}>
        {show ? '숨기기' : '보기'}
      </button>
    </div>
  );
}

export default function MyPageModal({ user, onClose, onAccountDeleted }: Props) {
  // 비밀번호 변경
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPwConfirm, setNewPwConfirm] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // 회원 탈퇴
  const [showDelete, setShowDelete] = useState(false);
  const [delPw, setDelPw] = useState('');
  const [delBusy, setDelBusy] = useState(false);
  const [delErr, setDelErr] = useState('');

  const handleChangePw = async () => {
    setPwMsg(null);
    if (!curPw || !newPw || !newPwConfirm) { setPwMsg({ type: 'error', text: '모든 항목을 입력해주세요.' }); return; }
    if (newPw !== newPwConfirm) { setPwMsg({ type: 'error', text: '새 비밀번호가 일치하지 않습니다.' }); return; }
    setPwBusy(true);
    try {
      const res = await fetch('/api/users/change-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ currentPassword: curPw, newPassword: newPw, newPasswordConfirm: newPwConfirm }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setPwMsg({ type: 'error', text: data?.error || '변경에 실패했습니다.' }); return; }
      setPwMsg({ type: 'success', text: '비밀번호가 변경되었습니다.' });
      setCurPw(''); setNewPw(''); setNewPwConfirm('');
    } catch {
      setPwMsg({ type: 'error', text: '서버에 연결할 수 없습니다.' });
    } finally {
      setPwBusy(false);
    }
  };

  const handleDelete = async () => {
    setDelErr('');
    if (!delPw) { setDelErr('비밀번호를 입력해주세요.'); return; }
    setDelBusy(true);
    try {
      const res = await fetch('/api/users/me', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ password: delPw }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setDelErr(data?.error || '탈퇴에 실패했습니다.'); return; }
      onAccountDeleted();
    } catch {
      setDelErr('서버에 연결할 수 없습니다.');
    } finally {
      setDelBusy(false);
    }
  };

  const label: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: T.text, marginBottom: 6 };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(15,30,51,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        fontFamily: T.fontKo,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: T.surface, borderRadius: T.r3, width: '100%', maxWidth: 440,
          maxHeight: 'calc(100vh - 32px)', overflowY: 'auto',
          boxShadow: '0 16px 48px rgba(15,30,51,0.22)',
        }}
      >
        {/* 헤더 */}
        <div style={{
          position: 'sticky', top: 0, background: T.surface,
          borderBottom: `1px solid ${T.border}`, padding: '18px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 1,
        }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: T.text }}>마이페이지</h2>
          <button onClick={onClose} aria-label="닫기"
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: T.textMuted, fontSize: 18 }}>
            ✕
          </button>
        </div>

        <div style={{ padding: 24 }}>
          {/* 프로필 */}
          <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.r2, padding: 18, marginBottom: 24 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: T.text, marginBottom: 2 }}>{user.name || '회원'}</div>
            <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 12, fontFamily: 'Inter, sans-serif' }}>{user.email}</div>
            <div style={{ display: 'grid', gap: 4, fontSize: 13, color: T.textBody }}>
              {(user.corporationName || user.org) && <div>법인: {user.corporationName || user.org}</div>}
              {user.organizationName && <div>조직: {user.organizationName}</div>}
              {(user.position || user.role) && <div>직무: {user.position || user.role}</div>}
            </div>
          </div>

          {/* 비밀번호 변경 */}
          <section style={{ marginBottom: 28 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: T.text }}>비밀번호 변경</h3>
            <div style={{ marginBottom: 10 }}>
              <label style={label}>현재 비밀번호</label>
              <PwInput value={curPw} onChange={setCurPw} placeholder="현재 비밀번호" />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={label}>새 비밀번호</label>
              <PwInput value={newPw} onChange={setNewPw} placeholder="8~16자, 영문/숫자/특수문자" />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={label}>새 비밀번호 확인</label>
              <PwInput value={newPwConfirm} onChange={setNewPwConfirm} placeholder="새 비밀번호를 다시 입력" />
              {newPwConfirm && newPw !== newPwConfirm && (
                <p style={{ margin: '6px 0 0', fontSize: 12, color: T.danger }}>비밀번호가 일치하지 않습니다.</p>
              )}
            </div>
            {pwMsg && (
              <div style={{
                fontSize: 12.5, padding: '8px 12px', borderRadius: T.r, marginBottom: 10,
                background: pwMsg.type === 'success' ? T.successBg : T.dangerBg,
                color: pwMsg.type === 'success' ? T.success : T.danger,
              }}>
                {pwMsg.text}
              </div>
            )}
            <button onClick={handleChangePw} disabled={pwBusy}
              style={{
                width: '100%', height: 42, border: 'none', borderRadius: T.r,
                background: T.primary, color: '#fff', fontSize: 13.5, fontWeight: 600,
                cursor: 'pointer', fontFamily: T.fontKo, opacity: pwBusy ? 0.6 : 1,
              }}>
              {pwBusy ? '변경 중...' : '비밀번호 변경'}
            </button>
          </section>

          {/* 회원 탈퇴 (위험 구역) */}
          <section style={{ borderTop: `1px solid ${T.border}`, paddingTop: 20 }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 700, color: T.danger }}>회원 탈퇴</h3>
            <p style={{ margin: '0 0 12px', fontSize: 12.5, color: T.textMuted, lineHeight: 1.6 }}>
              탈퇴 시 회원 정보·예약 기록·인증 이력이 모두 삭제되며 되돌릴 수 없습니다.
            </p>
            {!showDelete ? (
              <button onClick={() => { setShowDelete(true); setDelErr(''); }}
                style={{
                  height: 40, padding: '0 16px', borderRadius: T.r,
                  border: `1px solid ${T.danger}`, background: T.surface, color: T.danger,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: T.fontKo,
                }}>
                회원 탈퇴하기
              </button>
            ) : (
              <div style={{ background: T.dangerBg, border: `1px solid #FBCBD2`, borderRadius: T.r2, padding: 16 }}>
                <label style={label}>본인 확인 — 비밀번호 입력</label>
                <PwInput value={delPw} onChange={setDelPw} placeholder="비밀번호" autoFocus />
                {delErr && <p style={{ margin: '8px 0 0', fontSize: 12.5, color: T.danger }}>{delErr}</p>}
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button onClick={handleDelete} disabled={delBusy}
                    style={{
                      flex: 1, height: 42, border: 'none', borderRadius: T.r,
                      background: T.danger, color: '#fff', fontSize: 13.5, fontWeight: 600,
                      cursor: 'pointer', fontFamily: T.fontKo, opacity: delBusy ? 0.6 : 1,
                    }}>
                    {delBusy ? '처리 중...' : '탈퇴 확정'}
                  </button>
                  <button onClick={() => { setShowDelete(false); setDelPw(''); setDelErr(''); }} disabled={delBusy}
                    style={{
                      flex: '0 0 80px', height: 42, borderRadius: T.r,
                      border: `1px solid ${T.border}`, background: T.surface, color: T.textMuted,
                      fontSize: 13.5, fontWeight: 500, cursor: 'pointer', fontFamily: T.fontKo,
                    }}>
                    취소
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
