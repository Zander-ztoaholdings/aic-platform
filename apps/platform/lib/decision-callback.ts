import { lookup } from 'dns/promises';
import { orgCallbackSecret, signCallback, isPrivateAddress } from '@/lib/decision-review';

/**
 * Tell the system that sent a held decision what the person decided.
 * Signed with the organisation's callback secret (X-AIC-Signature over
 * "<timestamp>.<body>"), so the receiver can prove it came from AIC.
 * One attempt with a 5-second limit; the result is recorded, and the system
 * can always poll GET /api/decisions/<id> instead.
 */
export async function sendDecisionCallback(orgId: string, url: string, payload: unknown): Promise<string> {
  try {
    const u = new URL(url);
    if (process.env.CALLBACK_ALLOW_PRIVATE !== '1') {
      const addrs = await lookup(u.hostname, { all: true });
      if (addrs.some((a) => isPrivateAddress(a.address))) return 'refused: resolves to a private address';
    }
    const body = JSON.stringify(payload);
    const ts = Math.floor(Date.now() / 1000);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'AIC-Decision-Review/1',
        'X-AIC-Timestamp': String(ts),
        'X-AIC-Signature': signCallback(orgCallbackSecret(orgId), body, ts),
      },
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(5000),
    });
    return `delivered ${res.status}`.slice(0, 40);
  } catch (e) {
    return `failed: ${(e as Error).message}`.slice(0, 40);
  }
}
