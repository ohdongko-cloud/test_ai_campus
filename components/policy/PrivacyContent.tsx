"use client";

const H2 = ({ children }: { children: React.ReactNode }) => (
  <h3 style={{ margin: '20px 0 8px', fontSize: 14, fontWeight: 700, color: '#0F1E33' }}>{children}</h3>
);

const UL = ({ children }: { children: React.ReactNode }) => (
  <ul style={{ margin: '4px 0 8px', paddingLeft: 18, listStyle: 'disc' }}>{children}</ul>
);

const LI = ({ children }: { children: React.ReactNode }) => (
  <li style={{ marginBottom: 4 }}>{children}</li>
);

export default function PrivacyContent() {
  return (
    <div>
      <p style={{ margin: 0 }}>
        이랜드리테일 AX팀(이하 &quot;운영자&quot;)은 이랜드리테일 AI 캠퍼스(이하 &quot;서비스&quot;) 이용 과정에서
        수집되는 개인정보를 다음과 같이 처리합니다.
      </p>

      <H2>1. 운영 주체 및 문의처</H2>
      <UL>
        <LI>운영 부서: 이랜드리테일 AX팀</LI>
        <LI>대표 문의 이메일: <strong>oh_dongha01@eland.co.kr</strong></LI>
        <LI>개인정보 관련 문의·요청은 위 이메일로 접수합니다.</LI>
      </UL>

      <H2>2. 수집하는 개인정보 항목</H2>
      <p style={{ margin: '0 0 4px' }}>
        <strong>가. 회원가입 시</strong>
      </p>
      <UL>
        <LI>이메일 주소 (@eland.co.kr 도메인)</LI>
        <LI>닉네임, 법인명, 부서(브랜드/팀), 직무</LI>
        <LI>비밀번호 (단방향 해시 저장, 평문 미보관)</LI>
      </UL>
      <p style={{ margin: '8px 0 4px' }}>
        <strong>나. 자동 수집 항목</strong>
      </p>
      <UL>
        <LI>IP 주소, User-Agent (접속 장치 정보)</LI>
        <LI>세션 ID, 접속 일시, 사용 페이지</LI>
        <LI>로그인 시도·성공·실패 이력</LI>
      </UL>
      <p style={{ margin: '8px 0 4px' }}>
        <strong>다. 서비스 이용 중</strong>
      </p>
      <UL>
        <LI>게시글, 댓글, 좋아요, 예약, 영상 시청 이력 등 서비스 이용 기록</LI>
      </UL>

      <H2>3. 개인정보의 수집·이용 목적</H2>
      <UL>
        <LI>사내 AI 교육 서비스의 제공 및 회원 관리</LI>
        <LI>부정 사용·외부 유출 방지 및 보안 사고 대응</LI>
        <LI>서비스 통계 분석 및 콘텐츠 품질 개선</LI>
        <LI>약관 위반 행위에 대한 조사 및 조치</LI>
      </UL>

      <H2>4. 개인정보의 보유 및 이용 기간</H2>
      <UL>
        <LI>회원 정보: 회원 탈퇴 시 또는 인사 발령에 따른 자격 상실 시까지</LI>
        <LI>인증 로그(로그인 시도·성공·실패): 1년</LI>
        <LI>접속 로그: 90일</LI>
        <LI>관리자 감사 로그: 3년 (감사 추적)</LI>
        <LI>게시글·댓글: 작성자가 삭제(또는 운영자가 삭제) 시까지</LI>
      </UL>

      <H2>5. 제3자 제공 및 처리 위탁</H2>
      <p style={{ margin: '0 0 4px' }}>
        서비스 제공을 위해 다음 외부 위탁사를 이용합니다. 각 위탁사는 해당 정보보호 정책에 따라
        개인정보를 안전하게 처리합니다.
      </p>
      <UL>
        <LI><strong>Resend</strong> (미국): 회원가입 인증 코드 메일 발송</LI>
        <LI><strong>Sentry</strong> (미국): 에러 추적 — 익명화된 컨텍스트만</LI>
        <LI><strong>Upstash</strong> (일본): 세션·레이트리밋 키 캐시</LI>
        <LI><strong>Neon</strong> (싱가포르): 모든 회원·서비스 데이터 저장 (Postgres)</LI>
        <LI><strong>Vercel</strong> (글로벌): 서비스 호스팅 및 Edge 라우팅</LI>
      </UL>

      <H2>6. 사용자의 권리</H2>
      <UL>
        <LI>본인의 개인정보를 언제든지 열람·정정·삭제할 수 있습니다.</LI>
        <LI>개인정보 처리 동의를 철회할 수 있으며, 이 경우 회원 탈퇴가 함께 처리됩니다.</LI>
        <LI>요청은 대표 이메일(oh_dongha01@eland.co.kr)로 접수합니다.</LI>
      </UL>

      <H2>7. 쿠키 및 세션 사용</H2>
      <UL>
        <LI>로그인 유지를 위해 httpOnly 쿠키를 사용합니다.</LI>
        <LI>&quot;로그인 유지&quot; 체크 시 30일, 미체크 시 세션 쿠키(브라우저 종료 시 만료)로 운영합니다.</LI>
        <LI>관리자 세션은 별도 쿠키로 24시간 단위로 갱신됩니다.</LI>
      </UL>

      <H2>8. 개인정보 안전성 확보 조치</H2>
      <UL>
        <LI>비밀번호 단방향 해시(bcrypt) 저장 — 평문 미보관</LI>
        <LI>전 구간 HTTPS 통신</LI>
        <LI>세션 토큰(JWT) 서명 검증</LI>
        <LI>로그인·가입·댓글 등 주요 API 레이트리밋 적용</LI>
        <LI>관리자 작업에 대한 감사 로그 기록</LI>
      </UL>

      <H2>9. 시행 시기 및 변경</H2>
      <p style={{ margin: 0 }}>
        본 방침은 <strong>2026년 5월 26일</strong>부터 시행됩니다. 향후 변경이 있을 경우 본 서비스
        내 사전 공지를 통해 안내합니다.
      </p>
    </div>
  );
}
