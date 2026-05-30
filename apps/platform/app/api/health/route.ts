import { NextResponse } from 'next/server';
import { getSystemDb, sql } from '@aic/db';

const ENGINE_URL = process.env.ENGINE_URL || 'http://localhost:8000';
const ENGINE_API_KEY = process.env.ENGINE_API_KEY || '';

interface ServiceCheck {
  status: 'ok' | 'error';
  latency_ms: number;
  detail?: string;
}

export async function GET() {
  const checks: Record<string, ServiceCheck> = {};

  // 1. Database check (Task M50: Institutional Health)
  const dbStart = Date.now();
  try {
    const db = getSystemDb();
    await db.execute(sql`SELECT 1`);
    checks.database = { status: 'ok', latency_ms: Date.now() - dbStart };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    checks.database = { status: 'error', latency_ms: Date.now() - dbStart, detail: message };
  }

  // 2. Engine check
  const engineStart = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${ENGINE_URL}/`, {
      signal: controller.signal,
      headers: ENGINE_API_KEY ? { 'X-API-Key': ENGINE_API_KEY } : {},
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      checks.engine = {
        status: 'ok',
        latency_ms: Date.now() - engineStart,
        detail: data.status || 'Operational',
      };
    } else {
      checks.engine = { status: 'error', latency_ms: Date.now() - engineStart, detail: `HTTP ${res.status}` };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    checks.engine = {
      status: 'error',
      latency_ms: Date.now() - engineStart,
      detail: isTimeout ? 'Timeout (5s)' : message,
    };
  }

  const allOk = Object.values(checks).every(c => c.status === 'ok');

  return NextResponse.json({
    status: allOk ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  }, { status: allOk ? 200 : 503 });
}
