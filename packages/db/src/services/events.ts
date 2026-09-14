import Redis from 'ioredis';
import * as dotenv from 'dotenv';
import path from 'path';
import { Pool } from 'pg';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379/0';
const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

let pubClient: Redis | null = null;
let subClient: Redis | null = null;
let pgPool: Pool | null = null;

/**
 * Redis being unreachable is a condition, not an event, and it was being
 * logged as an event.
 *
 * Observed in production 14 Sep: REDIS_URL pointed at a host that no longer
 * resolved, so every reconnect attempt failed with EAI_AGAIN. The handler
 * below silenced ECONNREFUSED and logged everything else, and ioredis retries
 * forever at a two-second cap — so the platform emitted the same line every
 * two seconds indefinitely. It buried an unrelated 500 nobody could then find
 * in the logs, which is the real cost: a log that always says something is a
 * log nobody reads.
 *
 * Now the first failure is logged, and after that at most one line every five
 * minutes, with the count of what was suppressed. A recovery logs once so the
 * silence afterwards is not mistaken for the outage continuing.
 */
const QUIET_MS = 5 * 60 * 1000;

/** Both mean the same thing operationally: Redis is not there. */
const isUnreachable = (m: string) =>
  m.includes('ECONNREFUSED') ||
  m.includes('EAI_AGAIN') ||
  m.includes('ENOTFOUND') ||
  m.includes('ETIMEDOUT');

function throttledLogger(label: string) {
  let lastLoggedAt = 0;
  let suppressed = 0;
  let wasDown = false;

  return {
    fail(message: string) {
      const now = Date.now();
      if (now - lastLoggedAt < QUIET_MS) {
        suppressed += 1;
        return;
      }
      const tail = suppressed > 0 ? ` (${suppressed} identical since last report)` : '';
      lastLoggedAt = now;
      suppressed = 0;
      wasDown = true;
      if (isUnreachable(message)) {
        console.warn(`[REDIS] ${label} cannot reach Redis: ${message}.${tail} Real-time events are skipped while this lasts.`);
      } else {
        console.error(`[REDIS] ${label} error: ${message}${tail}`);
      }
    },
    recovered() {
      if (!wasDown) return;
      wasDown = false;
      suppressed = 0;
      lastLoggedAt = 0;
      console.warn(`[REDIS] ${label} reconnected.`);
    },
  };
}

const pubLog = throttledLogger('Publisher');
const subLog = throttledLogger('Subscriber');

function getPubClient() {
  if (!pubClient) {
    pubClient = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: null,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });
    pubClient.on('error', (err) => pubLog.fail(err.message));
    pubClient.on('ready', () => pubLog.recovered());
  }
  return pubClient;
}

function getSubClient() {
  if (!subClient) {
    subClient = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: null,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });
    subClient.on('error', (err) => subLog.fail(err.message));
    subClient.on('ready', () => subLog.recovered());
  }
  return subClient;
}

function getPgPool() {
  if (!pgPool) {
    pgPool = new Pool({ connectionString: dbUrl });
  }
  return pgPool;
}

/**
 * INSTITUTIONAL EVENT BUS SERVICE
 * 
 * Handles real-time cross-service communication using Redis Pub/Sub
 * and Postgres LISTEN/NOTIFY for database integrity events.
 */
export class EventBusService {
  /**
   * Publish an event to a specific tenant's channel (Redis)
   */
  static async publish(orgId: string, eventType: string, payload: Record<string, unknown>) {
    try {
      const client = getPubClient();
      const channel = `tenant:${orgId}:events`;
      const message = JSON.stringify({
        type: eventType,
        orgId,
        payload,
        timestamp: new Date().toISOString(),
      });
      
      await client.publish(channel, message);
    } catch {
      console.warn('[EVENT_BUS] Failed to publish event (Redis likely offline)');
    }
  }

  /**
   * Subscribe to a tenant's event stream (Redis)
   */
  static subscribe(orgId: string, onMessage: (data: string) => void) {
    const channel = `tenant:${orgId}:events`;
    const client = getSubClient();
    
    client.subscribe(channel);

    const handler = (chan: string, message: string) => {
      if (chan === channel) {
        onMessage(message);
      }
    };

    client.on('message', handler);

    return () => {
      client.removeListener('message', handler);
      client.unsubscribe(channel).catch(() => {});
    };
  }

  /**
   * Listen for Postgres Database Integrity Events (S1-03)
   */
  static async listenToPostgres(onEvent: (channel: string, payload: Record<string, unknown>) => void) {
    try {
      const pool = getPgPool();
      const client = await pool.connect();
      
      client.on('notification', (msg) => {
        if (msg.payload) {
          try {
            const payload = JSON.parse(msg.payload);
            onEvent(msg.channel, payload);
          } catch (e) {
            console.error('[POSTGRES_EVENT] Failed to parse notification payload', e);
          }
        }
      });

      await client.query('LISTEN audit_log_updates');
      await client.query('LISTEN incident_updates');
      
      console.log('[POSTGRES_EVENT] Listening for integrity events...');
      
      return () => {
        client.query('UNLISTEN audit_log_updates').catch(() => {});
        client.query('UNLISTEN incident_updates').catch(() => {});
        client.release();
      };
    } catch (err) {
      console.error('[POSTGRES_EVENT] Connection failed', err);
      throw err;
    }
  }
}
