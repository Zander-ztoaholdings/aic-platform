/**
 * Jira Cloud, read with an Atlassian API token for a browse-only account (Basic auth, email and token).
 * Docs: https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-search/
 */
import { call, basic, baseUrl, need, result, listSome, plural, daysSince } from '../http';
import { ConnectorError, type ConnectorImpl, type Credentials } from '../types';
import type { Account } from '../../registers/accounts';

type Issue = { key: string; fields: { summary?: string; created?: string; priority?: { name?: string } | null } };
type SearchPage = { issues?: Issue[]; nextPageToken?: string | null; isLast?: boolean };
type JiraUser = { accountId: string; accountType?: string; displayName?: string; emailAddress?: string; active?: boolean };

const HIGH = new Set(['highest', 'high']);

function setup(c: Credentials) {
  const site = need(c, 'site', 'The Jira site').replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
  return {
    base: baseUrl(site.includes('.') ? site : `${site}.atlassian.net`),
    auth: basic(need(c, 'email', 'The account email'), need(c, 'token', 'The API token')),
  };
}

const positive = (v: string | undefined, fallback: number) => {
  const n = Number.parseInt((v ?? '').trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const jira: ConnectorImpl = {
  async run(c, ctx) {
    const { base, auth } = setup(c);
    const subject = new URL(base).host;
    const label = (c.label ?? '').trim() || 'security';
    const sla = positive(c.slaDays, 30);
    const jql = `labels = "${label.replace(/["\\]/g, '\\$&')}" AND statusCategory != Done ORDER BY created ASC`;

    let issues: Issue[] = [];
    try {
      let token: string | null | undefined;
      for (let i = 0; i < 10; i++) {
        const q = new URLSearchParams({ jql, fields: 'summary,created,priority,status', maxResults: '100' });
        if (token) q.set('nextPageToken', token);
        const page = await call<SearchPage>(`${base}/rest/api/3/search/jql?${q}`, { headers: { Authorization: auth } });
        issues.push(...(page.issues ?? []));
        token = page.nextPageToken;
        if (!token || page.isLast) break;
      }
    } catch (e) {
      // The search is the first call: a bad token or email stops the run here.
      if (e instanceof ConnectorError && e.status === 401) throw e;
      return { results: [result('jira.security_tickets_sla', subject, 'unknown', `Could not search for security tickets: ${(e as Error).message}`)], label: subject };
    }

    issues = issues.filter((i) => i.fields);
    const late = issues.filter((i) => HIGH.has((i.fields.priority?.name ?? '').toLowerCase()) && (daysSince(i.fields.created, ctx.now) ?? 0) > sla);
    const results = [late.length
      ? result('jira.security_tickets_sla', subject, 'fail', `${plural(late.length, 'high-priority security ticket')} open for more than ${sla} days: ${listSome(late.map((i) => i.key))}.`, { late: late.map((i) => ({ key: i.key, summary: i.fields.summary, created: i.fields.created, priority: i.fields.priority?.name })) })
      : result('jira.security_tickets_sla', subject, 'pass', issues.length
        ? `${plural(issues.length, 'open ticket')} labelled "${label}", none of them high priority and older than ${sla} days.`
        : `No open tickets labelled "${label}".`, { open: issues.length })];
    return { results, label: subject };
  },

  async accounts(c) {
    const { base, auth } = setup(c);
    const users: JiraUser[] = [];
    for (let i = 0, startAt = 0; i < 5; i++) {
      const page = await call<JiraUser[]>(`${base}/rest/api/3/users/search?maxResults=1000&startAt=${startAt}`, { headers: { Authorization: auth } });
      if (!Array.isArray(page) || !page.length) break;
      users.push(...page);
      startAt += page.length;
    }
    // Only real people: apps and customer (service desk) accounts are left out. Emails are often hidden by profile visibility.
    return users.filter((u) => u.accountType === 'atlassian').map((u): Account => ({
      system: 'Jira', account: u.emailAddress || u.displayName || u.accountId, displayName: u.displayName ?? null,
      privilege: null, lastActiveAt: null, enabled: u.active !== false,
    }));
  },
};
