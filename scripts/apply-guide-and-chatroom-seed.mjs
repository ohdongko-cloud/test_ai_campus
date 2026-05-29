// 서비스 가이드 시드 데이터 + 카톡 링크 업데이트 (v2 — 초보자 친화 설명 + Figma 추가).
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);
const CHATROOM_URL = 'https://open.kakao.com/o/gvPCZSvi';

const groups = [
  {
    id: 'ai-coding',
    name: 'AI 코딩 도구',
    description: '내가 시키면 AI가 직접 코드를 써주거나 고쳐주는 도구',
    items: [
      { id: 'claude-code', name: 'Claude Code', recommended: true, url: 'https://claude.com/ko/download',
        cost: '유료 (월 $20부터)',
        description: '터미널 창에 \'claude\' 라고 치면 AI가 내 코드를 같이 들여다보고 직접 수정해주는 도구. 파일 10개를 한 번에 고치거나 버그 찾을 때 사람보다 빠릅니다.' },
      { id: 'codex', name: 'Codex', recommended: true, url: 'https://chatgpt.com/ko-KR/codex',
        cost: '유료 (월 $20부터)',
        description: 'ChatGPT를 만든 OpenAI의 코딩 전용 AI. ChatGPT 가입자라면 추가로 깔지 않고 바로 쓸 수 있어요. 인터넷 검색하며 코드 짜는 게 강점.' },
      { id: 'antigravity', name: 'Antigravity', recommended: false, url: 'https://antigravity.google/',
        cost: '베타 (현재 무료)',
        description: 'Google이 만든 새 AI 코딩 도구. AI 여러 명이 한 팀처럼 협업하면서 코딩 + 브라우저 자동 조작까지 같이 해줍니다.' },
    ],
  },
  {
    id: 'ai-assistant',
    name: 'AI 어시스턴트',
    description: '글쓰기·번역·분석·아이디어 회의까지 모든 일을 대화로 해결하는 만능 비서 AI',
    items: [
      { id: 'claude', name: 'Claude', recommended: true, url: 'https://claude.ai',
        cost: '무료 + 월 $20 (Pro)',
        description: '긴 글(소설책 한 권 분량)도 한 번에 읽고 요약·분석해요. 거짓말을 잘 안 하고 신중한 성격. 보고서·계약서 분석·코드 리뷰에 잘 어울립니다.' },
      { id: 'chatgpt', name: 'ChatGPT', recommended: true, url: 'https://chatgpt.com',
        cost: '무료 + 월 $20 (Plus)',
        description: 'AI 챗봇의 대명사. 이미지·음성·동영상도 다루고 웹 검색까지 통합. 가장 많은 사람이 쓰고 가장 빠르게 새 기능이 나옵니다.' },
      { id: 'gemini', name: 'Gemini', recommended: true, url: 'https://gemini.google.com',
        cost: '무료 + 월 $20 (Advanced)',
        description: 'Google이 만든 AI. Gmail·Docs·Drive 안에서 바로 호출 가능. 회사가 Google Workspace 쓴다면 가장 자연스러움.' },
      { id: 'grok', name: 'Grok', recommended: false, url: 'https://grok.com',
        cost: '유료 (X Premium)',
        description: '일론 머스크의 xAI가 만든 AI. X(트위터) 실시간 글을 직접 보고 답해서 트렌드 분석에 강점. 톤이 유머러스함.' },
    ],
  },
  {
    id: 'dev-env',
    name: '개발 환경 / 소스 관리',
    description: '코드를 저장하고, 버전을 관리하고, 동료와 같이 작업하는 공간',
    items: [
      { id: 'github', name: 'GitHub', recommended: true, url: 'https://github.com',
        cost: '무료 + 월 $4 (Pro)',
        description: '전 세계 개발자가 코드를 올려두는 표준 창고. 누가 언제 뭘 바꿨는지 다 추적 가능하고, 다른 사람과 같이 작업할 때 충돌 없이 합칠 수 있어요.' },
      { id: 'codesandbox', name: 'CodeSandbox', recommended: false, url: 'https://codesandbox.io',
        cost: '무료 + 유료',
        description: '컴퓨터에 아무것도 안 깔고 브라우저에서 바로 코딩하는 도구. 빠르게 시제품 만들거나 누군가에게 보여줄 때 좋아요.' },
    ],
  },
  {
    id: 'deploy',
    name: '빌드 / 배포 플랫폼',
    description: '만든 사이트를 인터넷에 띄워서 사용자가 접속할 수 있게 해주는 서비스',
    items: [
      { id: 'vercel', name: 'Vercel', recommended: true, url: 'https://vercel.com',
        cost: '무료 + 월 $20 (Pro)',
        description: 'GitHub에 코드 올리기만 하면 알아서 사이트를 인터넷에 띄워줍니다. Next.js를 만든 회사라 가장 잘 맞고, 이 사이트도 Vercel로 운영 중.' },
      { id: 'netlify', name: 'Netlify', recommended: false, url: 'https://netlify.com',
        cost: '무료 + 월 $19 (Pro)',
        description: 'Vercel과 거의 비슷한 사이트 배포 서비스. 입력 폼·로그인 같은 부가 기능을 더 쉽게 붙일 수 있어요.' },
    ],
  },
  {
    id: 'database',
    name: '데이터베이스 / 백엔드',
    description: '데이터(사용자·게시글·예약 등)를 안전하게 저장하는 창고',
    items: [
      { id: 'supabase', name: 'Supabase', recommended: true, url: 'https://supabase.com',
        cost: '무료 + 월 $25 (Pro)',
        description: '데이터 저장 + 회원가입 + 파일 업로드 + 실시간 채팅까지 한 번에 되는 백엔드 패키지. 빠르게 서비스 만들 때 최고 선택.' },
      { id: 'neon', name: 'Neon', recommended: true, url: 'https://neon.tech',
        cost: '무료 + 월 $19 (Launch)',
        description: '안 쓰면 잠들고 쓰면 깨어나는 데이터베이스. 안 쓸 땐 비용이 거의 안 나와서 사이드 프로젝트에 좋아요. 이 사이트도 Neon 사용.' },
      { id: 'render', name: 'Render', recommended: false, url: 'https://render.com',
        cost: '무료(제한) + 월 $7부터',
        description: '서버·DB·예약 작업까지 한 군데서 다 호스팅하는 PaaS. 옛날 Heroku 대체재. 설정이 단순해서 입문자에게 좋아요.' },
    ],
  },
  {
    id: 'infra',
    name: '운영 인프라',
    description: '실제로 서비스가 잘 돌아가게 도와주는 인프라 도구들 (이메일·알람·캐시)',
    items: [
      { id: 'resend', name: 'Resend', recommended: true, url: 'https://resend.com',
        cost: '무료 3,000통/월 + 월 $20',
        description: '회원가입 인증 메일, 알림 메일 같은 걸 코드 몇 줄로 보낼 수 있는 서비스. 이 사이트의 인증 코드도 Resend로 발송.' },
      { id: 'sentry', name: 'Sentry', recommended: true, url: 'https://sentry.io',
        cost: '무료 5,000건/월',
        description: '사용자가 사이트 쓰다가 에러가 나면 자동으로 알려주는 알람 시스템. 어느 화면에서 뭐가 잘못됐는지 그대로 보여줘서 디버깅이 빨라요.' },
      { id: 'upstash', name: 'Upstash', recommended: true, url: 'https://upstash.com',
        cost: '무료 10,000건/일',
        description: '서버 메모리를 빌려쓰는 캐시 서비스. "로그인 5분에 5번만" 같은 횟수 제한이나 임시 데이터 저장에 사용해요.' },
    ],
  },
  {
    id: 'collaboration',
    name: '협업 도구',
    description: '팀원과 소통하고 문서를 같이 쓰는 도구',
    items: [
      { id: 'notion', name: 'Notion', recommended: true, url: 'https://notion.so',
        cost: '무료 + 월 $10 (Plus)',
        description: '메모장 + 위키 + 데이터베이스 + 프로젝트 관리를 한 곳에서. 회사 위키, 회의록, 매뉴얼 모두 노션 하나로 정리 가능.' },
      { id: 'slack', name: 'Slack', recommended: true, url: 'https://slack.com',
        cost: '무료(메시지 제한) + 유료',
        description: '단톡방이 아니라 "주제별 채널"로 나눠서 정리하는 회사 메신저. 봇·외부 도구 연동이 매우 풍부해서 개발자에게 인기.' },
      { id: 'flow', name: 'Flow', recommended: false, url: 'https://flow.team',
        cost: '무료 + 유료',
        description: 'Slack의 한국형 버전. 한국어 UI + 결재·캘린더가 같이 있어서 국내 회사에 친숙한 협업 도구.' },
    ],
  },
  {
    id: 'image-video-ai',
    name: '이미지 / 영상 / 음악 AI',
    description: '글로 설명만 하면 이미지·동영상·음악·아바타까지 만들어주는 AI',
    items: [
      { id: 'midjourney', name: 'Midjourney', recommended: true, url: 'https://midjourney.com',
        cost: '유료 (월 $10부터)',
        description: '글로 그림을 만드는 AI 중 가장 예쁜 결과로 유명. "미래도시 야경, 사이버펑크 분위기" 같은 명령으로 작품 같은 이미지 생성.' },
      { id: 'nano-banana', name: 'Nano Banana', recommended: true, url: 'https://gemini.google.com',
        cost: '무료 + Gemini Advanced',
        description: 'Google의 새 이미지 AI. "이 사진에서 배경만 바꿔줘" 같은 편집이 빠르고, 같은 인물 얼굴을 일관되게 유지하는 게 강점.' },
      { id: 'kling', name: 'Kling AI', recommended: false, url: 'https://klingai.com',
        cost: '무료(제한) + 유료',
        description: '글이나 사진을 넣으면 짧은 동영상으로 만들어주는 AI. Sora를 못 쓰는 사람들에게 가장 현실적인 대안.' },
      { id: 'suno', name: 'Suno', recommended: false, url: 'https://suno.com',
        cost: '무료(제한) + 유료',
        description: '"가을 분위기 발라드, 잔잔하게" 같은 한 줄로 보컬·반주 들어간 완성된 곡을 만들어주는 AI. 광고 BGM에 활용.' },
      { id: 'heygen', name: 'HeyGen', recommended: false, url: 'https://heygen.com',
        cost: '유료 (월 $24부터)',
        description: '대본만 넣으면 가상 사람이 영상에서 직접 발표하는 콘텐츠를 만들어줘요. 교육 영상·홍보 영상 자동화에 강력.' },
      { id: 'capcut', name: 'CapCut', recommended: true, url: 'https://capcut.com',
        cost: '무료 + 유료',
        description: '틱톡 만든 회사의 영상 편집 앱. 자막 자동 생성, 노이즈 제거 같은 AI 기능이 무료. 입문자도 30분이면 영상 한 편 완성.' },
    ],
  },
  {
    id: 'design',
    name: '디자인 도구',
    description: '디자이너가 아니어도 발표자료·SNS·웹 디자인을 만들 수 있는 도구',
    items: [
      { id: 'miricanvas', name: '미리캔버스', recommended: true, url: 'https://miricanvas.com',
        cost: '무료 + 유료',
        description: '한국형 디자인 도구. 한글 폰트·국내 트렌드 템플릿이 많아서 사내 발표자료·SNS 게시물 만들 때 빠릅니다.' },
      { id: 'canva', name: 'Canva', recommended: true, url: 'https://canva.com',
        cost: '무료 + 월 $13 (Pro)',
        description: '전 세계에서 가장 많이 쓰는 디자인 도구. 수백만 개 템플릿·사진·일러스트 보유. 영어 자료나 글로벌한 톤에 강함.' },
      { id: 'figma', name: 'Figma', recommended: true, url: 'https://figma.com',
        cost: '무료 + 월 $15 (Pro)',
        description: '디자이너가 UI/앱 화면을 그리는 표준 도구. 여러 명이 동시에 같은 화면을 그리며 작업 가능. 디자이너↔개발자 협업의 표준.' },
    ],
  },
  {
    id: 'mobile',
    name: '앱 배포 콘솔',
    description: '직접 만든 앱을 사용자에게 배포하기 위한 공식 등록 페이지',
    items: [
      { id: 'google-play', name: 'Google Play Console', recommended: false, url: 'https://play.google.com/console',
        cost: '최초 등록비 $25 일회성',
        description: 'Android 앱을 등록·심사받고 사용자에게 배포하는 곳. 다운로드 통계·매출도 여기서 확인.' },
      { id: 'google-cloud', name: 'Google Cloud Console', recommended: false, url: 'https://console.cloud.google.com',
        cost: '사용량 기반 + 신규 크레딧',
        description: 'Google이 제공하는 모든 클라우드 서비스를 관리하는 콘솔. AI API·서버·저장소·BigQuery 등 사용.' },
      { id: 'apple-app-store', name: 'Apple App Store Connect', recommended: false, url: 'https://appstoreconnect.apple.com',
        cost: '연간 $99 (개발자 프로그램)',
        description: 'iPhone·iPad 앱을 등록·심사받는 곳. TestFlight로 베타 테스터에게 먼저 배포할 수도 있어요.' },
    ],
  },
];

console.log('1) 카톡 링크 업데이트');
await sql`
  INSERT INTO app_settings (key, value)
  VALUES ('chatroom_url', ${JSON.stringify(CHATROOM_URL)}::jsonb)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
console.log('   ✓ chatroom_url =', CHATROOM_URL);

console.log('\n2) 가이드 데이터 wipe');
await sql`DELETE FROM guide_items`;
await sql`DELETE FROM guide_groups`;
console.log('   ✓ wiped');

console.log('\n3) 가이드 데이터 시드 (v2 — 초보자 친화 설명 + Figma)');
let totalItems = 0;
for (let gi = 0; gi < groups.length; gi++) {
  const g = groups[gi];
  await sql`
    INSERT INTO guide_groups (id, name, description, order_idx)
    VALUES (${g.id}, ${g.name}, ${g.description}, ${gi})`;
  for (let ii = 0; ii < g.items.length; ii++) {
    const it = g.items[ii];
    await sql`
      INSERT INTO guide_items (id, group_id, name, description, cost, url, recommended, order_idx)
      VALUES (${it.id}, ${g.id}, ${it.name}, ${it.description},
              ${it.cost}, ${it.url}, ${!!it.recommended}, ${ii})`;
    totalItems++;
  }
  console.log(`   ✓ ${g.name}: ${g.items.length}개`);
}

console.log(`\n✅ 완료: ${groups.length} 그룹, ${totalItems} 아이템`);
