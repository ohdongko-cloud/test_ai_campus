import { Video, Reservation, SharedService, UserInfo, ClickLog, BlockedSlot, GuideGroup, VideoLevel } from './types';
export type { UserInfo };

// localStorage 키
export const KEYS = {
  BLOCKED_SLOTS: 'axtf_blocked_slots',
  VISITED: 'axtf_visited',
  VIDEOS: 'axtf_videos',
  RESERVATIONS: 'axtf_reservations',
  SERVICES: 'axtf_services',
  CHATROOM_URL: 'axtf_chatroom_url',
  CHATROOM_PASSWORD: 'axtf_chatroom_password',
  CHATROOM_RULES: 'axtf_chatroom_rules',
  CLICK_LOG: 'axtf_click_log',
  GUIDE_GROUPS: 'axtf_guide_groups',
  NOA_URL: 'axtf_noa_url',
  VIDEO_LEVELS: 'axtf_video_levels',
};

const DEFAULT_VIDEO_LEVELS: VideoLevel[] = [
  { id: 'basic',        name: '기초', description: '기초 개념과 입문 수준의 강의' },
  { id: 'intermediate', name: '중급', description: '실무 활용 수준의 강의' },
  { id: 'advanced',     name: '고급', description: '심화 및 고급 기술 강의' },
  { id: 'applied',      name: '응용', description: '실제 프로젝트 적용 수준의 강의' },
];

const DEFAULT_CHATROOM_RULES = `1. 존댓말로 소통해 주세요.
2. AI 관련 질문과 팁만 공유해 주세요.
3. 타인 비방 및 욕설은 금지입니다.
4. 광고·홍보성 게시물은 삭제됩니다.
5. 회사 기밀 정보는 공유하지 마세요.`;

const DEFAULT_GUIDE_GROUPS: GuideGroup[] = [
  {
    id: 'dev-env',
    name: '개발 환경 및 소스 관리',
    description: '코드를 작성하고 버전을 관리하는 기본 환경입니다. 협업과 히스토리 추적에 필수적입니다.',
    items: [
      { id: 'github', name: 'GitHub', description: '소스 코드 버전 관리와 협업 플랫폼. 오픈소스 프로젝트나 팀 협업에 필수.', cost: '무료 / 유료 플랜', url: 'https://github.com', recommended: false },
      { id: 'codesandbox', name: 'CodeSandbox', description: '브라우저 기반 코드 편집 환경. 빠른 프로토타입 제작 및 공유에 적합.', cost: '무료 / 유료 플랜', url: 'https://codesandbox.io', recommended: false },
    ],
  },
  {
    id: 'deploy',
    name: '빌드·배포 플랫폼',
    description: '만든 서비스를 인터넷에 배포하는 플랫폼입니다. GitHub와 연동해 자동 배포(CI/CD)를 설정할 수 있습니다.',
    items: [
      { id: 'vercel', name: 'Vercel', description: '프론트엔드/풀스택 프로젝트를 서버리스로 배포. GitHub 연동 CI/CD 제공.', cost: '무료 플랜 / 트래픽 기반 유료', url: 'https://vercel.com', recommended: false },
      { id: 'netlify', name: 'Netlify', description: 'JAMstack 사이트 배포 플랫폼. 정적/동적 웹사이트 배포에 적합.', cost: '무료 플랜 / 유료 플랜', url: 'https://netlify.com', recommended: true },
    ],
  },
  {
    id: 'database',
    name: '데이터베이스 및 백엔드',
    description: '앱의 데이터를 저장하고 API를 구성하는 서비스입니다. 복잡한 서버 설정 없이 빠르게 백엔드를 구축할 수 있습니다.',
    items: [
      { id: 'supabase', name: 'Supabase', description: 'PostgreSQL 기반 DB, 인증, 스토리지, 리얼타임 기능 제공. 간단한 설정으로 백엔드 구성 가능.', cost: '무료 티어 / 유료 플랜', url: 'https://supabase.com', recommended: false },
      { id: 'neon', name: 'Neon', description: '서버리스 PostgreSQL. 자동 슬립/웨이크 기능으로 비용 효율적.', cost: '무료 티어 / 사용량 기반', url: 'https://neon.tech', recommended: false },
    ],
  },
  {
    id: 'cloud',
    name: '클라우드 및 인프라',
    description: '컴퓨팅, 스토리지, AI API 등 엔터프라이즈 수준의 인프라를 제공합니다. 규모가 큰 서비스에 적합합니다.',
    items: [
      { id: 'gcp', name: 'Google Cloud Platform', description: '컴퓨팅, 스토리지, AI API 등 광범위한 서비스 제공. 신규 사용자 크레딧 제공.', cost: '사용량 기반 / 신규 크레딧 제공', url: 'https://cloud.google.com', recommended: false },
      { id: 'aws', name: 'Amazon Web Services', description: '서버리스(Lambda), 데이터베이스(RDS), AI/ML 서비스 등 엔터프라이즈 인프라 제공.', cost: '사용량 기반 / 프리 티어 제공', url: 'https://aws.amazon.com', recommended: true },
    ],
  },
  {
    id: 'mobile',
    name: '모바일 앱 배포',
    description: '만든 앱을 스마트폰 사용자에게 배포하는 플랫폼입니다. 각 플랫폼별 개발자 계정이 필요합니다.',
    items: [
      { id: 'google-play', name: 'Google Play Console', description: 'Android 앱 등록 및 배포 플랫폼.', cost: '최초 등록비 $25', url: 'https://play.google.com/console', recommended: false },
      { id: 'appstore', name: 'Apple App Store Connect', description: 'iOS 앱 배포 플랫폼.', cost: '연간 $99 (개발자 프로그램)', url: 'https://appstoreconnect.apple.com', recommended: true },
    ],
  },
  {
    id: 'ai',
    name: 'AI 서비스 및 멀티모달 플랫폼',
    description: 'AI 기능을 직접 사용하거나 서비스에 연결할 수 있는 AI 플랫폼입니다. 텍스트, 이미지, 음악 생성 등 다양한 멀티모달 AI를 활용할 수 있습니다.',
    items: [
      { id: 'openai', name: 'OpenAI Platform', description: 'GPT/Embeddings 등 AI 모델 API 제공. 자연어 처리나 챗봇 서비스에 활용.', cost: '토큰 기반 과금', url: 'https://platform.openai.com', recommended: true },
      { id: 'claude', name: 'Claude', description: 'Anthropic의 대화형 AI 플랫폼. 긴 문맥 이해와 안전성 중심 설계.', cost: '무료 플랜 / 유료 플랜', url: 'https://claude.ai', recommended: true },
      { id: 'chatgpt', name: 'ChatGPT', description: 'OpenAI의 대화형 AI 서비스. 텍스트 생성, 요약, 번역 등 범용 AI 어시스턴트.', cost: '무료 플랜 / Plus 유료', url: 'https://chatgpt.com', recommended: true },
      { id: 'antigravity', name: 'Antigravity', description: 'AI21 Labs의 생성형 텍스트 플랫폼. 고품질 자연어 생성 특화.', cost: '사용량 기반', url: 'https://www.ai21.com', recommended: false },
      { id: 'codex', name: 'Codex', description: '코드 생성에 특화된 OpenAI 모델. GitHub Copilot의 기반 기술.', cost: 'API 사용량 기반', url: 'https://platform.openai.com/docs/models', recommended: false },
      { id: 'gemini', name: 'Gemini', description: 'Google의 멀티모달 AI 플랫폼. 텍스트·이미지·코드 통합 처리.', cost: '무료 플랜 / 유료 플랜', url: 'https://gemini.google.com', recommended: true },
      { id: 'midjourney', name: 'Midjourney', description: '디스코드 기반 이미지 생성 AI 서비스. 고품질 아트·디자인 이미지 생성.', cost: '유료 구독', url: 'https://www.midjourney.com', recommended: false },
      { id: 'kling', name: 'Cling (Kling)', description: 'ByteDance의 멀티모달 생성형 AI 플랫폼. 텍스트·이미지·영상 생성 지원.', cost: '무료 플랜 / 유료 플랜', url: 'https://klingai.com', recommended: false },
      { id: 'suno', name: 'Suno', description: '음악 생성 AI 서비스. 텍스트 프롬프트만으로 완성된 음악 생성.', cost: '무료 플랜 / 유료 플랜', url: 'https://suno.com', recommended: false },
      { id: 'nanobanana', name: 'Nanobanana', description: '실험적인 멀티모달 AI 서비스. 다양한 생성형 AI 기능 탐색에 활용.', cost: '무료', url: 'https://nanobanana.ai', recommended: false },
      { id: 'hixfield', name: 'Hixfield', description: '텍스트·이미지·오디오를 포괄하는 멀티모달 AI 플랫폼.', cost: '무료 플랜 / 유료 플랜', url: 'https://hixfield.ai', recommended: false },
    ],
  },
  {
    id: 'collaboration',
    name: '협업 및 문서 관리',
    description: '팀 커뮤니케이션과 지식 공유를 위한 도구입니다. 원활한 협업과 문서화에 필수적입니다.',
    items: [
      { id: 'slack', name: 'Slack', description: '팀 커뮤니케이션 도구. 다양한 봇과 서비스 연동 가능.', cost: '무료 플랜 / 유료 플랜', url: 'https://slack.com', recommended: true },
      { id: 'notion', name: 'Notion', description: '위키·문서·프로젝트 관리 도구. 팀 지식 공유에 용이.', cost: '무료 플랜 / 유료 플랜', url: 'https://notion.so', recommended: true },
      { id: 'figma', name: 'Figma', description: 'UI/UX 디자인 협업 도구. 디자인 시스템 구축과 프로토타이핑에 적합.', cost: '무료 플랜 / 유료 플랜', url: 'https://figma.com', recommended: true },
    ],
  },
];

// 초기 샘플 영상 데이터
export const INITIAL_VIDEOS: Video[] = [
  { id: '1', title: 'AI란 무엇인가 — 기초 개념 정리', level: '기초', description: 'AI의 기본 개념과 머신러닝, 딥러닝의 차이를 쉽게 설명합니다.', youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', viewCount: 0 },
  { id: '2', title: 'ChatGPT 업무 활용법', level: '기초', description: '실무에서 바로 쓸 수 있는 프롬프트 작성 방법을 소개합니다.', youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', viewCount: 0 },
  { id: '3', title: 'AI API 연동 기초 — REST API 이해', level: '중급', description: 'AI 서비스를 외부 시스템과 연결하는 API 기초를 다룹니다.', youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', viewCount: 0 },
  { id: '4', title: '사내 챗봇 만들기 실습', level: '고급', description: '실제 사내 데이터를 활용해 간단한 질의응답 챗봇을 구축합니다.', youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', viewCount: 0 },
  { id: '5', title: 'AI 자동화 파이프라인 설계', level: '응용', description: '반복 업무를 AI로 자동화하는 파이프라인 설계 방법을 다룹니다.', youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', viewCount: 0 },
];

// 유튜브 videoId 추출
export function extractVideoId(url: string): string {
  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtu\.be\/([^?]+)/,
    /youtube\.com\/embed\/([^?]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return '';
}

// localStorage 읽기/쓰기 헬퍼
export function getVideos(): Video[] {
  try {
    const raw = localStorage.getItem(KEYS.VIDEOS);
    if (raw) return JSON.parse(raw);
    localStorage.setItem(KEYS.VIDEOS, JSON.stringify(INITIAL_VIDEOS));
    return INITIAL_VIDEOS;
  } catch { return INITIAL_VIDEOS; }
}

export function setVideos(videos: Video[]): void {
  localStorage.setItem(KEYS.VIDEOS, JSON.stringify(videos));
}

export function getReservations(): Reservation[] {
  try {
    const raw = localStorage.getItem(KEYS.RESERVATIONS);
    if (!raw) return [];
    const list: Reservation[] = JSON.parse(raw);
    // 기존 데이터에 status 없으면 pending으로 기본값
    return list.map(r => ({ ...r, status: r.status || 'pending' }));
  } catch { return []; }
}

export function getBlockedSlots(): BlockedSlot[] {
  try {
    const raw = localStorage.getItem(KEYS.BLOCKED_SLOTS);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function setBlockedSlots(slots: BlockedSlot[]): void {
  localStorage.setItem(KEYS.BLOCKED_SLOTS, JSON.stringify(slots));
}

// 이름 마스킹: 첫 글자 + ** + 마지막 글자
export function maskName(name: string): string {
  if (!name) return '';
  if (name.length === 1) return '*';
  if (name.length === 2) return name[0] + '*';
  const middle = '*'.repeat(name.length - 2);
  return name[0] + middle + name[name.length - 1];
}

export function setReservations(reservations: Reservation[]): void {
  localStorage.setItem(KEYS.RESERVATIONS, JSON.stringify(reservations));
}

export function getServices(): SharedService[] {
  try {
    const raw = localStorage.getItem(KEYS.SERVICES);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function setServices(services: SharedService[]): void {
  localStorage.setItem(KEYS.SERVICES, JSON.stringify(services));
}

export function getChatroomUrl(): string {
  return localStorage.getItem(KEYS.CHATROOM_URL) || 'https://open.kakao.com';
}

export function setChatroomUrl(url: string): void {
  localStorage.setItem(KEYS.CHATROOM_URL, url);
}

export function getChatroomPassword(): string {
  return localStorage.getItem(KEYS.CHATROOM_PASSWORD) || '';
}

export function setChatroomPassword(pw: string): void {
  localStorage.setItem(KEYS.CHATROOM_PASSWORD, pw);
}

export function getChatroomRules(): string {
  return localStorage.getItem(KEYS.CHATROOM_RULES) || DEFAULT_CHATROOM_RULES;
}

export function setChatroomRules(rules: string): void {
  localStorage.setItem(KEYS.CHATROOM_RULES, rules);
}

export function getVideoLevels(): VideoLevel[] {
  try {
    const raw = localStorage.getItem(KEYS.VIDEO_LEVELS);
    return raw ? JSON.parse(raw) : DEFAULT_VIDEO_LEVELS;
  } catch { return DEFAULT_VIDEO_LEVELS; }
}

export function setVideoLevels(levels: VideoLevel[]): void {
  localStorage.setItem(KEYS.VIDEO_LEVELS, JSON.stringify(levels));
}

export function getClickLogInRange(start: string, end: string): ClickLog[] {
  return getClickLog().filter(log => {
    const d = log.timestamp.slice(0, 10);
    return d >= start && d <= end;
  });
}

export function getNoaUrl(): string {
  return localStorage.getItem(KEYS.NOA_URL) || 'https://noa.eland.com';
}

export function setNoaUrl(url: string): void {
  localStorage.setItem(KEYS.NOA_URL, url);
}

export function getGuideGroups(): GuideGroup[] {
  try {
    const raw = localStorage.getItem(KEYS.GUIDE_GROUPS);
    return raw ? JSON.parse(raw) : DEFAULT_GUIDE_GROUPS;
  } catch { return DEFAULT_GUIDE_GROUPS; }
}

export function setGuideGroups(groups: GuideGroup[]): void {
  localStorage.setItem(KEYS.GUIDE_GROUPS, JSON.stringify(groups));
}

export function getUserInfo(): UserInfo | null {
  try {
    const raw = localStorage.getItem(KEYS.VISITED);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function setUserInfo(info: UserInfo): void {
  localStorage.setItem(KEYS.VISITED, JSON.stringify(info));
}

export function getClickLog(): ClickLog[] {
  try {
    const raw = localStorage.getItem(KEYS.CLICK_LOG);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function addClickLog(button: string): void {
  const log = getClickLog();
  log.push({ button, timestamp: new Date().toISOString() });
  localStorage.setItem(KEYS.CLICK_LOG, JSON.stringify(log));
}

// 클릭 로그 집계
export function aggregateClickLog(): Record<string, number> {
  const log = getClickLog();
  const result: Record<string, number> = {
    '강의영상': 0, '게시판': 0, '미팅요청': 0, '오픈채팅방': 0, '서비스공유': 0,
  };
  log.forEach(item => {
    if (result[item.button] !== undefined) result[item.button]++;
  });
  return result;
}

// 날짜 포맷 헬퍼
export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function formatDateTime(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}`;
}

// 주간 날짜 계산 (월~금)
export function getWeekDates(weekOffset: number = 0): Date[] {
  const today = new Date();
  const day = today.getDay(); // 0=일, 1=월 ...
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

// 시간 슬롯 생성 (08:00 ~ 16:30, 30분 단위)
export function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 8; h <= 16; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`);
    if (h < 17) slots.push(`${String(h).padStart(2, '0')}:30`);
  }
  return slots.slice(0, 18);
}

// 다음 슬롯 계산
export function getNextSlot(time: string): string {
  const [h, m] = time.split(':').map(Number);
  if (m === 0) return `${String(h).padStart(2, '0')}:30`;
  return `${String(h + 1).padStart(2, '0')}:00`;
}

// 간단 ID 생성
export function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
