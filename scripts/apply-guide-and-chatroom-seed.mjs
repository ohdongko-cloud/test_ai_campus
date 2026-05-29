// 서비스 가이드 시드 데이터 + 카톡 링크 업데이트.
// 멱등(여러 번 실행해도 안전):
//   - guide_groups / guide_items: 전체 삭제 후 재삽입
//   - app_settings.chatroom_url: UPSERT (덮어쓰기)
//
// 실행: node --env-file=.env.local scripts/apply-guide-and-chatroom-seed.mjs

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

// ─────────────────────────────────────────────────────────────
// 카톡 링크
const CHATROOM_URL = 'https://open.kakao.com/o/gvPCZSvi';

// ─────────────────────────────────────────────────────────────
// 가이드 그룹 + 아이템 (10 그룹, 28 아이템)
const groups = [
  {
    id: 'ai-coding',
    name: 'AI 코딩 도구',
    description: '터미널/IDE에서 AI가 코드를 직접 작성·수정하는 에이전트',
    items: [
      { id: 'claude-code', name: 'Claude Code', recommended: true, url: 'https://claude.com/ko/download',
        cost: '유료 (Pro $20~/월)',
        description: 'Anthropic Sonnet 4.5 기반 터미널 코딩 에이전트. 멀티파일 리팩토링·디버깅·긴 컨텍스트 추론에 강함. Codex 대비 더 신중한 추론과 안전성.' },
      { id: 'codex', name: 'Codex', recommended: true, url: 'https://chatgpt.com/ko-KR/codex',
        cost: '유료 (Plus $20+/월)',
        description: 'OpenAI GPT-5 기반 코딩 에이전트. 빠른 작업 속도·웹 검색·멀티모달 통합. ChatGPT 가입자에게 자연스러운 진입.' },
      { id: 'antigravity', name: 'Antigravity', recommended: false, url: 'https://antigravity.google/',
        cost: '베타',
        description: 'Google DeepMind의 신규 코딩 에이전트. Gemini 모델 활용. 다중 에이전트 협업과 브라우저 자동화 결합.' },
    ],
  },
  {
    id: 'ai-assistant',
    name: 'AI 어시스턴트 (범용 챗봇)',
    description: '글쓰기·아이디어·분석·번역 등 일상 업무를 가속하는 대화형 AI',
    items: [
      { id: 'claude', name: 'Claude', recommended: true, url: 'https://claude.ai',
        cost: '무료 + Pro $20/월',
        description: '긴 문맥(200K+) 이해와 신중한 추론. 문서 분석·코드 작성·연구 보조에 강함. 정중하고 정직한 톤.' },
      { id: 'chatgpt', name: 'ChatGPT', recommended: true, url: 'https://chatgpt.com',
        cost: '무료 + Plus $20/월',
        description: '가장 폭넓은 사용자 베이스. 멀티모달(이미지·음성·영상·검색) 통합과 GPTs 마켓. 빠른 신규 기능 출시.' },
      { id: 'gemini', name: 'Gemini', recommended: true, url: 'https://gemini.google.com',
        cost: '무료 + Advanced',
        description: 'Google 검색·Gmail·Docs·Drive와 깊이 통합. Workspace 환경에서 압도적 시너지. 이미지 생성 강함.' },
      { id: 'grok', name: 'Grok', recommended: false, url: 'https://grok.com',
        cost: '유료 (X Premium)',
        description: 'xAI(머스크) 모델. X(트위터) 실시간 데이터 직결, 유머러스한 톤. SNS 트렌드 분석에 유리.' },
    ],
  },
  {
    id: 'dev-env',
    name: '개발 환경 / 소스 관리',
    description: '코드를 쓰고, 버전 관리하고, 협업하는 기본 환경',
    items: [
      { id: 'github', name: 'GitHub', recommended: true, url: 'https://github.com',
        cost: '무료 + Pro $4/월',
        description: '전 세계 표준 코드 저장소. PR·이슈·Actions(CI/CD)·Copilot 통합. 오픈소스·사내 협업 모두 표준.' },
      { id: 'codesandbox', name: 'CodeSandbox', recommended: false, url: 'https://codesandbox.io',
        cost: '무료 + Pro',
        description: '브라우저에서 즉시 실행되는 IDE. 프론트엔드 프로토타입·공유·교육에 적합. 설치 불필요.' },
    ],
  },
  {
    id: 'deploy',
    name: '빌드 / 배포 플랫폼',
    description: '코드를 인터넷에 올려 사용자가 접근하게 하는 호스팅',
    items: [
      { id: 'vercel', name: 'Vercel', recommended: true, url: 'https://vercel.com',
        cost: '무료 + Pro $20/월',
        description: 'Next.js 제작사가 운영하는 서버리스 호스팅. GitHub 푸시만으로 자동 배포. Preview URL·Edge Network 강력.' },
      { id: 'netlify', name: 'Netlify', recommended: false, url: 'https://netlify.com',
        cost: '무료 + Pro $19/월',
        description: 'JAMstack 배포 선구자. Vercel과 유사하지만 Forms·Identity·Functions 통합. 정적/동적 모두 지원.' },
    ],
  },
  {
    id: 'database',
    name: '데이터베이스 / 백엔드',
    description: '데이터 저장과 API를 빠르게 구축하는 PaaS',
    items: [
      { id: 'supabase', name: 'Supabase', recommended: true, url: 'https://supabase.com',
        cost: '무료 + Pro $25/월',
        description: '오픈소스 Firebase 대안. PostgreSQL + Auth + Realtime + Storage 한 번에. 풀스택 신속 구축.' },
      { id: 'neon', name: 'Neon', recommended: true, url: 'https://neon.tech',
        cost: '무료 + Launch $19/월',
        description: '서버리스 PostgreSQL. 자동 sleep/wake로 비용 효율. Branching(DB 복제)·Vercel과 궁합 압도적.' },
      { id: 'render', name: 'Render', recommended: false, url: 'https://render.com',
        cost: '무료(제한) + Starter $7/월',
        description: 'Heroku 대안. 웹·크론·DB·Redis를 단일 PaaS로. Docker 지원. 단순한 배포 모델.' },
    ],
  },
  {
    id: 'infra',
    name: '운영 인프라 / 모니터링',
    description: '이메일·에러추적·캐시 등 운영에 필수적인 인프라 SaaS',
    items: [
      { id: 'resend', name: 'Resend', recommended: true, url: 'https://resend.com',
        cost: '무료 3,000통/월 + Pro $20/월',
        description: '개발자 친화 트랜잭셔널 이메일 API. React Email 통합. SendGrid 대비 깔끔한 DX와 빠른 발송.' },
      { id: 'sentry', name: 'Sentry', recommended: true, url: 'https://sentry.io',
        cost: '무료 5,000 events/월',
        description: '에러 추적·성능 모니터링 표준. Next.js·React·Node 통합. 스택 트레이스·세션 리플레이 강력.' },
      { id: 'upstash', name: 'Upstash', recommended: true, url: 'https://upstash.com',
        cost: '무료 10K 명령/일',
        description: '서버리스 Redis/Kafka/Vector DB. 페이-퍼-리퀘스트 과금. 레이트리밋·캐시·세션 저장에 최적.' },
    ],
  },
  {
    id: 'collaboration',
    name: '협업 도구',
    description: '팀 커뮤니케이션·문서·태스크 관리 SaaS',
    items: [
      { id: 'notion', name: 'Notion', recommended: true, url: 'https://notion.so',
        cost: '무료 + Plus $10/월',
        description: '위키·문서·DB·프로젝트 통합. 팀 지식 관리의 사실상 표준. AI 글쓰기 기능 내장.' },
      { id: 'slack', name: 'Slack', recommended: true, url: 'https://slack.com',
        cost: '무료(메시지 제한) + Pro',
        description: '표준 팀 메신저. 채널·스레드·통합(2,000+) 풍부. 개발팀이 가장 익숙한 환경.' },
      { id: 'flow', name: 'Flow', recommended: false, url: 'https://flow.team',
        cost: '무료 + 유료',
        description: '한국형 협업 메신저+태스크. 한국어 UI·결재·캘린더 통합. 국내 기업 친화적.' },
    ],
  },
  {
    id: 'image-video-ai',
    name: '이미지 / 영상 생성 AI',
    description: '텍스트 → 이미지·영상·음악·아바타 생성 도구',
    items: [
      { id: 'midjourney', name: 'Midjourney', recommended: true, url: 'https://midjourney.com',
        cost: '유료 ($10~/월)',
        description: '고품질 아트워크 이미지. Discord 기반. 사실적 사진보다 일러스트·컨셉 아트에 강함.' },
      { id: 'nano-banana', name: 'Nano Banana', recommended: true, url: 'https://gemini.google.com',
        cost: '무료 + Advanced',
        description: 'Google의 Gemini 2.5 Flash Image. 빠른 이미지 편집·일관성 유지(인물 동일성). Gemini 앱에서 사용.' },
      { id: 'kling', name: 'Kling AI', recommended: false, url: 'https://klingai.com',
        cost: '무료(제한) + 유료',
        description: '중국 콰이쇼우의 영상 생성 AI. 텍스트→비디오, 이미지→비디오. Sora 대안 중 접근성 높음.' },
      { id: 'suno', name: 'Suno', recommended: false, url: 'https://suno.com',
        cost: '무료(제한) + 유료',
        description: 'AI 음악 생성. 가사+장르 입력 → 완성된 곡 (보컬+반주). 광고·콘텐츠 BGM에 활용.' },
      { id: 'heygen', name: 'HeyGen', recommended: false, url: 'https://heygen.com',
        cost: '유료',
        description: 'AI 아바타 영상 생성. 스크립트 입력 → 가상 인물이 발표. 교육·마케팅 콘텐츠 자동화.' },
      { id: 'capcut', name: 'CapCut', recommended: true, url: 'https://capcut.com',
        cost: '무료 + Pro',
        description: 'ByteDance의 영상 편집기. 모바일·웹·데스크탑. AI 자막·이펙트·노이즈 제거 내장. 입문자 친화.' },
    ],
  },
  {
    id: 'design',
    name: '그래픽 디자인 도구',
    description: '템플릿 기반으로 디자인 결과물을 빠르게 만드는 SaaS',
    items: [
      { id: 'miricanvas', name: '미리캔버스', recommended: true, url: 'https://miricanvas.com',
        cost: '무료 + 유료',
        description: '한국형 디자인 템플릿 플랫폼. 한국형 폰트·서식 풍부. 사내 자료·발표·SNS에 강함.' },
      { id: 'canva', name: 'Canva', recommended: true, url: 'https://canva.com',
        cost: '무료 + Pro $13/월',
        description: '글로벌 1위 디자인 툴. 방대한 템플릿·사진·일러스트. Magic Studio AI 기능 내장.' },
    ],
  },
  {
    id: 'mobile',
    name: '앱 배포 콘솔',
    description: 'iOS·Android 앱을 사용자에게 배포하기 위한 공식 콘솔',
    items: [
      { id: 'google-play', name: 'Google Play Console', recommended: false, url: 'https://play.google.com/console',
        cost: '최초 등록비 $25',
        description: 'Android 앱 등록·심사·배포. 통계·A/B 테스트·인앱 결제 관리.' },
      { id: 'google-cloud', name: 'Google Cloud Console', recommended: false, url: 'https://console.cloud.google.com',
        cost: '사용량 기반 + 신규 크레딧',
        description: 'GCP 전체 서비스 관리 콘솔. Vertex AI·Cloud Run·BigQuery 등 활용.' },
      { id: 'apple-app-store', name: 'Apple App Store Connect', recommended: false, url: 'https://appstoreconnect.apple.com',
        cost: '연간 $99',
        description: 'iOS 앱 배포. TestFlight 베타·심사·매출 관리. 개발자 프로그램 가입 필요.' },
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

console.log('\n3) 가이드 데이터 시드');
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
