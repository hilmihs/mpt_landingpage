import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

let _redis: Redis | null = null;
const _ratelimits: Record<string, Ratelimit> = {};

export function redis(): Redis {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error("Missing UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN");
  }
  _redis = new Redis({ url, token });
  return _redis;
}

function getOrCreateLimiter(
  key: string,
  limit: number,
  windowSec: number,
): Ratelimit {
  if (_ratelimits[key]) return _ratelimits[key]!;
  _ratelimits[key] = new Ratelimit({
    redis: redis(),
    limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
    analytics: true,
    prefix: `rl:${key}`,
  });
  return _ratelimits[key]!;
}

/** Sliding window: 5 submit/menit per IP. */
export function submitRatelimit(): Ratelimit {
  return getOrCreateLimiter("submit", 5, 60);
}

/** 20 interest gate responses per 10 menit per IP (covers gate1/2/3). */
export function interestRatelimit(): Ratelimit {
  return getOrCreateLimiter("interest", 20, 600);
}

/** 5 tahsin enrollment attempts per 10 menit per IP. */
export function enrollRatelimit(): Ratelimit {
  return getOrCreateLimiter("enroll", 5, 600);
}

/** 10 HITS click-through per 5 menit per IP. */
export function hitsClickRatelimit(): Ratelimit {
  return getOrCreateLimiter("hits", 10, 300);
}

/**
 * Extract the client IP from a Next.js request, accounting for Vercel's
 * x-forwarded-for chain.
 */
export function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}
