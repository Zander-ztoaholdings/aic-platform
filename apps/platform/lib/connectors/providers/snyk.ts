/**
 * Snyk REST API, read with a service account token (Org Viewer) sent as `Authorization: token <token>`.
 * Docs: https://docs.snyk.io/snyk-api/reference/issues
 */
import { call, need, result, listSome, plural } from '../http';
import { ConnectorError, type ConnectorImpl, type Credentials } from '../types';
import type { CheckResult } from '../../integrations/catalog';

const VERSION = '2024-10-15';
const HOSTS: Record<string, string> = { us: 'https://api.snyk.io/rest', eu: 'https://api.eu.snyk.io/rest', au: 'https://api.au.snyk.io/rest' };

type Doc<T> = { data?: T; links?: { next?: string | null } };
type Issue = { id: string; attributes?: { title?: string; status?: string; effective_severity_level?: string; ignored?: boolean; created_at?: string } };
type Project = { id: string; attributes?: { name?: string; status?: string } };
type Org = { id: string; attributes?: { name?: string } };

const setup = (c: Credentials) => ({
  base: HOSTS[(c.region ?? '').trim().toLowerCase()] ?? HOSTS.us,
  org: encodeURIComponent(need(c, 'orgId', 'The organisation id')),
  token: need(c, 'token', 'The service account token'),
});

/**
 * Follows JSON:API `links.next` up to `max` pages.
 * Unverified: Snyk documents `links.next` as relative; confirm against a live account whether it starts with /rest or with /orgs.
 */
async function pages<T>(base: string, first: string, token: string, max = 20): Promise<T[]> {
  const origin = new URL(base).origin;
  const out: T[] = [];
  let next: string | null | undefined = `${base}${first}`;
  for (let i = 0; next && i < max; i++) {
    const doc: Doc<T[]> = await call<Doc<T[]>>(next, { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.api+json' } });
    out.push(...(doc.data ?? []));
    const link: string | null | undefined = doc.links?.next;
    next = !link ? null : /^https?:\/\//.test(link) ? link : link.startsWith('/rest/') ? `${origin}${link}` : `${base}${link.startsWith('/') ? '' : '/'}${link}`;
  }
  return out;
}

export const snyk: ConnectorImpl = {
  async run(c) {
    const { base, org, token } = setup(c);
    const subject = decodeURIComponent(org);

    // First call: a bad token or wrong organisation id stops the run here.
    const o = await call<Doc<Org>>(`${base}/orgs/${org}?version=${VERSION}`, { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.api+json' } });
    const label = o.data?.attributes?.name || subject;
    const results: CheckResult[] = [];

    try {
      const issues = (await pages<Issue>(base, `/orgs/${org}/issues?version=${VERSION}&status=open&effective_severity_level=critical&ignored=false&limit=100`, token))
        .filter((i) => (i.attributes?.status ?? 'open') === 'open' && !i.attributes?.ignored && (i.attributes?.effective_severity_level ?? 'critical') === 'critical');
      const titles = [...new Set(issues.map((i) => i.attributes?.title || i.id))];
      results.push(issues.length
        ? result('snyk.no_open_critical', subject, 'fail', `${plural(issues.length, 'open critical vulnerability', 'open critical vulnerabilities')}, including ${listSome(titles)}.`, { count: issues.length, titles: titles.slice(0, 50) })
        : result('snyk.no_open_critical', subject, 'pass', 'Snyk shows no open critical vulnerabilities that have not been ignored.'));
    } catch (e) {
      if (e instanceof ConnectorError && e.status === 401) throw e;
      results.push(result('snyk.no_open_critical', subject, 'unknown', `Could not read issues: ${(e as Error).message}`));
    }

    // Projects Snyk has stopped monitoring. Cross-checking against the code host's repositories happens elsewhere, if at all.
    try {
      const projects = await pages<Project>(base, `/orgs/${org}/projects?version=${VERSION}&limit=100`, token);
      const inactive = projects.filter((p) => p.attributes?.status === 'inactive').map((p) => p.attributes?.name || p.id);
      if (!projects.length) results.push(result('snyk.projects_monitored', subject, 'unknown', 'Snyk has no projects in this organisation, so AIC cannot tell what it should be monitoring.'));
      else if (inactive.length) results.push(result('snyk.projects_monitored', subject, 'fail', `${plural(inactive.length, 'project')} no longer monitored: ${listSome(inactive)}.`, { inactive }));
      else results.push(result('snyk.projects_monitored', subject, 'pass', `All ${plural(projects.length, 'project')} in Snyk are being monitored.`));
    } catch (e) {
      if (e instanceof ConnectorError && e.status === 401) throw e;
      results.push(result('snyk.projects_monitored', subject, 'unknown', `Could not read projects: ${(e as Error).message}`));
    }

    return { results, label };
  },
};
