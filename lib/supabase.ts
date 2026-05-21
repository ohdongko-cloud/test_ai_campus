import { createClient } from '@supabase/supabase-js';

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL  || '';
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// 브라우저 클라이언트 (환경변수 없으면 null)
export const supabase = url && anon ? createClient(url, anon) : null;

// 서버 전용 (API Route에서만 사용 — service role key)
export function createServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !serviceKey) throw new Error('Supabase 환경변수가 설정되지 않았습니다. .env.local을 확인하세요.');
  return createClient(url, serviceKey);
}
