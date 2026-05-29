// 레이트리밋 헬퍼.
// Upstash 환경변수가 있으면 그것을 사용, 없으면 in-memory fallback
// (Vercel serverless에서는 인스턴스가 바뀌므로 완벽하지 않음 — 그래도 0보다 낫다)

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const HAS_UPSTASH =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

const upstashRedis = HAS_UPSTASH
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

const upstashLimiters = new Map<string, Ratelimit>();
function getUpstashLimiter(key: string, limit: number, window: `${number} ${'s'|'m'|'h'|'d'}`) {
  const cacheKey = `${key}:${limit}:${window}`;
  let l = upstashLimiters.get(cacheKey);
  if (!l) {
    l = new Ratelimit({
      redis: upstashRedis!,
      limiter: Ratelimit.slidingWindow(limit, window),
      analytics: false,
      prefix: `axtf:${key}`,
    });
    upstashLimiters.set(cacheKey, l);
  }
  return l;
}

// In-memory fallback (sliding-window 근사) — 인스턴스 단위.
const memoryStore = new Map<string, { count: number; resetAt: number }>();
function memoryLimit(key: string, limit: number, windowMs: number): { success: boolean; remaining: number } {
  const now = Date.now();
  const entry = memoryStore.get(key);
  if (!entry || entry.resetAt < now) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1 };
  }
  if (entry.count >= limit) return { success: false, remaining: 0 };
  entry.count++;
  return { success: true, remaining: limit - entry.count };
}

const windowToMs = (w: string): number => {
  const m = w.match(/^(\d+)\s*([smhd])$/);
  if (!m) return 60_000;
  const n = parseInt(m[1], 10);
  const u = m[2];
  return n * (u === 's' ? 1000 : u === 'm' ? 60_000 : u === 'h' ? 3_600_000 : 86_400_000);
};

export interface RateLimitResult {
  success: boolean;
  remaining: number;
}

/** 키 기준 레이트리밋 검사. success=false면 429를 던지면 됨. */
export async function checkRateLimit(
  bucket: string,
  identifier: string,
  limit: number,
  window: `${number} ${'s'|'m'|'h'|'d'}`,
): Promise<RateLimitResult> {
  const key = `${bucket}:${identifier}`;
  if (upstashRedis) {
    const l = getUpstashLimiter(bucket, limit, window);
    const r = await l.limit(key);
    return { success: r.success, remaining: r.remaining };
  }
  return memoryLimit(key, limit, windowToMs(window));
}

/** 요청에서 IP 추출 (Vercel은 x-forwarded-for 사용) */
export function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const real = req.headers.get('x-real-ip');
  return real || 'unknown';
}

/** 429 응답 헬퍼 */
export function tooManyRequests(message = '요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.') {
  return Response.json({ error: message }, { status: 429 });
}
