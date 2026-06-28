import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { jsonResponse } from './_json-response.js';
import { createIpRateLimiter } from './_ip-rate-limit.js';

let ratelimit = null;

// In-process fallback so the public feed proxy is NEVER unbounded when Upstash is
// unconfigured or Redis is down. Previously those cases returned null (= allow
// everything) — fail-OPEN. Now we fall back to a per-instance IP limiter with the
// same window, so abuse is bounded even without Redis. (Per-instance + memory-only,
// so it's a backstop, not as strong as the shared Upstash limiter.)
const fallbackLimiter = createIpRateLimiter({ limit: 600, windowMs: 60_000 });

function tooMany(corsHeaders) {
  return jsonResponse({ error: 'Too many requests' }, 429, {
    'X-RateLimit-Limit': '600',
    'X-RateLimit-Remaining': '0',
    'Retry-After': '60',
    ...corsHeaders,
  });
}

function getRatelimit() {
  if (ratelimit) return ratelimit;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  ratelimit = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(600, '60 s'),
    prefix: 'rl',
    analytics: false,
  });

  return ratelimit;
}

function getClientIp(request) {
  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '0.0.0.0'
  );
}

export async function checkRateLimit(request, corsHeaders) {
  const ip = getClientIp(request);
  const rl = getRatelimit();

  // No Upstash configured — fail CLOSED to the in-process limiter, not allow-all.
  if (!rl) {
    return fallbackLimiter.isRateLimited(ip) ? tooMany(corsHeaders) : null;
  }

  try {
    const { success, limit, reset } = await rl.limit(ip);

    if (!success) {
      return jsonResponse({ error: 'Too many requests' }, 429, {
        'X-RateLimit-Limit': String(limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(reset),
        'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)),
        ...corsHeaders,
      });
    }

    return null;
  } catch {
    // Redis error — fail CLOSED to the in-process limiter instead of allowing all.
    return fallbackLimiter.isRateLimited(ip) ? tooMany(corsHeaders) : null;
  }
}
