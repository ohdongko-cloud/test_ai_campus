export interface Video {
  id: string;
  title: string;
  level: '기초' | '중급' | '고급' | '응용';
  description: string;
  youtubeUrl: string;
  viewCount: number;
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
  date: string;
  startTime: string;
  reason?: string;
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
