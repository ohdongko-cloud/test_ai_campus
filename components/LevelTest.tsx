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

type Stage = '기초' | '중급' | '고급' | '마무리';

interface Question { id: string; stage: Stage; text: string; }

// 모든 답변은 예(yes) / 아니오(no) / 모름(unknown) 으로 통일.
const QUESTIONS: Question[] = [
  { id: 'C1', stage: '기초', text: 'AI 활용 사례를 접해봤고, PRD(요구사항 문서)가 뭔지 아나요?' },
  { id: 'C2', stage: '기초', text: '클로드 코드·코덱스로 직접 구현을 시켜본 적 있나요? (프로젝트 생성·지침·스킬, 웹·PPT·엑셀 애드온 포함)' },
  { id: 'C3', stage: '중급', text: '웹 서비스 배포 + 데이터베이스 연동을 해본 적 있나요?' },
  { id: 'C4', stage: '중급', text: '로그 확인·봇 공격 차단·이메일 발송(SMTP)·SNS 로그인 중 해본 게 있나요?' },
  { id: 'V1', stage: '중급', text: 'DB 마이그레이션을 할 줄 아나요?' },
  { id: 'V2', stage: '중급', text: '배포 시 환경변수 세팅을 해봤고 할 줄 아나요?' },
  { id: 'C5', stage: '고급', text: '안드로이드/앱스토어 앱 또는 AI API 에이전트를 제작·운영해본 적 있나요?' },
  { id: 'C6', stage: '고급', text: '하나의 업무를 완전 자동화해본 경험이 있나요?' },
  { id: 'V3', stage: '마무리', text: '(상식) .env 파일을 GitHub에 그대로 푸시해도 되나요?' },
];

const SEQ = QUESTIONS.map(q => q.id);
const Q_BY_ID: Record<string, Question> = Object.fromEntries(QUESTIONS.map(q => [q.id, q]));

const OPTIONS = [
  { v: 'yes', label: '예' },
  { v: 'no', label: '아니오' },
  { v: 'unknown', label: '모름' },
];

const STAGE_PROGRESS: Record<Stage, number> = { '기초': 20, '중급': 55, '고급': 80, '마무리': 100 };

const LEVEL_ORDER = ['새싹', '초급', '중급', '고급'];
const LEVEL_DESC: Record<string, { emoji: string; desc: string }> = {
  '새싹': { emoji: '🌱', desc: 'AI를 막 시작한 단계예요. 사례와 기본 개념(PRD·NOA)부터 차근차근 시작해요!' },
  '초급': { emoji: '🚀', desc: 'AI 도구로 직접 만들어보기 시작한 단계! 구현 실습 위주로 추천해요.' },
  '중급': { emoji: '⚙️', desc: '배포·DB까지 다루는 단계. 실전 서비스 제작에 도전해보세요!' },
  '고급': { emoji: '🏆', desc: '앱·에이전트·자동화까지 경험한 단계. 심화 레퍼런스를 추천해요!' },
};

// 적응형 다음 질문 — 어차피 결과를 못 바꾸는 상위 질문은 생략.
function nextId(id: string, answers: Record<string, string>): string | null {
  if (id === 'V3') return null;
  // 초급 게이트: 직접 구현(C2)을 안 해봤으면 → 바로 마무리(보안)
  if (id === 'C2' && answers.C2 !== 'yes') return 'V3';
  // 중급 게이트: 배포+DB(C3)도 로그/봇/SMTP/SNS(C4)도 안 해봤으면 → 마무리로
  if (id === 'C4' && answers.C3 !== 'yes' && answers.C4 !== 'yes') return 'V3';
  const i = SEQ.indexOf(id);
  return SEQ[i + 1] ?? null;
}

function computeResult(a: Record<string, string>): LevelResult {
  let level: string;
  if (a.C6 === 'yes' || a.C5 === 'yes') level = '고급';
  else if (a.C3 === 'yes' || a.C4 === 'yes') level = '중급';
  else if (a.C2 === 'yes') level = '초급';
  else level = '새싹';

  // 검증 보정: 중급·고급인데 V1·V2 둘 다 '예'가 아니면 한 단계 하향
  if ((level === '중급' || level === '고급') && !(a.V1 === 'yes' && a.V2 === 'yes')) {
    level = LEVEL_ORDER[Math.max(0, LEVEL_ORDER.indexOf(level) - 1)];
  }
  const securityFlag = a.V3 === 'yes'; // .env 푸시해도 된다 = 틀림
  return { level, securityFlag };
}

export default function LevelTest({ onComplete, onSkip }: Props) {
  const [path, setPath] = useState<string[]>(['C1']);
  const [pos, setPos] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [picking, setPicking] = useState<string | null>(null);
  const [result, setResult] = useState<LevelResult | null>(null);

  const currentId = path[pos];
  const q = Q_BY_ID[currentId];

  const finish = (a: Record<string, string>) => {
    const r = computeResult(a);
    setResult(r);
    fetch('/api/level-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ level: r.level, answers: a, securityFlag: r.securityFlag }),
    }).catch(() => { /* 기록 실패 무시 */ });
  };

  const pick = (value: string) => {
    if (picking) return;
    setPicking(value);
    const newAnswers = { ...answers, [currentId]: value };
    // 선택을 잠깐 보여준 뒤 자동으로 다음 문제
    setTimeout(() => {
      setAnswers(newAnswers);
      const next = nextId(currentId, newAnswers);
      if (next) {
        setPath([...path.slice(0, pos + 1), next]);
        setPos(pos + 1);
      } else {
        finish(newAnswers);
      }
      setPicking(null);
    }, 220);
  };

  const back = () => { if (pos > 0 && !picking) setPos(pos - 1); };

  const selectedValue = picking ?? answers[currentId];
  const questionNo = pos + 1;

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
          background: T.surface, borderRadius: T.r3, width: '100%', maxWidth: 460,
          boxShadow: '0 16px 48px rgba(15,30,51,0.24)', overflow: 'hidden',
        }}
      >
        {result ? (
          // ── 결과 ──
          <div style={{ padding: '32px 28px', textAlign: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: 8 }}>{LEVEL_DESC[result.level].emoji}</div>
            <div style={{ fontSize: 14, color: T.textMuted, marginBottom: 4 }}>당신의 레벨은</div>
            <div style={{ fontSize: 34, fontWeight: 800, color: T.primary, marginBottom: 14 }}>{result.level}</div>
            <p style={{ fontSize: 14, color: T.textBody, lineHeight: 1.6, margin: 0 }}>
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
          // ── 한 문제씩 ──
          <>
            <div style={{ padding: '22px 28px 0' }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: T.text }}>1분 레벨 테스트 🎯</h2>
              <p style={{ margin: '5px 0 0', fontSize: 12.5, color: T.textMuted }}>
                해당하면 <b>예</b>, 아니면 <b>아니오</b>, 애매하면 <b>모름</b>을 골라주세요.
              </p>
              {/* 진행바 */}
              <div style={{ marginTop: 14, height: 6, background: T.bg, borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: `${STAGE_PROGRESS[q.stage]}%`, height: '100%', background: T.primary, transition: 'width .25s' }} />
              </div>
            </div>

            <div style={{ padding: '20px 28px 8px' }}>
              {/* 단계 칩 + 번호 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, color: T.primary, background: T.primaryLight,
                  padding: '3px 10px', borderRadius: 999,
                }}>{q.stage}</span>
                <span style={{ fontSize: 12, color: T.textFaint, fontWeight: 600 }}>질문 {questionNo}</span>
              </div>

              {/* 질문 (번호 포함) */}
              <div style={{ fontSize: 16, fontWeight: 700, color: T.text, lineHeight: 1.5, marginBottom: 18, minHeight: 72 }}>
                <span style={{ color: T.primary, marginRight: 6 }}>Q{questionNo}.</span>{q.text}
              </div>

              {/* 선택지 — 이모지 없음, 선택 시에만 ✓ */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {OPTIONS.map(o => {
                  const on = selectedValue === o.v;
                  return (
                    <button
                      key={o.v}
                      onClick={() => pick(o.v)}
                      disabled={!!picking}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        width: '100%', padding: '14px 16px', borderRadius: T.r2,
                        border: `1.5px solid ${on ? T.primary : T.border}`,
                        background: on ? T.primaryLight : T.surface,
                        color: on ? T.primary : T.textBody,
                        fontSize: 15, fontWeight: on ? 700 : 500, cursor: picking ? 'default' : 'pointer',
                        fontFamily: T.fontKo, textAlign: 'left', transition: 'all .12s',
                      }}
                    >
                      <span style={{
                        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                        border: `2px solid ${on ? T.primary : '#C7D0DD'}`,
                        background: on ? T.primary : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {on && (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12l5 5L20 7" />
                          </svg>
                        )}
                      </span>
                      {o.label}
                      {o.v === 'unknown' && q.id === 'V3' && (
                        <span style={{ marginLeft: 'auto', fontSize: 11, color: T.textFaint }}>괜찮아요!</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 하단 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 28px 20px' }}>
              <button
                onClick={back}
                disabled={pos === 0 || !!picking}
                style={{
                  border: 'none', background: 'transparent', cursor: pos === 0 ? 'default' : 'pointer',
                  color: pos === 0 ? T.textFaint : T.textMuted, fontSize: 13, fontWeight: 600,
                  fontFamily: T.fontKo, opacity: pos === 0 ? 0.4 : 1,
                }}
              >
                ← 이전
              </button>
              <button
                onClick={onSkip}
                style={{
                  border: 'none', background: 'transparent', cursor: 'pointer',
                  color: T.textFaint, fontSize: 13, fontWeight: 500, fontFamily: T.fontKo,
                }}
              >
                건너뛰기
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
