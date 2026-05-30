import Redis from 'ioredis';
import { getSystemDb, revokedTokens, eq } from '@aic/db';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379/0';

let redis: Redis | null = null;
let isRedisAvailable = true;

function getRedis() {
    if (!redis && isRedisAvailable) {
        try {
            redis = new Redis(redisUrl, {
                lazyConnect: true,
                maxRetriesPerRequest: 1,
                connectTimeout: 2000,
                retryStrategy: (times) => {
                    if (times > 3) {
                        isRedisAvailable = false;
                        return null;
                    }
                    return Math.min(times * 100, 2000);
                }
            });
            redis.on('error', () => { isRedisAvailable = false; });
            redis.on('connect', () => { isRedisAvailable = true; });
        } catch {
            isRedisAvailable = false;
        }
    }
    return redis as Redis;
}

/**
 * INSTITUTIONAL TOKEN REVOCATION SERVICE
 * 
 * Implements a high-performance Token Revocation List (TRL) using Redis
 * with a durable PostgreSQL fallback for maximum security.
 */
export class RevocationService {
    /**
     * Revoke a token by adding its JTI to the TRL and Database
     */
    static async revoke(jti: string, expiresAt: number) {
        if (!jti) return;
        
        // 1. Permanent DB Record
        try {
            const db = getSystemDb();
            await db.insert(revokedTokens).values({
                jti,
                expiresAt: new Date(expiresAt * 1000)
            }).onConflictDoNothing();
        } catch (dbErr) {
            console.error('[AUTH] DB Revocation failed:', dbErr);
        }

        // 2. High-speed Cache (Redis)
        try {
            const client = getRedis();
            const now = Math.floor(Date.now() / 1000);
            const ttl = expiresAt - now;
            
            if (ttl > 0 && isRedisAvailable) {
                await client.set(`trl:${jti}`, 'revoked', 'EX', ttl);
                console.log(`[AUTH] Token revoked in cache: ${jti} (TTL: ${ttl}s)`);
            }
        } catch (err) {
            console.error('[AUTH] Cache Revocation failed:', err);
        }
    }

    /**
     * Check if a token JTI is in the TRL (Cache or DB)
     */
    static async isRevoked(jti: string): Promise<boolean> {
        if (!jti) return false;

        // 1. Fast Cache Check
        if (isRedisAvailable) {
            try {
                const client = getRedis();
                const exists = await client.exists(`trl:${jti}`);
                if (exists === 1) return true;
            } catch {
                isRedisAvailable = false;
            }
        }

        // 2. Durable DB Check (Fallback)
        try {
            const db = getSystemDb();
            const [revoked] = await db
                .select()
                .from(revokedTokens)
                .where(eq(revokedTokens.jti, jti))
                .limit(1);
            return !!revoked;
        } catch {
            return false;
        }
    }
}
