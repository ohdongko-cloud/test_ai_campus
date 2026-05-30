import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '개인정보처리방침',
  description: '이랜드리테일 AI 캠퍼스 개인정보처리방침',
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
};

const EFFECTIVE_DATE = '2026-05-29';
const REVISED_DATE = '2026-05-29';
const SERVICE_NAME = '이랜드리테일 AI 캠퍼스';
const OPERATOR = '이랜드리테일';
const CONTACT_EMAIL = 'oh_dongha01@eland.co.kr';

export default function PrivacyPage() {
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
            개인정보처리방침
          </h1>
          <p style={{ margin: '8px 0 0', color: C.muted, fontSize: 14 }}>
            {SERVICE_NAME} · 시행일 {EFFECTIVE_DATE} · 최종 개정 {REVISED_DATE}
          </p>
        </header>

        <Section title="0. 개요">
          <p>
            {OPERATOR}(이하 &quot;회사&quot;)는 임직원 대상 사내 교육 서비스인 {SERVICE_NAME}(이하 &quot;서비스&quot;)
            제공을 위해 「개인정보보호법」 등 관련 법령을 준수하며, 다음과 같은 방침에 따라 이용자의 개인정보를
            처리합니다. 본 방침은 서비스의 웹 및 안드로이드 앱(패키지명 <Mono>kr.co.eland.aicampus</Mono>)에 동일하게 적용됩니다.
          </p>
        </Section>

        <Section title="1. 수집하는 개인정보 항목">
          <Table
            head={['구분', '수집 항목', '수집 시점']}
            rows={[
              ['회원 가입', '이메일, 이름, 법인명, 조직명, 직무, 비밀번호(SHA-256 해시 저장)', '회원가입 시'],
              ['게시판·댓글', '본문, 게시글 비밀번호(해시), 세션 식별자(좋아요용)', '게시·좋아요 시'],
              ['영상 시청', '워터마크 표시용 이메일(화면 표시에만 사용, 별도 저장 안 함)', '강의 영상 재생 시'],
              ['자동 수집', 'IP 주소, User-Agent, 쿠키·세션 식별자, 접속 로그, 오류 로그', '서비스 이용 시 자동'],
            ]}
          />
        </Section>

        <Section title="2. 수집·이용 목적">
          <ul style={ulStyle}>
            <li>회원 식별·인증 및 사내 임직원 자격 확인</li>
            <li>사내 AI 교육 콘텐츠(강의 영상·가이드·예약·게시판·채팅방) 제공</li>
            <li>미팅 예약 관리 및 차단 시간 운영</li>
            <li>영상 콘텐츠의 외부 유출 방지(이메일 워터마크) 및 사후 추적</li>
            <li>오류·보안 이슈 모니터링, 부정 사용·어뷰징 차단</li>
            <li>서비스 개선을 위한 통계 분석(개인 식별 없는 집계)</li>
          </ul>
        </Section>

        <Section title="3. 보유 및 이용 기간">
          <Table
            head={['항목', '보유 기간', '근거']}
            rows={[
              ['회원 정보', '회원 탈퇴 또는 사내 인사 시스템상 퇴직 처리 시까지', '서비스 제공 계약 유지'],
              ['게시물·댓글', '작성자 삭제 또는 관리자 삭제 시까지', '서비스 운영'],
              ['접속 로그·IP', '3개월', '통신비밀보호법'],
              ['오류 로그(Sentry)', '90일', '내부 운영 정책'],
              ['부정 사용 기록', '1년', '서비스 보호'],
            ]}
          />
          <p style={{ color: C.muted, fontSize: 13, marginTop: 8 }}>
            보유 기간 경과 또는 처리 목적 달성 시 지체 없이 파기합니다. 전자적 파일은 복구 불가능한 방법으로 영구 삭제하고,
            출력물은 분쇄 또는 소각합니다.
          </p>
        </Section>

        <Section title="4. 자동 수집 정보(쿠키·세션·IP)">
          <p>
            서비스는 로그인 세션 유지, 게시판 좋아요 중복 방지, 접근 권한 확인 등을 위해 쿠키와 세션 식별자를 사용합니다.
            이용자는 브라우저 설정에서 쿠키 저장을 거부할 수 있으나, 이 경우 서비스 이용에 제약이 있을 수 있습니다.
          </p>
          <p>
            오류 추적을 위한 Sentry는 발생한 오류의 스택 트레이스와 함께 접속 환경(브라우저·OS·IP 일부)을 수집합니다.
            이 정보는 익명화되어 처리되며, 이용자 본인을 식별하는 목적으로 사용되지 않습니다.
          </p>
        </Section>

        <Section title="5. 개인정보 처리 위탁">
          <p>
            서비스 운영을 위해 다음 업체에 개인정보 처리를 위탁하고 있습니다. 위탁 시 「개인정보보호법」 제26조에 따라
            위탁업무 범위·재위탁 제한·기술적 보호조치 등을 계약에 명시하고 있습니다.
          </p>
          <Table
            head={['수탁자', '위탁 업무', '국외 이전']}
            rows={[
              ['Vercel Inc. (미국)', '웹·앱 호스팅, 트래픽 처리, 정적 자산 CDN', '○'],
              ['Neon, Inc. (미국)', '회원·게시판 데이터베이스(PostgreSQL) 호스팅', '○'],
              ['Functional Software, Inc. (Sentry, 미국)', '서비스 오류 모니터링', '○'],
              ['Resend, Inc. (미국)', '시스템 이메일(인증·알림) 발송', '○'],
              ['Upstash, Inc. (미국)', 'API 요청 제한(Rate Limit) Redis', '○'],
            ]}
          />
          <p style={{ color: C.muted, fontSize: 13, marginTop: 8 }}>
            국외 이전 항목·시점·방법: 위 표의 모든 항목에 대해 서비스 이용 시점에 인터넷망을 통해 미국 리전으로 전송됩니다.
            이전 거부 시 서비스의 본질적 기능 제공이 불가능합니다.
          </p>
        </Section>

        <Section title="6. 제3자 제공">
          <p>
            회사는 이용자의 개인정보를 본 방침 §2에 명시한 목적 외의 용도로 이용하거나 외부에 제공하지 않습니다.
            다만 다음의 경우에는 예외로 합니다.
          </p>
          <ul style={ulStyle}>
            <li>이용자가 사전에 동의한 경우</li>
            <li>법령의 규정에 의거하거나, 수사 목적으로 적법한 절차에 따라 수사기관의 요구가 있는 경우</li>
          </ul>
        </Section>

        <Section title="7. 안전성 확보 조치">
          <ul style={ulStyle}>
            <li>비밀번호의 SHA-256 단방향 해시 저장(평문 미저장)</li>
            <li>전송 구간 HTTPS(TLS) 암호화 강제, 평문(HTTP) 트래픽 차단</li>
            <li>안드로이드 앱 내 영상 재생 화면 캡처·녹화 차단(FLAG_SECURE)</li>
            <li>관리자 권한 분리 및 접근 로그 기록</li>
            <li>API 요청 제한(Rate Limit)을 통한 무차별 공격 방어</li>
            <li>이용자 데이터 자동 백업 비활성화(Android <Mono>allowBackup=false</Mono>)</li>
          </ul>
        </Section>

        <Section title="8. 이용자의 권리 및 행사 방법">
          <p>
            이용자는 언제든지 본인의 개인정보에 대해 다음 권리를 행사할 수 있습니다.
          </p>
          <ul style={ulStyle}>
            <li>개인정보 열람 요구</li>
            <li>오류 정정 요구</li>
            <li>삭제 요구(법령에 의해 보존이 의무화된 정보는 제외)</li>
            <li>처리 정지 요구</li>
            <li>회원 탈퇴(서비스 내 또는 아래 문의처)</li>
          </ul>
          <p>
            권리 행사는 서비스 내 기능 또는 아래 §10의 문의처로 요청하실 수 있으며, 회사는 지체 없이 조치합니다.
          </p>
        </Section>

        <Section title="9. 만 14세 미만 아동의 개인정보">
          <p>
            본 서비스는 {OPERATOR} 임직원을 대상으로 하며 만 14세 미만 아동의 가입을 받지 않습니다.
            가입 과정에서 사내 이메일 도메인을 통해 자격을 확인합니다.
          </p>
        </Section>

        <Section title="10. 개인정보 보호책임자 및 문의">
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
              <strong>개인정보 보호책임자</strong>: {SERVICE_NAME} 운영팀
              <br />
              <strong>문의 이메일</strong>: <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: C.primary }}>{CONTACT_EMAIL}</a>
              <br />
              <strong>소속</strong>: {OPERATOR}
            </p>
          </div>
          <p style={{ marginTop: 12, color: C.muted, fontSize: 13 }}>
            개인정보 침해에 따른 신고·상담이 필요한 경우 아래 기관에 문의하실 수 있습니다.
          </p>
          <ul style={{ ...ulStyle, color: C.muted, fontSize: 13 }}>
            <li>개인정보 침해 신고센터: privacy.kisa.or.kr / 국번없이 118</li>
            <li>개인정보 분쟁조정위원회: kopico.go.kr / 1833-6972</li>
            <li>대검찰청 사이버수사과: spo.go.kr / 국번없이 1301</li>
            <li>경찰청 사이버수사국: cyberbureau.police.go.kr / 국번없이 182</li>
          </ul>
        </Section>

        <Section title="11. 정책 변경">
          <p>
            본 방침은 법령·정책 또는 서비스 변경에 따라 개정될 수 있으며, 개정 시 시행일 7일 전부터 서비스 내 공지사항을 통해
            고지합니다. 중대한 변경(수집 항목 추가, 이용 목적 변경 등)이 있는 경우 30일 전 고지하며, 별도 동의가 필요한
            사항은 재동의를 받습니다.
          </p>
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
          본 방침은 {EFFECTIVE_DATE}부터 시행됩니다. (버전 1.0)
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
