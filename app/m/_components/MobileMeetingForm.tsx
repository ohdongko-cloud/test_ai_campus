'use client';

import { useEffect, useState } from 'react';
import { M } from '../_styles/tokens';
import { getUserInfo } from '../../../lib/utils';

interface SelectedSlot {
  date: string;
  startTime: string;
  endTime: string;
}

interface Props {
  slot: SelectedSlot;
  onCancel: () => void;
  onSubmit: (data: {
    name: string;
    role: string;
    taskSummary: string;
    inquiry: string;
    email: string;
    phone: string;
    date: string;
    startTime: string;
    endTime: string;
  }) => Promise<{ ok: boolean; error?: string }>;
}

function isEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function isPhone(s: string) {
  // 한국 휴대전화/유선 — 숫자 9~11자리, '-' 허용
  const digits = s.replace(/[^0-9]/g, '');
  return digits.length >= 9 && digits.length <= 11;
}

export default function MobileMeetingForm({ slot, onCancel, onSubmit }: Props) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [task, setTask] = useState('');
  const [inquiry, setInquiry] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // 로그인 정보 자동 채움
  useEffect(() => {
    const info = getUserInfo();
    if (info?.visited) {
      setName(prev => prev || info.name || '');
      setRole(prev => prev || info.position || info.role || '');
      setEmail(prev => prev || info.email || '');
    }
  }, []);

  const handleSubmit = async () => {
    setError('');
    if (!name.trim()) return setError('이름을 입력해주세요.');
    if (!role.trim()) return setError('소속/직무를 입력해주세요.');
    if (!task.trim()) return setError('진행 중인 업무를 입력해주세요.');
    if (!inquiry.trim()) return setError('상담 내용을 입력해주세요.');
    if (!isEmail(email)) return setError('올바른 이메일 형식을 입력해주세요.');
    if (!isPhone(phone)) return setError('올바른 연락처(9~11자리 숫자)를 입력해주세요.');

    setBusy(true);
    const res = await onSubmit({
      name: name.trim(),
      role: role.trim(),
      taskSummary: task.trim(),
      inquiry: inquiry.trim(),
      email: email.trim(),
      phone: phone.trim(),
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error || '신청에 실패했습니다.');
    }
  };

  const slotLabel = `${slot.date} · ${slot.startTime} – ${slot.endTime}`;

  return (
    <div
      style={{
        margin: '12px 16px 0',
        padding: 16,
        background: M.surface,
        border: `1.5px solid ${M.primary}`,
        borderRadius: M.r3,
        fontFamily: M.fontKo,
        boxShadow: M.shadowMd,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 12, color: M.textMuted, fontWeight: 700 }}>선택한 슬롯</div>
          <div style={{ fontSize: 14, color: M.primary, fontWeight: 800, marginTop: 2, fontFamily: M.fontEn }}>
            {slotLabel}
          </div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          style={{
            background: 'transparent',
            border: `1px solid ${M.border}`,
            color: M.textMuted,
            fontSize: 12,
            fontWeight: 700,
            padding: '6px 10px',
            borderRadius: M.r1,
            cursor: 'pointer',
            fontFamily: M.fontKo,
          }}
        >
          취소
        </button>
      </div>

      <Field label="이름">
        <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} maxLength={40} />
      </Field>
      <Field label="소속 / 직무">
        <input value={role} onChange={(e) => setRole(e.target.value)} style={inputStyle} placeholder="예) DX센터 / AI 엔지니어" maxLength={80} />
      </Field>
      <Field label="진행 중인 업무">
        <input value={task} onChange={(e) => setTask(e.target.value)} style={inputStyle} placeholder="예) 사내 챗봇 PoC" maxLength={100} />
      </Field>
      <Field label="상담 내용">
        <textarea
          value={inquiry}
          onChange={(e) => setInquiry(e.target.value)}
          style={{ ...inputStyle, minHeight: 90, resize: 'vertical', paddingTop: 12 }}
          placeholder="어떤 도움이 필요하신가요?"
          maxLength={1000}
        />
      </Field>
      <Field label="이메일">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
          autoComplete="email"
          inputMode="email"
        />
      </Field>
      <Field label="연락처">
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          style={inputStyle}
          autoComplete="tel"
          inputMode="tel"
          placeholder="010-1234-5678"
        />
      </Field>

      {error && (
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
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={busy}
        style={{
          width: '100%',
          height: 52,
          borderRadius: M.r3,
          border: 'none',
          background: M.primary,
          color: '#fff',
          fontSize: 16,
          fontWeight: 700,
          cursor: busy ? 'not-allowed' : 'pointer',
          opacity: busy ? 0.6 : 1,
          fontFamily: M.fontKo,
        }}
      >
        {busy ? '신청 중...' : '미팅 신청하기'}
      </button>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 50,
  padding: '0 14px',
  borderRadius: M.r3,
  border: `1.5px solid ${M.border}`,
  background: M.surfaceAlt,
  fontSize: 15,
  color: M.text,
  outline: 'none',
  boxSizing: 'border-box' as const,
  fontFamily: M.fontKo,
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 10 }}>
      <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: M.textMuted, marginBottom: 6 }}>
        {label}
      </span>
      {children}
    </label>
  );
}
