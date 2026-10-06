/**
 * Bitbucket Cloud, read with an Atlassian API token (Basic auth, account email and token).
 * Docs: https://developer.atlassian.com/cloud/bitbucket/rest/api-group-branch-restrictions/
 */
import { call, basic, need, result, adminsCheck, listSome, plural } from '../http';
import { ConnectorError, type ConnectorImpl, type Credentials } from '../types';
import type { CheckResult } from '../../integrations/catalog';
import type { Account } from '../../registers/accounts';

const API = 'https://api.bitbucket.org/2.0';

type Page<T> = { values?: T[]; next?: string };
type Repo = { slug: string; full_name: string; mainbranch?: { name?: string } | null };
type Restriction = { kind: string; branch_match_kind?: string; pattern?: string; branch_type?: string; value?: number | null };
type Permission = { permission: string; user?: { display_name?: string; nickname?: string; account_id?: string } };

const setup = (c: Credentials) => ({
  workspace: need(c, 'workspace', 'The workspace id').toLowerCase(),
  auth: basic(need(c, 'email', 'The Atlassian account email'), need(c, 'token', 'The API token')),
});

/** Bitbucket pages carry a full `next` URL; follows it up to `max` pages. */
async function pages<T>(url: string, auth: string, max = 10): Promise<T[]> {
  const out: T[] = [];
  let next: string | undefined = url;
  for (let i = 0; next && i < max; i++) {
    const p: Page<T> = await call<Page<T>>(next, { headers: { Authorization: auth } });
    out.push(...(p.values ?? []));
    next = p.next;
  }
  return out;
}

/** Bitbucket glob patterns: `*` matches anything. */
const globMatch = (pattern: string, name: string) =>
  new RegExp(`^${pattern.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`).test(name);

/** Whether a restriction applies to the main branch. A branching-model rule for production or development is taken to cover it. */
function applies(r: Restriction, main: string): boolean {
  if (r.branch_match_kind === 'branching_model') return r.branch_type === 'production' || r.branch_type === 'development';
  return globMatch(r.pattern ?? '', main);
}

const userName = (p: Permission) => p.user?.display_name || p.user?.nickname || p.user?.account_id || 'unknown user';

// Unverified: GET /workspaces/{workspace}/permissions is documented but Atlassian has been moving workspace membership endpoints; confirm it still returns `permission` per user.
const PRIVILEGE: Record<string, string> = { owner: 'Owner', collaborator: 'Collaborator', member: 'Member' };

export const bitbucket: ConnectorImpl = {
  async run(c) {
    const { workspace, auth } = setup(c);
    const ws = encodeURIComponent(workspace);
    const results: CheckResult[] = [];

    // First call: a bad token or wrong workspace stops the run here.
    const repos = (await pages<Repo>(`${API}/repositories/${ws}?pagelen=100`, auth)).filter((r) => r.mainbranch?.name);

    // Branch restrictions on each repository's main branch, capped at 50.
    const checked = repos.slice(0, 50);
    const weak: string[] = [];
    const unreadable: string[] = [];
    for (const r of checked) {
      let rules: Restriction[];
      try { rules = await pages<Restriction>(`${API}/repositories/${ws}/${encodeURIComponent(r.slug)}/branch-restrictions?pagelen=100`, auth, 5); } catch (e) {
        if (e instanceof ConnectorError && e.status === 401) throw e;
        unreadable.push(r.full_name);
        continue;
      }
      const main = r.mainbranch!.name!;
      const mine = rules.filter((x) => applies(x, main));
      const noForce = mine.some((x) => x.kind === 'force');
      const approvals = mine.some((x) => x.kind === 'require_approvals_to_merge' && (x.value ?? 0) >= 1);
      if (!noForce || !approvals) weak.push(`${r.full_name} (${[!noForce && 'history can be rewritten', !approvals && 'no approval needed'].filter(Boolean).join(', ')})`);
    }
    const read = checked.length - unreadable.length;
    const capped = repos.length > checked.length ? ` (the first ${checked.length} of ${repos.length})` : '';
    if (weak.length) results.push(result('bitbucket.branch_protection', workspace, 'fail', `${plural(weak.length, 'repository', 'repositories')} with a weak main branch: ${listSome(weak)}.`, { repositories: weak, unreadable }));
    else if (!repos.length) results.push(result('bitbucket.branch_protection', workspace, 'unknown', 'AIC found no repositories with a main branch in this workspace.'));
    else if (!read) results.push(result('bitbucket.branch_protection', workspace, 'unknown', 'AIC could not read branch restrictions for any repository. The token needs the admin:repository scope to see them.'));
    else results.push(result('bitbucket.branch_protection', workspace, 'pass', `All ${plural(read, 'repository', 'repositories')} checked${capped} block history rewrites and need at least one approval on the main branch.`, unreadable.length ? { unreadable } : undefined));

    // Workspace owners.
    try {
      const perms = await pages<Permission>(`${API}/workspaces/${ws}/permissions?pagelen=100`, auth);
      results.push(adminsCheck('bitbucket.admins_limited', workspace, perms.filter((p) => p.permission === 'owner').map(userName), 'workspace owners'));
    } catch (e) {
      if (e instanceof ConnectorError && e.status === 401) throw e;
      results.push(result('bitbucket.admins_limited', workspace, 'unknown', `Could not read workspace permissions: ${(e as Error).message}`));
    }

    return { results, label: workspace };
  },

  async accounts(c) {
    const { workspace, auth } = setup(c);
    const perms = await pages<Permission>(`${API}/workspaces/${encodeURIComponent(workspace)}/permissions?pagelen=100`, auth);
    // Bitbucket does not show other members' emails, so the account is the nickname.
    return perms.map((p): Account => ({
      system: 'Bitbucket Cloud', account: p.user?.nickname || p.user?.display_name || p.user?.account_id || 'unknown',
      displayName: p.user?.display_name ?? null, privilege: PRIVILEGE[p.permission] ?? null, lastActiveAt: null, enabled: true,
    }));
  },
};
