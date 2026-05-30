import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '계정 및 데이터 삭제 요청',
  description: '이랜드리테일 AI 캠퍼스 계정 삭제 및 데이터 삭제 요청 안내',
  robots: { index: true, follow: true },
};

const C = {
  bg: '#F5F7FA',
  surface: '#FFFFFF',
  text: '#0F1E33',
  body: '#3B4A63',
  muted: '#6B7A91',
  border: '#E5EAF1',
  primary: '#004A99',
  primaryLight: '#E6EEF7',
  warn: '#9C7100',
  warnBg: '#FFF6DB',
};

const SERVICE_NAME = '이랜드리테일 AI 캠퍼스';
const APP_NAME_STORE = 'Eland AI 캠퍼스';
const OPERATOR = '이랜드리테일';
const CONTACT_EMAIL = 'oh_dongha01@eland.co.kr';
const EFFECTIVE_DATE = '2026-05-29';

export default function AccountDeletionPage() {
  return (
    <main
      style={{
        background: C.bg,
        minHeight: '100vh',
        padding: '40px 16px',
        fontFamily: '"Noto Sans KR", "Inter", system-ui, sans-serif',
        color: C.text,
        lineHeight: 1.7,
      }}
    >
      <article
        style={{
          maxWidth: 800,
          margin: '0 auto',
          background: C.surface,
          padding: 'clamp(24px, 5vw, 48px)',
          borderRadius: 16,
          boxShadow: '0 2px 6px rgba(15,30,51,0.04), 0 8px 24px rgba(15,30,51,0.06)',
          border: `1px solid ${C.border}`,
        }}
      >
        <header style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: 20, marginBottom: 28 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
            계정 및 데이터 삭제 요청
          </h1>
          <p style={{ margin: '8px 0 0', color: C.muted, fontSize: 14 }}>
            {SERVICE_NAME} (Play Store 등록명: {APP_NAME_STORE}) · 개발/운영: {OPERATOR} · 시행일 {EFFECTIVE_DATE}
          </p>
        </header>

        <Section title="0. 안내">
          <p>
            본 페이지는 <strong>{SERVICE_NAME}</strong> 이용자가 자신의 계정 또는 일부 데이터를 삭제 요청할 수 있는
            절차를 안내합니다. Google Play 데이터 보안 정책에 따라 작성되었으며, 한국 「개인정보보호법」상 정보주체의
            삭제 요구권 행사도 본 절차로 처리됩니다.
          </p>
        </Section>

        <Section title="1. 계정 전체 삭제(회원 탈퇴) 요청">
          <p>
            현재 본 서비스는 <strong>이메일 요청 방식</strong>으로 계정 삭제를 처리합니다.
            아래 절차에 따라 요청하시면 영업일 기준 7일 이내에 처리해 드립니다.
          </p>
          <Steps
            items={[
              <>
                삭제를 요청할 계정의 이메일로{' '}
                <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('[AI 캠퍼스] 계정 삭제 요청')}`} style={{ color: C.primary }}>
                  <strong>{CONTACT_EMAIL}</strong>
                </a>{' '}
                에 메일을 보내주세요.
              </>,
              <>
                제목에 <Mono>[AI 캠퍼스] 계정 삭제 요청</Mono>을 기재합니다.
              </>,
              <>
                본문에 다음 항목을 포함합니다.
                <ul style={ulNested}>
                  <li>가입 시 사용한 이메일 주소</li>
                  <li>이름·소속(본인 확인용)</li>
                  <li>(선택) 삭제 사유</li>
                </ul>
              </>,
              <>운영팀이 본인 확인 후 영업일 기준 <strong>7일 이내</strong> 처리하고 결과를 회신합니다.</>,
            ]}
          />
        </Section>

        <Section title="2. 계정 유지 + 일부 데이터만 삭제 요청">
          <p>
            계정을 유지한 채 일부 데이터만 삭제하고 싶다면 아래 방법을 사용할 수 있습니다.
          </p>
          <Table
            head={['데이터 종류', '삭제 방법']}
            rows={[
              ['내가 작성한 게시글', '서비스 내 게시판에서 본인 게시글 우측 메뉴 → 삭제'],
              ['내가 작성한 댓글', '서비스 내 댓글 우측 메뉴 → 삭제'],
              ['프로필 정보(이름·소속·직무)', `${CONTACT_EMAIL}으로 수정/삭제 요청`],
              ['오류 로그(Sentry) 등 자동수집 데이터', '계정 식별 정보 분리 요청 시 처리'],
            ]}
          />
        </Section>

        <Section title="3. 삭제되는 데이터">
          <p>계정 삭제 요청 시 다음 데이터가 즉시 또는 단기간 내 삭제됩니다.</p>
          <ul style={ulStyle}>
            <li>회원 정보: 이메일, 이름, 법인명, 조직명, 직무, 비밀번호 해시</li>
            <li>이용자가 작성한 게시글·댓글(본인 동의 시 익명 처리 후 보존 가능)</li>
            <li>게시판 좋아요 등 활동 기록</li>
            <li>로그인 세션 및 인증 토큰</li>
          </ul>
        </Section>

        <Section title="4. 법적 의무로 일정 기간 보관되는 데이터">
          <div
            style={{
              background: C.warnBg,
              border: `1px solid #F0DE9E`,
              borderRadius: 10,
              padding: 14,
              marginTop: 4,
              color: C.warn,
              fontSize: 14,
            }}
          >
            아래 항목은 관련 법령에 따라 회원 탈퇴 후에도 일정 기간 보관됩니다. 보관 기간 경과 후 자동 파기됩니다.
          </div>
          <Table
            head={['항목', '보관 기간', '근거']}
            rows={[
              ['웹/앱 접속 로그·IP', '3개월', '통신비밀보호법'],
              ['부정 사용·어뷰징 기록', '1년', '서비스 보호 정책'],
              ['익명 처리된 오류 로그', '90일', '내부 운영 정책'],
            ]}
          />
        </Section>

        <Section title="5. 처리 기간 및 절차">
          <ul style={ulStyle}>
            <li>접수 확인: 요청 메일 수신 후 영업일 기준 <strong>2일 이내</strong> 회신</li>
            <li>본인 확인: 가입 정보와 요청자 일치 여부 검증</li>
            <li>실제 삭제: 접수 확인 후 영업일 기준 <strong>7일 이내</strong> 처리</li>
            <li>완료 통지: 처리 결과를 요청 이메일로 회신</li>
          </ul>
        </Section>

        <Section title="6. 문의처">
          <div
            style={{
              background: C.primaryLight,
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              padding: 16,
              marginTop: 4,
            }}
          >
            <p style={{ margin: 0 }}>
              <strong>운영팀</strong>: {SERVICE_NAME} 운영팀
              <br />
              <strong>이메일</strong>:{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: C.primary }}>{CONTACT_EMAIL}</a>
              <br />
              <strong>소속</strong>: {OPERATOR}
            </p>
          </div>
        </Section>

        <footer
          style={{
            borderTop: `1px solid ${C.border}`,
            marginTop: 32,
            paddingTop: 16,
            color: C.muted,
            fontSize: 13,
          }}
        >
          본 안내는 {EFFECTIVE_DATE}부터 시행됩니다. 보다 자세한 개인정보 처리 사항은{' '}
          <a href="/privacy" style={{ color: C.primary }}>개인정보처리방침</a>을 참고하세요.
        </footer>
      </article>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h2
        style={{
          fontSize: 17,
          fontWeight: 700,
          margin: '0 0 12px',
          letterSpacing: '-0.01em',
          color: C.text,
        }}
      >
        {title}
      </h2>
      <div style={{ color: C.body, fontSize: 14.5 }}>{children}</div>
    </section>
  );
}

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol style={{ margin: '8px 0', paddingLeft: 0, listStyle: 'none' }}>
      {items.map((item, i) => (
        <li
          key={i}
          style={{
            display: 'flex',
            gap: 12,
            padding: '10px 0',
            borderBottom: i === items.length - 1 ? 'none' : `1px solid ${C.border}`,
            color: C.body,
            fontSize: 14.5,
          }}
        >
          <span
            style={{
              flexShrink: 0,
              width: 24,
              height: 24,
              borderRadius: 12,
              background: C.primary,
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {i + 1}
          </span>
          <div style={{ flex: 1 }}>{item}</div>
        </li>
      ))}
    </ol>
  );
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div style={{ overflowX: 'auto', margin: '8px 0' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'separate',
          borderSpacing: 0,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          overflow: 'hidden',
          fontSize: 14,
        }}
      >
        <thead style={{ background: C.primaryLight }}>
          <tr>
            {head.map((h) => (
              <th
                key={h}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  fontWeight: 700,
                  color: C.text,
                  borderBottom: `1px solid ${C.border}`,
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? C.surface : '#FAFBFD' }}>
              {row.map((cell, j) => (
                <td
                  key={j}
                  style={{
                    padding: '10px 12px',
                    color: C.body,
                    borderBottom: i === rows.length - 1 ? 'none' : `1px solid ${C.border}`,
                    verticalAlign: 'top',
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <code
      style={{
        background: '#EEF1F6',
        padding: '1px 6px',
        borderRadius: 4,
        fontSize: 13,
        fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
      }}
    >
      {children}
    </code>
  );
}

const ulStyle: React.CSSProperties = {
  margin: '8px 0',
  paddingLeft: 20,
  color: C.body,
  fontSize: 14.5,
};

const ulNested: React.CSSProperties = {
  margin: '6px 0 0',
  paddingLeft: 20,
  color: C.body,
  fontSize: 14,
};
