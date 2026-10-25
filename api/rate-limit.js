// Best-effort limiter. The counters live in this process only: they reset on a
// cold start and are not shared across instances. CDN caching is the main
// protection for /api/steam-profile. A Vercel Firewall rate-limit rule on
// /api/* (configured in the dashboard, not in vercel.json) is the real limit.

const buckets = new Map();

export const STEAM_PROFILE_LIMIT = 30;
export const STEAM_PROFILE_WINDOW_MS = 60_000;
export const CSP_LOG_LIMIT = 20;
export const CSP_LOG_WINDOW_MS = 60_000;

function readHeader(request, name) {
  const headers = request?.headers || {};
  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0] || '';
  }
  return typeof value === 'string' ? value : '';
}

export function clientIp(request) {
  const forwarded = readHeader(request, 'x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    if (first) {
      return first.slice(0, 64);
    }
  }

  const realIp = readHeader(request, 'x-real-ip').trim();
  if (realIp) {
    return realIp.slice(0, 64);
  }

  return 'unknown';
}

function pruneExpired(now) {
  if (buckets.size < 500) {
    return;
  }

  for (const [key, bucket] of buckets) {
    if (now - bucket.startedAt >= bucket.windowMs) {
      buckets.delete(key);
    }
  }
}

export function consumeRateLimit(key, limit, windowMs, now = Date.now()) {
  pruneExpired(now);
  const current = buckets.get(key);

  if (!current || now - current.startedAt >= windowMs) {
    buckets.set(key, { startedAt: now, count: 1, windowMs });
    return { allowed: true, retryAfter: 0 };
  }

  if (current.count >= limit) {
    const retryAfter = Math.max(1, Math.ceil((windowMs - (now - current.startedAt)) / 1000));
    return { allowed: false, retryAfter };
  }

  current.count += 1;
  return { allowed: true, retryAfter: 0 };
}

export function resetRateLimits() {
  buckets.clear();
}
