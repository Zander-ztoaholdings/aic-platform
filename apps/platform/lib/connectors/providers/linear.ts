/**
 * Linear GraphQL API, read with a personal API key (sent as-is) or an OAuth token (sent as Bearer).
 * Docs: https://linear.app/developers/graphql
 */
import { need, result, adminsCheck, listSome, plural, daysSince, providerMessage } from '../http';
import { ConnectorError, type ConnectorImpl, type Credentials } from '../types';
import type { CheckResult } from '../../integrations/catalog';
import type { Account } from '../../registers/accounts';

const API = 'https://api.linear.app/graphql';

type PageInfo = { hasNextPage: boolean; endCursor: string | null };
type LinearUser = { id: string; name?: string; displayName?: string; email?: string; admin?: boolean; owner?: boolean; guest?: boolean; active?: boolean; app?: boolean; lastSeen?: string | null; createdAt?: string };
type LinearIssue = { identifier: string; title?: string; priority?: number; createdAt: string };

const authHeader = (token: string) => (token.startsWith('lin_oauth') ? `Bearer ${token}` : token);

/** One GraphQL request. Linear reports errors with HTTP 200 and an `errors` array, and sometimes 400 for a bad key. */
async function gql<T>(token: string, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API, { method: 'POST', headers: { Authorization: authHeader(token), 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'AIC-Platform/1.0' }, body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(20_000) });
  } catch (e) {
    throw new ConnectorError(0, `Could not reach api.linear.app: ${(e as Error).message}`);
  }
  const text = await res.text();
  let body: { data?: T; errors?: { message?: string; extensions?: { code?: string; type?: string } }[] } = {};
  try { body = JSON.parse(text); } catch { /* not JSON; handled below */ }
  const err = body.errors?.[0];
  if (err || !res.ok) {
    const message = err?.message ?? providerMessage(text);
    const auth = res.status === 401 || /authenticat/i.test(`${message} ${err?.extensions?.code ?? ''} ${err?.extensions?.type ?? ''}`);
    throw new ConnectorError(auth ? 401 : res.ok ? 400 : res.status, `Linear answered: ${message}`);
  }
  return body.data as T;
}

// Unverified: `owner` and `app` on User are in Linear's current schema; if a workspace rejects them, the query is retried without.
const USER_FIELDS = 'id name displayName email admin guest active lastSeen createdAt';
async function listUsers(token: string): Promise<LinearUser[]> {
  const run = async (fields: string) => {
    const out: LinearUser[] = [];
    let after: string | null = null;
    for (let i = 0; i < 20; i++) {
      const d: { users: { nodes: LinearUser[]; pageInfo: PageInfo } } = await gql(token, `query($after: String) { users(first: 100, after: $after, includeDisabled: true) { nodes { ${fields} } pageInfo { hasNextPage endCursor } } }`, { after });
      out.push(...d.users.nodes);
      if (!d.users.pageInfo.hasNextPage) break;
      after = d.users.pageInfo.endCursor;
    }
    return out;
  };
  try { return await run(`${USER_FIELDS} owner app`); } catch (e) {
    if (e instanceof ConnectorError && e.status !== 401 && /cannot query field/i.test(e.message)) return run(USER_FIELDS);
    throw e;
  }
}

const nameOf = (u: LinearUser) => u.name || u.displayName || u.email || u.id;
const setup = (c: Credentials) => need(c, 'token', 'The API key');

export const linear: ConnectorImpl = {
  async run(c, ctx) {
    const token = setup(c);
    const label = (c.label ?? '').trim() || 'security';
    const n = Number.parseInt((c.slaDays ?? '').trim(), 10);
    const sla = Number.isFinite(n) && n > 0 ? n : 30;

    // First call: a bad key stops the run here.
    const users = (await listUsers(token)).filter((u) => !u.app);
    let org: { name?: string; samlEnabled?: boolean | null } | null = null;
    let orgError: string | null = null;
    try { org = (await gql<{ organization: { name?: string; samlEnabled?: boolean | null } }>(token, 'query { organization { name samlEnabled } }')).organization; } catch (e) {
      if (e instanceof ConnectorError && e.status === 401) throw e;
      orgError = (e as Error).message;
    }
    const subject = org?.name ?? 'Linear workspace';
    const results: CheckResult[] = [];

    results.push(adminsCheck('linear.admins_limited', subject, users.filter((u) => u.active !== false && (u.admin || u.owner)).map(nameOf), 'admins'));

    if (orgError) results.push(result('linear.sso_enforced', subject, 'unknown', `Could not read the workspace settings: ${orgError}`));
    else if (org?.samlEnabled === true) results.push(result('linear.sso_enforced', subject, 'pass', 'SAML single sign-on is on, so people sign in through your identity provider.'));
    else if (org?.samlEnabled === false) results.push(result('linear.sso_enforced', subject, 'fail', 'SAML single sign-on is off, so removing someone from your identity provider does not remove them from Linear. It needs the Enterprise plan.'));
    else results.push(result('linear.sso_enforced', subject, 'unknown', 'Linear did not say whether single sign-on is on.'));

    // Unverified: the label filter shape `labels: { name: { eqIgnoreCase } }`; Linear also documents `labels: { some: { name: ... } }`.
    try {
      const open: LinearIssue[] = [];
      let after: string | null = null;
      for (let i = 0; i < 10; i++) {
        const d: { issues: { nodes: LinearIssue[]; pageInfo: PageInfo } } = await gql(token,
          'query($label: String!, $after: String) { issues(first: 100, after: $after, filter: { labels: { name: { eqIgnoreCase: $label } }, state: { type: { nin: ["completed", "canceled"] } } }) { nodes { identifier title priority createdAt } pageInfo { hasNextPage endCursor } } }',
          { label, after });
        open.push(...d.issues.nodes);
        if (!d.issues.pageInfo.hasNextPage) break;
        after = d.issues.pageInfo.endCursor;
      }
      const late = open.filter((x) => (x.priority === 1 || x.priority === 2) && (daysSince(x.createdAt, ctx.now) ?? 0) > sla);
      results.push(late.length
        ? result('linear.security_issue_sla', subject, 'fail', `${plural(late.length, 'urgent or high security issue')} open for more than ${sla} days: ${listSome(late.map((x) => x.identifier))}.`, { late: late.map((x) => ({ id: x.identifier, title: x.title, priority: x.priority, createdAt: x.createdAt })) })
        : result('linear.security_issue_sla', subject, 'pass', open.length
          ? `${plural(open.length, 'open issue')} labelled "${label}", none of them urgent or high and older than ${sla} days.`
          : `No open issues labelled "${label}".`, { open: open.length }));
    } catch (e) {
      if (e instanceof ConnectorError && e.status === 401) throw e;
      results.push(result('linear.security_issue_sla', subject, 'unknown', `Could not read security issues: ${(e as Error).message}`));
    }

    return { results, label: subject };
  },

  async accounts(c) {
    const users = await listUsers(setup(c));
    return users.filter((u) => !u.app).map((u): Account => ({
      system: 'Linear', account: u.email || nameOf(u), displayName: u.name || u.displayName || null,
      privilege: u.owner ? 'Owner' : u.admin ? 'Admin' : u.guest ? 'Guest' : 'Member',
      lastActiveAt: u.lastSeen ?? null, enabled: u.active !== false,
    }));
  },
};
