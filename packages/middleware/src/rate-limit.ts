import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  lazyConnect: true,
});

/**
 * REDIS-BACKED DISTRIBUTED RATE LIMITER
 * 
 * Implements a sliding window rate limit to prevent brute force 
 * and DoS across multiple platform instances.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number = 60_000
): Promise<{ allowed: boolean; remaining: number }> {
  const now = Date.now();
  const windowStart = now - windowMs;

  const multi = redis.multi();
  
  // 1. Remove expired timestamps
  multi.zremrangebyscore(key, 0, windowStart);
  
  // 2. Add current timestamp
  multi.zadd(key, now, now.toString());
  
  // 3. Count requests in current window
  multi.zcard(key);
  
  // 4. Set expiry on the key
  multi.expire(key, Math.ceil(windowMs / 1000) + 1);

  const results = await multi.exec();
  
  if (!results) return { allowed: false, remaining: 0 };

  const count = results[2][1] as number;
  const allowed = count <= limit;
  const remaining = Math.max(0, limit - count);

  return { allowed, remaining };
}
