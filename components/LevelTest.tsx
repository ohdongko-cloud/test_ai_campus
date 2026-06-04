"use client";

import { useState } from 'react';

const T = {
  primary: '#004A99', primaryLight: '#E6EEF7',
  text: '#0F1E33', textBody: '#3B4A63', textMuted: '#6B7A91', textFaint: '#9BA7BC',
  border: '#E5EAF1', surface: '#FFFFFF', bg: '#F5F7FA',
  secondary: '#FF914D', success: '#1E9E6A', successBg: '#E6F6EE',
  danger: '#D8364C', dangerBg: '#FCE6EA',
  r: 8, r2: 12, r3: 16,
  fontKo: '"Noto Sans KR", "Inter", system-ui, sans-serif',
};

export type LevelResult = { level: string; securityFlag: boolean };

interface Props {
  onComplete: (result: LevelResult) => void;
  onSkip: () => void;
}

// 역량 문항 (해봤음/알고있음/모름)
const CAP = [
  { id: 'C1', text: 'AI 활용 사례를 접했고, PRD(요구사항 문서)가 뭔지 안다' },
  { id: 'C2', text: '클로드 코드·코덱스로 직접 구현을 시켜봤다 (프로젝트 생성/지침/스킬 + 웹·PPT·엑셀 애드온)' },
  { id: 'C3', text: '웹 서비스 배포 + 데이터베이스 연동을 해봤다' },
  { id: 'C4', text: '로그 확인·봇 공격 차단·이메일 발송(SMTP)·SNS 로그인 중 해본 게 있다' },
  { id: 'C5', text: '안드로이드/앱스토어 앱 또는 AI API 에이전트를 제작·운영해봤다' },
  { id: 'C6', text: '하나의 업무를 완전 자동화해본 경험이 있다' },
] as const;

const CAP_OPTS = [
  { v: 'done', label: '✅ 해봤음' },
  { v: 'know', label: '📖 알고만 있음' },
  { v: 'none', label: '❌ 모름' },
];

// 검증 문항 (예/아니오/잘 모름)
const VER = [
  { id: 'V1', text: 'DB 마이그레이션을 할 줄 안다' },
  { id: 'V2', text: '배포 시 환경변수 세팅을 해봤고 할 줄 안다' },
  { id: 'V3', text: '(상식) .env 파일을 GitHub에 그대로 푸시해도 된다?' },
] as const;

const VER_OPTS = [
  { v: 'yes', label: '예' },
  { v: 'no', label: '아니오' },
  { v: 'unknown', label: '잘 모름' },
];

const LEVEL_ORDER = ['새싹', '초급', '중급', '고급'];

const LEVEL_DESC: Record<string, { emoji: string; desc: string }> = {
  '새싹': { emoji: '🌱', desc: 'AI를 막 시작한 단계예요. 사례와 기본 개념(PRD·NOA)부터 차근차근 시작해요!' },
  '초급': { emoji: '🚀', desc: 'AI 도구로 직접 만들어보기 시작한 단계! 구현 실습 위주로 추천해요.' },
  '중급': { emoji: '⚙️', desc: '배포·DB까지 다루는 단계. 실전 서비스 제작에 도전해보세요!' },
  '고급': { emoji: '🏆', desc: '앱·에이전트·자동화까지 경험한 단계. 심화 레퍼런스를 추천해요!' },
};

function computeResult(
  cap: Record<string, string>,
  ver: Record<string, string>,
): LevelResult {
  let level: string;
  if (cap.C6 === 'done' || cap.C5 === 'done') level = '고급';
  else if (cap.C3 === 'done' || cap.C4 === 'done') level = '중급';
  else if (cap.C2 === 'done') level = '초급';
  else level = '새싹';

  // 검증 보정: 중급·고급인데 V1·V2 둘 다 '예'가 아니면 한 단계 하향
  if ((level === '중급' || level === '고급') && !(ver.V1 === 'yes' && ver.V2 === 'yes')) {
    level = LEVEL_ORDER[Math.max(0, LEVEL_ORDER.indexOf(level) - 1)];
  }
  // 보안 플래그: V3에 '예'(틀림) → 보안 인지 부족
  const securityFlag = ver.V3 === 'yes';
  return { level, securityFlag };
}

export default function LevelTest({ onComplete, onSkip }: Props) {
  const [cap, setCap] = useState<Record<string, string>>({});
  const [ver, setVer] = useState<Record<string, string>>({});
  const [result, setResult] = useState<LevelResult | null>(null);

  const total = CAP.length + VER.length;
  const answered = Object.keys(cap).length + Object.keys(ver).length;
  const allDone = answered === total;

  const submit = () => {
    const r = computeResult(cap, ver);
    setResult(r);
    // 검증내역 기록 (fire-and-forget)
    fetch('/api/level-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ level: r.level, answers: { ...cap, ...ver }, securityFlag: r.securityFlag }),
    }).catch(() => { /* 기록 실패는 무시 */ });
  };

  const OptionRow = ({
    qid, text, opts, value, onPick,
  }: {
    qid: string; text: string; opts: { v: string; label: string }[];
    value: string | undefined; onPick: (v: string) => void;
  }) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: T.text, marginBottom: 8, lineHeight: 1.5 }}>{text}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {opts.map(o => {
          const on = value === o.v;
          return (
            <button
              key={o.v}
              onClick={() => onPick(o.v)}
              style={{
                flex: '1 1 0', minWidth: 88, padding: '8px 10px', borderRadius: T.r,
                border: `1.5px solid ${on ? T.primary : T.border}`,
                background: on ? T.primaryLight : T.surface,
                color: on ? T.primary : T.textBody,
                fontSize: 12.5, fontWeight: on ? 700 : 500, cursor: 'pointer', fontFamily: T.fontKo,
                whiteSpace: 'nowrap',
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {qid === 'V3' && value === 'yes' && (
        <div style={{ fontSize: 11.5, color: T.danger, marginTop: 5 }}>
          ⚠️ .env에는 비밀번호·토큰이 들어있어 GitHub에 올리면 안 돼요. 보안 공통 영상을 꼭 확인하세요!
        </div>
      )}
    </div>
  );

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        background: 'rgba(15,30,51,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        fontFamily: T.fontKo,
      }}
    >
      <div
        style={{
          background: T.surface, borderRadius: T.r3, width: '100%', maxWidth: 480,
          maxHeight: 'calc(100vh - 32px)', overflowY: 'auto',
          boxShadow: '0 16px 48px rgba(15,30,51,0.24)',
        }}
      >
        {result ? (
          // ── 결과 화면 ──
          <div style={{ padding: '32px 28px', textAlign: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: 8 }}>{LEVEL_DESC[result.level].emoji}</div>
            <div style={{ fontSize: 14, color: T.textMuted, marginBottom: 4 }}>당신의 레벨은</div>
            <div style={{ fontSize: 34, fontWeight: 800, color: T.primary, marginBottom: 14 }}>
              {result.level}
            </div>
            <p style={{ fontSize: 14, color: T.textBody, lineHeight: 1.6, margin: '0 0 8px' }}>
              {LEVEL_DESC[result.level].desc}
            </p>
            {result.securityFlag && (
              <div style={{
                background: T.dangerBg, border: '1px solid #FBCBD2', borderRadius: T.r,
                padding: '10px 12px', fontSize: 12.5, color: T.danger, lineHeight: 1.5, margin: '12px 0 0',
              }}>
                🔐 보안 기본기가 조금 부족해요. <b>보안 관련 공통 영상</b>을 먼저 시청하시길 권장합니다.
              </div>
            )}
            <button
              onClick={() => onComplete(result)}
              style={{
                width: '100%', height: 48, marginTop: 22, border: 'none', borderRadius: T.r,
                background: T.primary, color: '#fff', fontSize: 15, fontWeight: 700,
                cursor: 'pointer', fontFamily: T.fontKo,
              }}
            >
              내 레벨 맞춤 추천 영상 보기 →
            </button>
          </div>
        ) : (
          // ── 문항 화면 ──
          <>
            <div style={{ padding: '24px 28px 0' }}>
              <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: T.text }}>
                1분 레벨 테스트 🎯
              </h2>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: T.textMuted, lineHeight: 1.5 }}>
                간단히 답하면 <b>나에게 맞는 강의</b>를 추천해드려요. 솔직하게 골라주세요!
              </p>
              {/* 진행도 */}
              <div style={{ marginTop: 14, height: 6, background: T.bg, borderRadius: 999, overflow: 'hidden' }}>
                <div style={{
                  width: `${(answered / total) * 100}%`, height: '100%',
                  background: T.primary, transition: 'width .2s',
                }} />
              </div>
              <div style={{ fontSize: 11, color: T.textFaint, marginTop: 4, textAlign: 'right' }}>
                {answered} / {total}
              </div>
            </div>

            <div style={{ padding: '16px 28px 8px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, letterSpacing: '0.04em', marginBottom: 10 }}>
                💡 알고 있거나 직접 해본 적 있나요?
              </div>
              {CAP.map(q => (
                <OptionRow key={q.id} qid={q.id} text={q.text} opts={CAP_OPTS}
                  value={cap[q.id]} onPick={v => setCap(s => ({ ...s, [q.id]: v }))} />
              ))}

              <div style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, letterSpacing: '0.04em', margin: '8px 0 10px', paddingTop: 8, borderTop: `1px solid ${T.border}` }}>
                ✔️ 추가 확인
              </div>
              {VER.map(q => (
                <OptionRow key={q.id} qid={q.id} text={q.text} opts={VER_OPTS}
                  value={ver[q.id]} onPick={v => setVer(s => ({ ...s, [q.id]: v }))} />
              ))}
            </div>

            <div style={{
              position: 'sticky', bottom: 0, background: T.surface,
              borderTop: `1px solid ${T.border}`, padding: '14px 28px', display: 'flex', gap: 10,
            }}>
              <button
                onClick={onSkip}
                style={{
                  flex: '0 0 90px', height: 46, borderRadius: T.r,
                  border: `1px solid ${T.border}`, background: 'transparent',
                  color: T.textMuted, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: T.fontKo,
                }}
              >
                건너뛰기
              </button>
              <button
                onClick={submit}
                disabled={!allDone}
                style={{
                  flex: 1, height: 46, borderRadius: T.r, border: 'none',
                  background: allDone ? T.primary : '#AFC0D6', color: '#fff',
                  fontSize: 15, fontWeight: 700, cursor: allDone ? 'pointer' : 'not-allowed', fontFamily: T.fontKo,
                }}
              >
                {allDone ? '결과 보기' : `${total - answered}개 남음`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
