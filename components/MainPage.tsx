"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import { TabType } from '../lib/types';
import { addClickLog, getWeekDates } from '../lib/utils';
import ChatroomPopup from './ChatroomPopup';

interface Props {
  onNavigate: (tab: TabType) => void;
}

/* ── Inline SVG icons (24×24, stroke 1.8, rounded) ──────────── */
const LearnIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
    <path d="M3 6.5L12 3l9 3.5L12 10 3 6.5z" />
    <path d="M3 6.5V13l9 3.5L21 13V6.5" />
    <path d="M7 14.5V19c1.5 1 3.5 2 5 2s3.5-1 5-2v-4.5" />
  </svg>
);
const NoaIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
    <rect x="3" y="4" width="18" height="16" rx="1" />
    <path d="M3 9h18M8 4v16" />
    <circle cx="13.5" cy="6.5" r="0.6" fill="currentColor" />
    <circle cx="15.5" cy="6.5" r="0.6" fill="currentColor" />
    <path d="M11 13h6M11 16h4" />
  </svg>
);
const GuideIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
    <path d="M4 4h7v16H4zM13 4h7v16h-7z" />
    <path d="M7 8h1M7 11h1M7 14h1M16 8h1M16 11h1M16 14h1" />
  </svg>
);
const MentorIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 19c.8-3 3.2-5 6-5s5.2 2 6 5" />
    <circle cx="17" cy="9" r="2.4" />
    <path d="M15 19c.5-2 1.8-3.5 3.5-3.8" />
  </svg>
);
const CommunityIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
    <path d="M21 12a8 8 0 1 1-3-6.2L21 5l-1 3.5A8 8 0 0 1 21 12z" />
    <circle cx="9" cy="12" r=".8" fill="currentColor" />
    <circle cx="13" cy="12" r=".8" fill="currentColor" />
    <circle cx="17" cy="12" r=".8" fill="currentColor" />
  </svg>
);
const BoardIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
    <path d="M4 5h16v11H8l-4 4z" />
    <circle cx="10" cy="10.5" r=".8" fill="currentColor" />
    <circle cx="14" cy="10.5" r=".8" fill="currentColor" />
    <circle cx="18" cy="10.5" r=".8" fill="currentColor" />
  </svg>
);
const ShareIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 26, height: 26 }}>
    <circle cx="18" cy="5" r="2.4" />
    <circle cx="6" cy="12" r="2.4" />
    <circle cx="18" cy="19" r="2.4" />
    <path d="M8.2 11l7.6-4.4M8.2 13l7.6 4.4" />
  </svg>
);
const ArrowIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
    <path d="M7 17L17 7M9 7h8v8" />
  </svg>
);

/* ── Badge ───────────────────────────────────────────────────── */
function Badge({ variant, children }: {
  variant: 'primary' | 'secondary' | 'new' | 'featured';
  children: React.ReactNode;
}) {
  const styles: Record<string, React.CSSProperties> = {
    primary:  { background: 'var(--color-primary-50)',   color: 'var(--color-primary)' },
    secondary:{ background: 'var(--color-secondary-50)', color: 'var(--color-secondary-700)' },
    new:      { background: 'var(--color-success-bg)',   color: 'var(--color-success-ink)' },
    featured: { background: 'rgba(255,145,77,0.22)',      color: '#FFD1B0' },
  };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontFamily: 'var(--font-eng)', fontSize: 10, fontWeight: 600,
      letterSpacing: '0.06em', textTransform: 'uppercase' as const,
      padding: '3px 8px', borderRadius: 4,
      ...styles[variant],
    }}>
      {children}
    </span>
  );
}

/* ── Live dot ────────────────────────────────────────────────── */
function LiveDot() {
  return (
    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22A66B', display: 'inline-block', flexShrink: 0 }} />
  );
}

/* ── Standard action card ────────────────────────────────────── */
function ActionCard({ icon, title, desc, meta, metaRight, onClick }: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  meta: React.ReactNode;
  metaRight?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <div
      className="ac-card"
      onClick={onClick}
      style={{
        position: 'relative',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-line)',
        borderRadius: 'var(--radius)',
        padding: '22px 22px 24px',
        display: 'flex', flexDirection: 'column', gap: 14,
        minHeight: 188,
        overflow: 'hidden',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div className="ac-icon" style={{
        width: 44, height: 44, borderRadius: 10, flexShrink: 0,
        background: 'var(--color-primary-50)', color: 'var(--color-primary)',
        display: 'grid', placeItems: 'center',
      }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.015em', margin: '0 0 6px', color: 'var(--color-ink)' }}>
          {title}
        </h3>
        <p style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--color-ink-3)', margin: 0 }}>
          {desc}
        </p>
      </div>
      <div style={{
        marginTop: 'auto', paddingTop: 12,
        borderTop: '1px dashed var(--color-line)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontFamily: 'var(--font-eng)', fontSize: 11, fontWeight: 500,
        color: 'var(--color-ink-3)', letterSpacing: '0.04em', textTransform: 'uppercase' as const,
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{meta}</span>
        {metaRight && <span>{metaRight}</span>}
      </div>
      <span className="ac-arrow" style={{
        position: 'absolute', top: 22, right: 22,
        width: 18, height: 18, opacity: 0.5,
        color: 'var(--color-ink-3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <ArrowIcon />
      </span>
    </div>
  );
}

/* ── Featured card (배우기, spans 2 cols, dark navy bg) ─────── */
function FeaturedCard({ icon, title, desc, meta, metaRight, onClick }: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  meta: React.ReactNode;
  metaRight?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <div
      className="ac-card featured"
      onClick={onClick}
      style={{
        position: 'relative',
        gridColumn: 'span 2',
        background: 'linear-gradient(135deg, #003A78 0%, #004A99 60%, #1B6CD6 100%)',
        border: '1px solid transparent',
        borderRadius: 'var(--radius)',
        padding: '22px 22px 24px',
        display: 'flex', flexDirection: 'column', gap: 14,
        minHeight: 188,
        overflow: 'hidden',
        boxShadow: 'var(--shadow-card)',
        color: '#fff',
      }}
    >
      {/* Decorative radial blob */}
      <div style={{
        position: 'absolute', inset: 'auto -40px -60px auto',
        width: 220, height: 220, borderRadius: '50%',
        background: 'radial-gradient(circle at 30% 30%, rgba(255,145,77,0.5), transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div className="ac-icon" style={{
        width: 44, height: 44, borderRadius: 10, flexShrink: 0,
        background: 'rgba(255,255,255,0.15)', color: '#fff',
        display: 'grid', placeItems: 'center',
      }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.015em', margin: '0 0 6px', color: '#fff' }}>
          {title}
        </h3>
        <p style={{ fontSize: 13.5, lineHeight: 1.55, color: 'rgba(255,255,255,0.78)', margin: 0 }}>
          {desc}
        </p>
      </div>
      <div style={{
        marginTop: 'auto', paddingTop: 12,
        borderTop: '1px dashed rgba(255,255,255,0.18)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontFamily: 'var(--font-eng)', fontSize: 11, fontWeight: 500,
        color: 'rgba(255,255,255,0.55)', letterSpacing: '0.04em', textTransform: 'uppercase' as const,
      }}>
        <span>{meta}</span>
        {metaRight && <span>{metaRight}</span>}
      </div>
      <span className="ac-arrow" style={{
        position: 'absolute', top: 22, right: 22,
        width: 18, height: 18, opacity: 1,
        color: 'rgba(255,255,255,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <ArrowIcon />
      </span>
    </div>
  );
}

/* ── Wide card (자랑하기, row layout) ────────────────────────── */
function WideCard({ icon, title, desc, metaLeft, metaRight, onClick }: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  metaLeft: React.ReactNode;
  metaRight?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <div
      className="ac-card"
      onClick={onClick}
      style={{
        position: 'relative',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-line)',
        borderRadius: 'var(--radius)',
        padding: '28px',
        display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 24,
        overflow: 'hidden',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div className="ac-icon" style={{
        width: 56, height: 56, borderRadius: 12, flexShrink: 0,
        background: 'var(--color-primary-50)', color: 'var(--color-primary)',
        display: 'grid', placeItems: 'center',
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.015em', margin: '0 0 6px', color: 'var(--color-ink)' }}>
          {title}
        </h3>
        <p style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--color-ink-3)', margin: 0 }}>
          {desc}
        </p>
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0,
        fontFamily: 'var(--font-eng)', fontSize: 12, color: 'var(--color-ink-3)',
      }}>
        {metaLeft}
        {metaRight && <span>{metaRight}</span>}
      </div>
      <span className="ac-arrow" style={{
        position: 'absolute', top: 28, right: 28,
        width: 18, height: 18, opacity: 0.5,
        color: 'var(--color-ink-3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <ArrowIcon />
      </span>
    </div>
  );
}

/* ── Section label (sticky left rail) ───────────────────────── */
function SectionLabel({ num, title, en, desc }: {
  num: string; title: string; en: string; desc: string;
}) {
  return (
    <aside className="ac-section-label">
      <div style={{
        fontFamily: 'var(--font-eng)', fontWeight: 700,
        fontSize: 13, color: 'var(--color-ink-3)', letterSpacing: '0.04em',
        marginBottom: 12, display: 'flex', alignItems: 'center',
      }}>
        <span style={{
          display: 'inline-block', width: 28, height: 2,
          background: 'var(--color-primary)', borderRadius: 2,
          marginRight: 10, flexShrink: 0,
        }} />
        {num}
      </div>
      <h2 style={{
        fontSize: 36, fontWeight: 800, letterSpacing: '-0.03em',
        margin: '0 0 8px', lineHeight: 1, color: 'var(--color-ink)',
      }}>
        {title}
      </h2>
      <div style={{
        fontFamily: 'var(--font-eng)', fontWeight: 500,
        fontSize: 14, color: 'var(--color-ink-3)',
        letterSpacing: '0.02em', marginBottom: 16,
      }}>
        {en}
      </div>
      <p style={{ fontSize: 14, color: 'var(--color-ink-2)', lineHeight: 1.55, maxWidth: 240, margin: 0 }}>
        {desc}
      </p>
    </aside>
  );
}

/* ── Toast ───────────────────────────────────────────────────── */
function ToastEl({ msg, visible }: { msg: string; visible: boolean }) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', zIndex: 80,
      transform: visible ? 'translate(-50%, 0)' : 'translate(-50%, 20px)',
      opacity: visible ? 1 : 0,
      pointerEvents: 'none',
      transition: 'transform 240ms cubic-bezier(.2,.8,.2,1), opacity 240ms ease',
      background: 'var(--color-ink)', color: '#fff',
      padding: '12px 18px', borderRadius: 10,
      fontSize: 13, fontWeight: 500,
      boxShadow: 'var(--shadow-toast)',
      display: 'flex', alignItems: 'center', gap: 10,
      whiteSpace: 'nowrap',
    }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        style={{ width: 16, height: 16, color: 'var(--color-secondary)', flexShrink: 0 }}>
        <path d="M5 12l4 4 10-10" />
      </svg>
      {msg}
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────── */
export default function MainPage({ onNavigate }: Props) {
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showChatroomPopup, setShowChatroomPopup] = useState(false);

  // ── 실시간 통계 ──
  const [availableSlots, setAvailableSlots] = useState<number | null>(null);
  const [boardStats, setBoardStats] = useState<{ postsThisWeek: number; postsNew: number } | null>(null);
  const [shareCount, setShareCount] = useState<number | null>(null);

  useEffect(() => {
    // 1. 이번 주 예약 가능 슬롯 (DB)
    const weekDates = getWeekDates();
    const weekStart = weekDates[0].toISOString().slice(0, 10);
    const weekEnd   = weekDates[4].toISOString().slice(0, 10);
    fetch('/api/reservations')
      .then(r => r.ok ? r.json() : [])
      .then((rows: { date: string; status: string }[]) => {
        const reserved = rows.filter(r => r.date >= weekStart && r.date <= weekEnd && r.status !== 'cancelled');
        const TOTAL = 18 * 5;
        setAvailableSlots(Math.max(0, TOTAL - reserved.length));
      })
      .catch(() => {});

    // 2. 공유 서비스 수 (DB)
    fetch('/api/services')
      .then(r => r.ok ? r.json() : [])
      .then((rows: unknown[]) => setShareCount(rows.length))
      .catch(() => {});

    // 3. 게시판 통계 (DB API)
    fetch('/api/stats')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setBoardStats(d); })
      .catch(() => {});
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), 1800);
  }, []);

  const handleNav = (tab: TabType, title: string) => {
    addClickLog(title);
    showToast(`${title} 페이지로 이동`);
    // slight delay so toast is visible before paint
    setTimeout(() => onNavigate(tab), 120);
  };

  const handleNoa = async () => {
    addClickLog('NOA');
    showToast('NOA를 새 탭에서 여는 중…');
    // NOA URL을 DB에서 매번 조회 (캐시 없음, 횟수 적음)
    try {
      const res = await fetch('/api/settings?keys=noa_url');
      if (res.ok) {
        const s = await res.json();
        const url = typeof s.noa_url === 'string' && s.noa_url ? s.noa_url : 'https://noa.eland.com';
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
      }
    } catch { /* ignore */ }
    window.open('https://noa.eland.com', '_blank', 'noopener,noreferrer');
  };

  const handleCommunity = () => {
    addClickLog('오픈채팅방');
    setShowChatroomPopup(true);
  };

  return (
    <div style={{ background: 'var(--color-bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="ac-container">

        {/* ── Hero ── */}
        <section className="ac-hero" style={{ padding: '56px 0 24px' }}>
          {/* H1 */}
          <h1 className="ac-hero-h1" style={{
            fontSize: 'clamp(36px, 4.5vw, 56px)',
            lineHeight: 1.15, letterSpacing: '-0.025em',
            fontWeight: 700, margin: '0 0 14px', maxWidth: 900,
            color: 'var(--color-ink)',
          }}>
            시간 아깝게 하는 업무?<br />
            <span style={{ color: 'var(--color-primary)' }}>이제 AI로 자동화</span> 할 수 있습니다.
          </h1>

          {/* Lead */}
          <p style={{ fontSize: 17, lineHeight: 1.55, color: 'var(--color-ink-2)', margin: 0, maxWidth: 640 }}>
            반복 업무, 보고서, 예약 관리, 데이터 정리까지.<br />
            나만의 업무 자동화 서비스를 직접 만들 수 있도록 도와드립니다.
          </p>

          {/* Step row */}
          <div style={{
            marginTop: 28, display: 'flex', alignItems: 'center',
            gap: 8, flexWrap: 'wrap' as const,
            color: 'var(--color-ink-3)', fontSize: 13,
          }}>
            {(['배우기', '만들기', '물어보기', '자랑하기'] as const).flatMap((step, i) => {
              const nodes: React.ReactNode[] = [];
              if (i > 0) nodes.push(
                <span key={`arr-${i}`} style={{ color: 'var(--color-line-2)', margin: '0 4px' }}>→</span>
              );
              nodes.push(
                <span key={step} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    width: 22, height: 22, borderRadius: '50%',
                    border: '1px solid var(--color-line-2)',
                    background: 'var(--color-surface)',
                    display: 'grid', placeItems: 'center',
                    fontFamily: 'var(--font-eng)', fontSize: 11, fontWeight: 600,
                    color: 'var(--color-ink-2)', flexShrink: 0,
                  }}>{i + 1}</span>
                  {step}
                </span>
              );
              return nodes;
            })}
          </div>
        </section>

        {/* ── Sections ── */}
        <main style={{ padding: '24px 0 96px' }}>

          {/* 01 배우기 */}
          <section id="learn" className="ac-section ac-section-first">
            <SectionLabel
              num="01 / 04" title="배우기"
              en="Learn the fundamentals"
              desc="기초부터 심화까지, 수준별 강의로 나만의 페이스로 학습하세요."
            />
            <div className="ac-grid-2">
              <FeaturedCard
                icon={<LearnIcon />}
                title="AI 학습 시작하기"
                desc="따라하기만 하면 기초부터 심화까지 직접 구현할 수 있습니다."
                meta="42 lessons · 3 levels"
                metaRight={<Badge variant="featured">추천 코스</Badge>}
                onClick={() => handleNav('videos', 'AI 학습 시작하기')}
              />
            </div>
          </section>

          {/* 02 만들기 */}
          <section id="make" className="ac-section">
            <SectionLabel
              num="02 / 04" title="만들기"
              en="Build with the tools"
              desc="실제 도구를 직접 다뤄보며 만들기를 시작하세요. 사내 시스템과 필수 도구를 모두 모았습니다."
            />
            <div className="ac-grid-2">
              <ActionCard
                icon={<NoaIcon />}
                title="NOA로 바로 만들기"
                desc="사내 AI 시스템 NOA를 바로 시작해보세요. 실제 업무에 즉시 적용할 수 있습니다."
                meta={<><LiveDot />운영중</>}
                metaRight="새 탭 ↗"
                onClick={handleNoa}
              />
              <ActionCard
                icon={<GuideIcon />}
                title="필수 도구 둘러보기"
                desc="프로젝트에 필요한 핵심 서비스와 도구를 한 페이지에 정리했습니다."
                meta="7 categories · 24 services"
                metaRight={<Badge variant="new">업데이트</Badge>}
                onClick={() => handleNav('guide', '필수 도구 둘러보기')}
              />
            </div>
          </section>

          {/* 03 물어보기 */}
          <section id="ask" className="ac-section">
            <SectionLabel
              num="03 / 04" title="물어보기"
              en="Ask the experts & peers"
              desc="막힌 부분은 함께 풉니다. 전문가와의 미팅, 동료 커뮤니티, 익명 게시판까지."
            />
            <div className="ac-grid-3">
              <ActionCard
                icon={<MentorIcon />}
                title="멘토링 예약"
                desc="AX팀과 1:1 미팅을 예약하세요. 30분 슬롯, 매주 화·목."
                meta="5 mentors"
                metaRight={
                  availableSlots === null
                    ? <Badge variant="primary">슬롯 확인 중</Badge>
                    : availableSlots > 0
                    ? <Badge variant="primary">슬롯 {availableSlots}개</Badge>
                    : <Badge variant="secondary">이번주 마감</Badge>
                }
                onClick={() => handleNav('meeting', '멘토링 예약')}
              />
              <ActionCard
                icon={<CommunityIcon />}
                title="AI 커뮤니티 참여"
                desc="동료들과 질문과 팁을 실시간으로 나누세요. 채널별 오픈채팅 운영중."
                meta={<><LiveDot />342 online</>}
                metaRight="12 channels"
                onClick={handleCommunity}
              />
              <ActionCard
                icon={<BoardIcon />}
                title="익명 Q&A 게시판"
                desc="익명으로 질문과 고민을 자유롭게 공유하세요. 부담 없이, 솔직하게."
                meta={boardStats !== null ? `${boardStats.postsThisWeek} posts this week` : '— posts this week'}
                metaRight={
                  boardStats !== null && boardStats.postsNew > 0
                    ? <Badge variant="new">신규 {boardStats.postsNew}</Badge>
                    : undefined
                }
                onClick={() => handleNav('board', '익명 Q&A 게시판')}
              />
            </div>
          </section>

          {/* 04 자랑하기 */}
          <section id="show" className="ac-section">
            <SectionLabel
              num="04 / 04" title="자랑하기"
              en="Show what you built"
              desc="결과물은 공유될 때 가장 빛납니다. 만든 것을 동료에게 보여주세요."
            />
            <div className="ac-grid-1">
              <WideCard
                icon={<ShareIcon />}
                title="내 프로젝트 자랑하기"
                desc="작은 성공경험, 실패경험을 공유해 함께 성장할 수 있는 선순환 고리를 만들어보세요"
                metaLeft={
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ display: 'inline-flex' }}>
                      {([
                        { initials: 'SY', bg: '#FFE4D2', color: '#C26B33' },
                        { initials: 'JH', bg: '#D4E4FA', color: '#004A99' },
                        { initials: 'MK', bg: '#E0F0DD', color: '#2C7A4B' },
                      ] as const).map((av, i) => (
                        <span key={av.initials} style={{
                          width: 24, height: 24, borderRadius: '50%',
                          background: av.bg, color: av.color,
                          display: 'grid', placeItems: 'center',
                          fontSize: 11, fontWeight: 600,
                          border: '2px solid var(--color-surface)',
                          marginLeft: i > 0 ? -8 : 0,
                          flexShrink: 0,
                        }}>
                          {av.initials}
                        </span>
                      ))}
                    </span>
                    <span>
                      {shareCount !== null && shareCount > 0
                        ? `+${shareCount}명이 공유했어요`
                        : '첫 번째로 공유해 보세요'}
                    </span>
                  </span>
                }
                metaRight={<Badge variant="secondary">HOT</Badge>}
                onClick={() => handleNav('share', '내 프로젝트 자랑하기')}
              />
            </div>
          </section>

        </main>
      </div>

      {/* Toast */}
      <ToastEl msg={toastMsg} visible={toastVisible} />

      {/* ChatroomPopup */}
      {showChatroomPopup && (
        <ChatroomPopup onClose={() => setShowChatroomPopup(false)} />
      )}
    </div>
  );
}
