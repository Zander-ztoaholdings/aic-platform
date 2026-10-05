import Redis from 'ioredis';

/**
 * Rate limiting shared across instances and deploys.
 *
 * With REDIS_URL set (it is, in production: the same Redis the event bus
 * uses), counts live in Redis, so a redeploy no longer resets every limit to
 * zero and two instances cannot each allow the full quota. Without it — local
 * development, or Redis briefly unreachable — it falls back to an in-process
 * counter, which is the old behaviour, rather than failing open or closed.
 */

interface Entry { count: number; resetAt: number }
const memory = new Map<string, Entry>();
let redis: Redis | null | undefined;
let redisDownUntil = 0;

setInterval(() => {
  const now = Date.now();
  for (const [k, e] of memory) if (e.resetAt < now) memory.delete(k);
}, 5 * 60 * 1000).unref?.();

function client(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.REDIS_URL;
  redis = url ? new Redis(url, { maxRetriesPerRequest: 1, enableOfflineQueue: false, lazyConnect: false }) : null;
  redis?.on('error', () => { redisDownUntil = Date.now() + 30_000; });
  return redis;
}

function inMemory(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const e = memory.get(key);
  if (!e || e.resetAt < now) {
    memory.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }
  e.count++;
  return e.count > limit ? { allowed: false, remaining: 0 } : { allowed: true, remaining: limit - e.count };
}

/**
 * Count one request against `key` and say whether it is within `limit` per
 * `windowMs`. Fixed window: INCR, and set the expiry on the first hit.
 */
export async function checkRateLimit(key: string, limit: number, windowMs: number = 60_000): Promise<{ allowed: boolean; remaining: number }> {
  const r = client();
  if (r && Date.now() > redisDownUntil && r.status === 'ready') {
    try {
      const k = `rl:${key}`;
      const n = await r.incr(k);
      if (n === 1) await r.pexpire(k, windowMs);
      return n > limit ? { allowed: false, remaining: 0 } : { allowed: true, remaining: limit - n };
    } catch {
      redisDownUntil = Date.now() + 30_000;
    }
  }
  return inMemory(key, limit, windowMs);
}

/**
 * The client's IP. Traefik (Coolify's proxy) sets X-Real-Ip to the address it
 * received the connection from, and appends that address to X-Forwarded-For.
 * The first X-Forwarded-For entry is whatever the client chose to send, so it
 * is the last thing to trust: rate limits keyed on it could be dodged by
 * sending a different value each time.
 */
export function getClientIP(request: Request): string {
  const real = request.headers.get('x-real-ip');
  if (real) return real.trim();
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const parts = forwarded.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return '127.0.0.1';
}
