/**
 * 1Password Business, read with an Events API bearer token (Integrations > Events Reporting) that can read sign-in attempts.
 * Docs: www.1password.dev/events-api/reference
 */
import { call, need, result, listSome, plural, DAY } from '../http';
import type { ConnectorImpl } from '../types';

type Attempt = { category?: string; target_user?: { email?: string; name?: string } };
type Page = { items?: Attempt[]; cursor?: string; has_more?: boolean };

const HOSTS: Record<string, string> = { com: 'https://events.1password.com', eu: 'https://events.1password.eu', ca: 'https://events.1password.ca', ent: 'https://events.ent.1password.com' };

export const onepassword: ConnectorImpl = {
  async run(c, ctx) {
    const token = need(c, 'token', 'The Events API token');
    const base = HOSTS[(c.region ?? '').trim()] ?? HOSTS.com;
    const subject = '1Password';
    const headers = { Authorization: `Bearer ${token}` };

    const intro = await call<{ features?: string[]; account_uuid?: string }>(`${base}/api/v2/auth/introspect`, { headers });
    if (!(intro.features ?? []).includes('signinattempts')) {
      return { results: [result('onepassword.signin_monitoring', subject, 'fail', 'The token cannot read sign-in attempts. Create an Events Reporting token with sign-in attempts switched on.')], label: '1Password' };
    }

    const attempts: Attempt[] = [];
    let body: Record<string, unknown> = { limit: 1000, start_time: new Date(ctx.now.getTime() - 7 * DAY).toISOString() };
    for (let i = 0; i < 5; i++) {
      const j = await call<Page>(`${base}/api/v2/signinattempts`, { method: 'POST', headers, body });
      attempts.push(...(j.items ?? []));
      if (!j.has_more || !j.cursor) break;
      body = { cursor: j.cursor };
    }

    const counts = new Map<string, number>();
    for (const a of attempts) {
      if (a.category !== 'mfa_failed') continue;
      const who = a.target_user?.email || a.target_user?.name || 'unknown user';
      counts.set(who, (counts.get(who) ?? 0) + 1);
    }
    const repeated = [...counts.entries()].filter(([, n]) => n >= 3).map(([who, n]) => `${who} (${n})`);
    const res = repeated.length
      ? result('onepassword.signin_monitoring', subject, 'warn', `${plural(repeated.length, 'person', 'people')} failed the second sign-in step 3 or more times in the last 7 days: ${listSome(repeated)}.`, { users: repeated })
      : result('onepassword.signin_monitoring', subject, 'pass', `${plural(attempts.length, 'sign-in attempt')} in the last 7 days, no repeated second-factor failures.`);
    return { results: [res], label: '1Password' };
  },
};
