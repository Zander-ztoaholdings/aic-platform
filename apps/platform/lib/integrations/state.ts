import { createHmac, timingSafeEqual } from 'crypto';

/**
 * The `state` AIC sends to GitHub with an install link and expects back on
 * the callback. It binds the installation to the organisation and person who
 * started it, and expires, so a callback URL cannot be replayed to attach
 * someone else's GitHub to an organisation.
 */

const secret = () => {
  const s = process.env.INTEGRATIONS_STATE_SECRET || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error('INTEGRATIONS_STATE_SECRET (or AUTH_SECRET) must be set.');
  return s;
};

const TTL_MS = 30 * 60 * 1000;

export function signState(orgId: string, userId: string, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ o: orgId, u: userId, e: now + TTL_MS })).toString('base64url');
  const mac = createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${mac}`;
}

export function verifyState(state: string | null, now = Date.now()): { orgId: string; userId: string } | null {
  if (!state) return null;
  const [body, mac] = state.split('.');
  if (!body || !mac) return null;
  const expected = createHmac('sha256', secret()).update(body).digest('base64url');
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString()) as { o: string; u: string; e: number };
    if (!p.o || !p.u || p.e < now) return null;
    return { orgId: p.o, userId: p.u };
  } catch {
    return null;
  }
}
