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

function getPubClient() {
  if (!pubClient) {
    pubClient = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: null,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });
    pubClient.on('error', (err) => {
      if (err.message.includes('ECONNREFUSED')) {
        console.warn('[REDIS] Publisher offline. Real-time events will be queued or skipped.');
      } else {
        console.error('[REDIS] Publisher error:', err.message);
      }
    });
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
    subClient.on('error', (err) => {
      if (!err.message.includes('ECONNREFUSED')) {
        console.error('[REDIS] Subscriber error:', err.message);
      }
    });
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
