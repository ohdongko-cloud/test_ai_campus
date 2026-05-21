export interface VideoStage {
  id: string;
  title: string;
  description: string;
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
  org: string;
  role: string;
  email: string;
}

export interface ClickLog {
  button: string;
  timestamp: string;
}

export type TabType = 'home' | 'videos' | 'meeting' | 'board' | 'share' | 'guide';
export type ReservationStatus = 'pending' | 'confirmed' | 'cancelled';
export type AdminTabType = 'stats' | 'videos' | 'meetings' | 'chatroom' | 'services' | 'board' | 'guide';

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
