export interface VideoStage {
  id: string;
  title: string;
  description: string;
  /** 스테이지 펼침 시 인라인 표시되는 이미지 URL(Vercel Blob). 순서 = 업로드 순. */
  images?: string[];
}

export interface VideoLevel {
  id: string;
  name: string;
  description: string;
}

export interface Video {
  id: string;
  title: string;
  level: string; // 커스텀 레벨 지원을 위해 string으로 변경
  description: string;
  youtubeUrl: string;
  viewCount: number;
  stages?: VideoStage[];
  order?: number;
  isRequired?: boolean; // 필수 시청 영상 — 카드 우상단 빨간 뱃지 노출
  duration?: string;    // 재생시간 표시용 (예: "40:27", "1:20:45")
  attachmentCount?: number; // 학습 자료(첨부파일) 개수 — 카드 뱃지 + 모달 표시용
}

export interface Reservation {
  id: string;
  name: string;
  role: string;
  taskSummary: string;
  inquiry: string;
  email: string;
  phone: string;
  date: string;
  startTime: string;
  endTime: string;
  registeredAt: string;
  status: 'pending' | 'confirmed' | 'cancelled';
}

export interface BlockedSlot {
  id: string;
  date?: string;       // 특정 날짜 (YYYY-MM-DD), recurring=false일 때 사용
  dayOfWeek?: number;  // 1=월 ... 5=금, recurring=true일 때 사용
  startTime: string;
  endTime?: string;    // 차단 종료 시각 (없으면 startTime+1h로 마이그레이션)
  reason?: string;
  recurring: boolean;
}

export interface SharedService {
  id: string;
  serviceName: string;
  description: string;
  url: string;
  testAccount: string;
  registeredAt: string;
}

export interface UserInfo {
  visited: boolean;
  name: string;
  org: string;            // 구버전 호환 (= organizationName)
  role: string;           // 구버전 호환 (= position)
  email: string;
  corporationName?: string;   // 법인명
  organizationName?: string;  // 조직명(브랜드/점포/팀명)
  position?: string;          // 직무
  userId?: string;            // DB users.id
  employeeId?: string;        // 사번 (원문 저장, 게시판 비번 자동완성용)
}

export interface ClickLog {
  button: string;
  timestamp: string;
}

export type TabType = 'home' | 'videos' | 'meeting' | 'board' | 'share' | 'guide' | 'resources';
export type ReservationStatus = 'pending' | 'confirmed' | 'cancelled';
export type AdminTabType = 'stats' | 'videos' | 'meetings' | 'chatroom' | 'services' | 'board' | 'guide' | 'members' | 'logs' | 'admins' | 'lectureRequests' | 'levelTests' | 'orgUnits' | 'aiLevelCoding' | 'aiLevelMatrix' | 'resources';

// 자료실
export interface Resource {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  external_url: string;
  link_type: 'drive' | 'notion' | 'url';
  view_count: number;
  like_count: number;
  comment_count: number;
  is_pinned: boolean;
  sort_order: number;
  created_at: string;
  /** 관리자 목록에만 포함 */
  updated_at?: string;
  created_by?: string | null;
}

export interface ResourceComment {
  id: string;
  author_name: string;
  content: string;
  like_count: number;
  created_at: string;
}

// 강의 요청
export interface LectureRequest {
  id: string;
  title: string;
  content: string;
  requesterName?: string | null;
  requesterEmail?: string | null;
  status: 'pending' | 'reviewed';
  createdAt: string;
  updatedAt: string;
}

// 서비스 가입 가이드
export interface GuideServiceItem {
  id: string;
  name: string;
  description: string;
  cost: string;
  url: string;
  recommended: boolean;
}

export interface GuideGroup {
  id: string;
  name: string;
  description: string;
  items: GuideServiceItem[];
}

// 게시판
export interface Post {
  id: string;
  title: string;
  content: string;
  link?: string | null;
  views_count: number;
  likes_count: number;
  comments_count: number;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  post_id: string;
  content: string;
  likes_count: number;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

// 영상 좋아요/댓글 (DB)
export interface VideoStats {
  video_id: string;
  likes_count: number;
  comments_count: number;
  liked?: boolean;
}

export interface VideoComment {
  id: string;
  video_id: string;
  content: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}
