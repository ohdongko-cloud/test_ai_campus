'use client';

import { useEffect, useRef, useState } from 'react';

// AI 레벨테스트 응시 화면 (한 문제씩, 적응형). PRD: docs/prd/2026-06-15-ai-level-test.md
// 서버(/api/ai-level-test/next)가 다음 문항/결과를 결정. 정답은 클라이언트로 오지 않는다.

interface ClientQuestion {
  id: string; area: string; tier: number; tierLabel: string;
  category: string; body: string; options: string[]; kind: 'knowledge' | 'behavior';
}
interface Progress { index: number; max: number; }
interface Result {
  done: true; c1: number; c2: number; c3: number; autoScore: number; level: number;
  codingStatus: string; served: number;
}
interface Answer { id: string; choice: number; }

const AREA_LABEL: Record<string, string> = {
  security: '보안', ops: '운영도구', automation: '자동화·확산', services: '서비스 이해', ebg: 'EBG 활용', service_count: '서비스 보유',
};
const CAT_OF_AREA: Record<string, '지식' | '행동' | 'EBG'> = {
  security: '지식', ops: '지식', automation: '지식', services: '지식', service_count: '행동', ebg: 'EBG',
};

export default function AiLevelTest({ onComplete, onExit }: { onComplete?: (r: Result) => void; onExit?: () => void }) {
  const attemptId = useRef<string>(typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [question, setQuestion] = useState<ClientQuestion | null>(null);
  const [progress, setProgress] = useState<Progress>({ index: 1, max: 20 });
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState<'quiz' | 'coding' | 'result'>('quiz');
  // 코딩(질) 제출 폼
  const [codeMode, setCodeMode] = useState<'link' | 'file'>('link');
  const [linkUrl, setLinkUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [serviceDesc, setServiceDesc] = useState('');
  const [needsAccount, setNeedsAccount] = useState<'' | 'yes' | 'no'>('');
  const [testAccount, setTestAccount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [codeErr, setCodeErr] = useState('');
  const [growth, setGrowth] = useState<number | null>(null);

  // 결과 단계 진입 시 전월 대비 성장률 조회(영속된 최신 결과 기준)
  useEffect(() => {
    if (phase !== 'result') return;
    fetch('/api/ai-level-test/status', { cache: 'no-store' })
      .then((r) => r.json()).then((d) => { if (d?.growth != null) setGrowth(d.growth); }).catch(() => {});
  }, [phase]);
  // onComplete를 ref로 보관(의존성 제외). 명령형 load만 사용 → answers 의존 효과 없음(루프 불가).
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const reqRef = useRef(0);
  const startedRef = useRef(false);

  async function load(curAnswers: Answer[]) {
    const myReq = ++reqRef.current;
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/ai-level-test/next', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId: attemptId.current, answers: curAnswers }),
      });
      const data = await res.json();
      if (myReq !== reqRef.current) return; // 오래된 응답 무시
      if (!res.ok) { setError(data?.error || '오류가 발생했습니다.'); return; }
      if (data.done) { setResult(data); setPhase('coding'); }  // 퀴즈 종료 → 코딩 제출 단계
      else { setQuestion(data.question); setProgress(data.progress); }
    } catch {
      if (myReq === reqRef.current) setError('네트워크 오류입니다. 다시 시도해주세요.');
    } finally {
      if (myReq === reqRef.current) setLoading(false);
    }
  }

  // 최초 1회만 첫 문항을 불러온다(StrictMode 이중 호출 방지)
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    load([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = (choice: number) => {
    if (!question || loading) return;
    const na = [...answers, { id: question.id, choice }];
    setAnswers(na);
    load(na);
  };

  const retryLoad = () => load(answers);

  const submitCoding = async () => {
    setCodeErr('');
    if (codeMode === 'link' && !linkUrl.trim()) { setCodeErr('서비스 링크를 입력해주세요.'); return; }
    if (codeMode === 'file' && !file) { setCodeErr('파일을 선택해주세요.'); return; }
    if (!serviceDesc.trim()) { setCodeErr('어떤 서비스인지 간단히 설명해주세요.'); return; }
    if (!needsAccount) { setCodeErr('로그인(계정) 필요 여부를 선택해주세요.'); return; }
    setSubmitting(true);
    try {
      const fd = new FormData();
      if (codeMode === 'link') fd.set('linkUrl', linkUrl.trim());
      if (codeMode === 'file' && file) fd.set('file', file);
      fd.set('serviceDesc', serviceDesc.trim());
      fd.set('needsAccount', needsAccount);
      if (needsAccount === 'yes') fd.set('testAccount', testAccount.trim());
      const res = await fetch('/api/ai-level-test/coding', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setCodeErr(data?.error || '제출에 실패했습니다.'); return; }
      setPhase('result');
    } catch {
      setCodeErr('네트워크 오류입니다. 다시 시도해주세요.');
    } finally { setSubmitting(false); }
  };
  const skipCoding = () => setPhase('result');

  // "만든 서비스 없어요" — 코딩 0점 확정 + 총점 재산출(코딩 0 포함)
  const submitNoCoding = async () => {
    setSubmitting(true); setCodeErr('');
    try {
      const fd = new FormData(); fd.set('none', '1');
      const res = await fetch('/api/ai-level-test/coding', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.recomputed) {
        setResult((prev) => prev ? { ...prev, autoScore: data.recomputed.autoScore, level: data.recomputed.level, codingStatus: 'none' } : prev);
      }
    } catch { /* 베스트 에포트 — 실패해도 결과로 */ }
    finally { setSubmitting(false); setPhase('result'); }
  };

  // ── 스타일 ──
  const wrap: React.CSSProperties = { maxWidth: 560, margin: '0 auto', padding: '36px 20px 60px', fontFamily: 'system-ui, sans-serif', color: '#1B2430' };
  const card: React.CSSProperties = { border: '1px solid #E2E6EC', borderRadius: 14, padding: 24, background: '#fff' };
  const optBtn: React.CSSProperties = {
    display: 'block', width: '100%', textAlign: 'left', padding: '14px 16px', marginBottom: 8,
    border: '1px solid #D5DBE3', borderRadius: 10, background: '#fff', fontSize: 14.5, cursor: 'pointer', color: '#21384F', lineHeight: 1.45,
  };
  const tag = (bg: string, fg: string): React.CSSProperties => ({ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6, background: bg, color: fg });

  // ── 코딩(질) 제출 단계 ──
  if (result && phase === 'coding') {
    const input: React.CSSProperties = { width: '100%', padding: '11px 13px', border: '1px solid #D5DBE3', borderRadius: 9, fontSize: 14, marginBottom: 4, boxSizing: 'border-box' };
    const seg = (active: boolean): React.CSSProperties => ({ flex: 1, padding: '9px 0', textAlign: 'center', fontSize: 13, fontWeight: 700, cursor: 'pointer', borderRadius: 8, border: active ? '1.5px solid #1B6CD6' : '1px solid #D5DBE3', background: active ? '#EAF1FB' : '#fff', color: active ? '#11447F' : '#5B6B7E' });
    const label: React.CSSProperties = { fontSize: 13, fontWeight: 700, margin: '14px 0 7px', display: 'block' };
    return (
      <div style={wrap}>
        {onExit && (
          <div style={{ textAlign: 'right', marginBottom: 8 }}>
            <button
              onClick={onExit}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, color: '#8A97A8', padding: '4px 0', fontFamily: 'inherit' }}
            >
              나중에 하기
            </button>
          </div>
        )}
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 6px' }}>코딩 산출물 제출 <span style={{ fontSize: 13, fontWeight: 500, color: '#8A97A8' }}>(선택)</span></h1>
        <p style={{ fontSize: 13, color: '#6B7888', margin: '0 0 16px', lineHeight: 1.6 }}>
          직접 만든 바이브코딩 서비스·자동화(n8n 등)가 있으면 제출해주세요. <b>주 1회 코드리뷰로 채점</b>되어 점수에 반영됩니다. 없으면 건너뛰어도 됩니다.
        </p>
        <div style={card}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            <div style={seg(codeMode === 'link')} onClick={() => setCodeMode('link')}>링크로 제출</div>
            <div style={seg(codeMode === 'file')} onClick={() => setCodeMode('file')}>파일 업로드</div>
          </div>
          {codeMode === 'link' ? (
            <>
              <label style={label}>서비스 링크</label>
              <input style={input} placeholder="https://..." value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
            </>
          ) : (
            <>
              <label style={label}>파일 (zip·html·워크플로우 이미지·pdf, 25MB↓)</label>
              <input style={{ ...input, padding: 8 }} type="file" accept=".zip,.html,.htm,.png,.jpg,.jpeg,.gif,.webp,.pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </>
          )}
          <label style={label}>어떤 서비스인가요?</label>
          <textarea style={{ ...input, minHeight: 64, resize: 'vertical' }} placeholder="예: 매장 재고를 자동 집계해 알림 보내는 n8n 워크플로우"
            value={serviceDesc} onChange={(e) => setServiceDesc(e.target.value)} />
          <label style={label}>로그인(계정)이 있어야 사용할 수 있나요?</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={seg(needsAccount === 'no')} onClick={() => setNeedsAccount('no')}>아니오</div>
            <div style={seg(needsAccount === 'yes')} onClick={() => setNeedsAccount('yes')}>예</div>
          </div>
          {needsAccount === 'yes' && (
            <>
              <label style={label}>테스트 계정 ID <span style={{ fontWeight: 500, color: '#8A97A8' }}>(없으면 비워두세요)</span></label>
              <input style={input} placeholder="예: test@id / pw 또는 안내" value={testAccount} onChange={(e) => setTestAccount(e.target.value)} />
            </>
          )}
          {codeErr && <p style={{ color: '#A3331F', fontSize: 13, marginTop: 10 }}>{codeErr}</p>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
          <button onClick={submitCoding} disabled={submitting} style={{ ...optBtn, textAlign: 'center', marginBottom: 0, fontWeight: 700, color: '#fff', background: submitting ? '#9AB6E0' : '#1B6CD6', borderColor: '#1B6CD6' }}>
            {submitting ? '제출 중…' : '제출하고 결과 보기'}
          </button>
          {/* 만든 서비스가 없는 사용자용 — 제출 버튼 바로 아래에 잘 보이게(코딩 0점 확정) */}
          <button onClick={submitNoCoding} disabled={submitting} style={{ ...optBtn, textAlign: 'center', marginBottom: 0, fontWeight: 700, color: '#1B6CD6', background: '#EAF1FB', borderColor: '#1B6CD6' }}>
            만든 서비스 없어요
          </button>
          <button onClick={skipCoding} disabled={submitting} style={{ ...optBtn, textAlign: 'center', marginBottom: 0, color: '#8A97A8', background: 'transparent', border: 'none', fontSize: 13 }}>
            나중에 할게요 (건너뛰기)
          </button>
        </div>
      </div>
    );
  }

  // ── 결과 ──
  if (result && phase === 'result') {
    const bars: [string, number, string][] = [['지식', result.c1, '#1B6CD6'], ['행동(보유)', result.c2, '#7C5CD6'], ['EBG 활용', result.c3, '#1D9E75']];
    return (
      <div style={wrap}>
        <h1 style={{ fontSize: 21, fontWeight: 800, margin: '0 0 18px' }}>AI 레벨 진단 결과</h1>
        <div style={{ ...card, background: '#0F2A4A', color: '#fff', border: 'none', marginBottom: 14 }}>
          <div style={{ fontSize: 12, opacity: .7 }}>내 레벨</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontSize: 40, fontWeight: 800, color: '#7FE0B0' }}>Lv {result.level}</span>
            <span style={{ fontSize: 22, fontWeight: 700 }}>{result.autoScore.toFixed(1)}점</span>
            <span style={{ fontSize: 12, opacity: .6 }}>/ 100</span>
            {growth != null && (
              <span style={{ fontSize: 13, fontWeight: 700, color: growth >= 0 ? '#7FE0B0' : '#FF8A80' }}>
                전월 대비 {growth >= 0 ? '+' : ''}{growth}점
              </span>
            )}
          </div>
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {bars.map(([label, v, color]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 72, fontSize: 12, opacity: .8, flexShrink: 0 }}>{label}</span>
                <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,.12)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${v}%`, height: '100%', background: color, borderRadius: 4 }} />
                </div>
                <span style={{ width: 34, textAlign: 'right', fontSize: 12, fontWeight: 700 }}>{Math.round(v)}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ ...card, marginBottom: 14, fontSize: 13.5, color: '#33414F', lineHeight: 1.6 }}>
          <span style={tag('#FFF1E5', '#A05A1F')}>안내</span>
          <div style={{ marginTop: 8 }}>
            {result.codingStatus === 'none'
              ? <>만든 서비스가 없어 코딩 점수는 <b>0점</b>으로 반영되었습니다. 서비스를 만든 뒤 마이페이지에서 다시 측정하면 점수가 올라가요.</>
              : <>코딩 점수(직접 만든 서비스의 코드 품질)는 <b>주 1회 채점</b>에 반영됩니다. 현재 점수는 코딩을 제외한 <b>잠정 점수</b>입니다.</>}
          </div>
        </div>
        {onComplete && (
          <button onClick={() => onComplete(result)} style={{ ...optBtn, textAlign: 'center', fontWeight: 700, color: '#fff', background: '#1B6CD6', borderColor: '#1B6CD6' }}>
            시작하기
          </button>
        )}
      </div>
    );
  }

  // ── 로딩/에러 ──
  if (error) {
    return (
      <div style={wrap}>
        <div style={{ ...card, textAlign: 'center' }}>
          <p style={{ color: '#A3331F', fontSize: 14 }}>{error}</p>
          <button onClick={retryLoad} style={{ ...optBtn, textAlign: 'center', fontWeight: 700, color: '#1B6CD6', borderColor: '#1B6CD6', marginTop: 12 }}>다시 시도</button>
        </div>
      </div>
    );
  }
  if (!question) {
    return <div style={wrap}><div style={{ ...card, textAlign: 'center', color: '#73839A' }}>불러오는 중…</div></div>;
  }

  // ── 문항 ──
  const cat = CAT_OF_AREA[question.area] || '지식';
  const catColor = cat === '지식' ? tag('#E1EDFB', '#11447F') : cat === 'EBG' ? tag('#E8F6EE', '#1F7A4D') : tag('#F0EAFB', '#5B3FA0');
  return (
    <div style={wrap}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, fontSize: 12, color: '#8A97A8' }}>
        <span>AI 레벨 진단</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {onExit && (
            <button
              onClick={onExit}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#9AA6B5', padding: 0, fontFamily: 'inherit' }}
            >
              나중에 하기
            </button>
          )}
          <span>{progress.index} / 최대 {progress.max}문항</span>
        </div>
      </div>
      <div style={{ height: 6, background: '#EEF1F5', borderRadius: 3, marginBottom: 22, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, (progress.index / progress.max) * 100)}%`, height: '100%', background: '#1B6CD6', borderRadius: 3, transition: 'width .25s' }} />
      </div>
      <div style={card}>
        <div style={{ marginBottom: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={catColor}>{cat}</span>
          <span style={tag('#F1F3F6', '#5B6B7E')}>{AREA_LABEL[question.area] || question.area}</span>
          <span style={tag('#F1F3F6', '#5B6B7E')}>{question.tierLabel}</span>
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.5, marginBottom: 16 }}>{question.body}</div>
        {question.options.map((o, i) => (
          <button key={i} disabled={loading} style={{ ...optBtn, opacity: loading ? 0.6 : 1 }}
            onMouseEnter={e => { if (!loading) { (e.currentTarget).style.borderColor = '#1B6CD6'; (e.currentTarget).style.background = '#F4F8FD'; } }}
            onMouseLeave={e => { (e.currentTarget).style.borderColor = '#D5DBE3'; (e.currentTarget).style.background = '#fff'; }}
            onClick={() => pick(i)}>
            {o}
          </button>
        ))}
      </div>
      <p style={{ fontSize: 12, color: '#9AA6B5', marginTop: 14, textAlign: 'center' }}>
        사용 수준에 따라 일부 문항은 자동으로 건너뜁니다
      </p>
    </div>
  );
}
