import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

let _redis: Redis | null = null;
let _ratelimit: Ratelimit | null = null;

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

/** Sliding window: 5 submit/menit per IP. */
export function submitRatelimit(): Ratelimit {
  if (_ratelimit) return _ratelimit;
  _ratelimit = new Ratelimit({
    redis: redis(),
    limiter: Ratelimit.slidingWindow(5, "60 s"),
    analytics: true,
    prefix: "rl:submit",
  });
  return _ratelimit;
}
