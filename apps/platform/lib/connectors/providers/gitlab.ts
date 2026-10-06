/**
 * GitLab (gitlab.com or self-managed), read with a group or personal access token (read_api) in the PRIVATE-TOKEN header.
 * Docs: https://docs.gitlab.com/api/protected_branches/ and https://docs.gitlab.com/api/members/
 */
import { call, baseUrl, need, result, adminsCheck, listSome, plural, providerMessage } from '../http';
import { ConnectorError, type ConnectorImpl, type Credentials } from '../types';
import type { CheckResult } from '../../integrations/catalog';
import type { Account } from '../../registers/accounts';

type Group = { id: number; name?: string; full_path?: string; require_two_factor_authentication?: boolean };
type Project = { id: number; path_with_namespace: string; default_branch?: string | null; archived?: boolean; empty_repo?: boolean };
type AccessLevel = { access_level: number; user_id?: number | null; group_id?: number | null };
type ProtectedBranch = { name: string; allow_force_push?: boolean; push_access_levels?: AccessLevel[] };
type Member = { id: number; username: string; name?: string; state?: string; access_level: number; bot?: boolean; last_activity_on?: string | null };

const ROLE: Record<number, string> = { 50: 'Owner', 40: 'Maintainer', 30: 'Developer', 20: 'Reporter', 15: 'Planner', 10: 'Guest', 5: 'Minimal access' };

const setup = (c: Credentials) => ({
  api: `${baseUrl(c.baseUrl, 'https://gitlab.com')}/api/v4`,
  group: encodeURIComponent(need(c, 'group', 'The group path').replace(/^\/+|\/+$/g, '')),
  token: need(c, 'token', 'The access token'),
});

/** GitLab pages with the X-Next-Page header; follows it up to `max` pages. */
async function pages<T>(url: string, token: string, max = 10): Promise<T[]> {
  const out: T[] = [];
  let page: string | null = '1';
  for (let i = 0; page && i < max; i++) {
    const u = new URL(url);
    u.searchParams.set('page', page);
    const res: Response = await fetch(u.toString(), { headers: { 'PRIVATE-TOKEN': token, Accept: 'application/json' }, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new ConnectorError(res.status, `GitLab answered ${res.status}: ${providerMessage(await res.text())}`);
    out.push(...((await res.json()) as T[]));
    page = res.headers.get('x-next-page') || null;
  }
  return out;
}

/** Protected branch names can be wildcards such as `release/*`. */
const globMatch = (pattern: string, name: string) =>
  new RegExp(`^${pattern.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`).test(name);

// Unverified: group and project access token users have usernames like group_123_bot_<hash>; confirm the `bot` flag appears on members/all.
const isBot = (m: Member) => m.bot === true || /_bot(_[0-9a-z]+)?$/i.test(m.username);

export const gitlab: ConnectorImpl = {
  async run(c) {
    const { api, group, token } = setup(c);
    const get = <T>(path: string) => call<T>(`${api}${path}`, { headers: { 'PRIVATE-TOKEN': token } });

    // First call: an invalid token or a wrong group path stops the run here.
    const g = await get<Group>(`/groups/${group}`);
    const subject = g.full_path ?? decodeURIComponent(group);
    const results: CheckResult[] = [];

    // Default branch protection on each project, capped at 50.
    try {
      const projects = (await pages<Project>(`${api}/groups/${group}/projects?include_subgroups=true&archived=false&per_page=100`, token))
        .filter((p) => !p.archived && !p.empty_repo && p.default_branch);
      const checked = projects.slice(0, 50);
      const weak: string[] = [];
      const unreadable: string[] = [];
      for (const p of checked) {
        let rules: ProtectedBranch[];
        try { rules = await get<ProtectedBranch[]>(`/projects/${p.id}/protected_branches?per_page=100`); } catch (e) {
          if (e instanceof ConnectorError && e.status === 401) throw e;
          unreadable.push(p.path_with_namespace);
          continue;
        }
        const rule = rules.find((r) => r.name === p.default_branch) ?? rules.find((r) => globMatch(r.name, p.default_branch!));
        if (!rule) weak.push(`${p.path_with_namespace} (not protected)`);
        else if (rule.allow_force_push) weak.push(`${p.path_with_namespace} (force push allowed)`);
        else if ((rule.push_access_levels ?? []).some((a) => a.access_level === 30)) weak.push(`${p.path_with_namespace} (developers can push)`);
      }
      const read = checked.length - unreadable.length;
      const capped = projects.length > checked.length ? ` (the first ${checked.length} of ${projects.length})` : '';
      if (weak.length) results.push(result('gitlab.branch_protection', subject, 'fail', `${plural(weak.length, 'project')} with a weak default branch: ${listSome(weak)}.`, { projects: weak, unreadable }));
      else if (!projects.length) results.push(result('gitlab.branch_protection', subject, 'unknown', 'AIC found no active projects with code in this group.'));
      else if (!read) results.push(result('gitlab.branch_protection', subject, 'unknown', 'AIC could not read branch protection for any project. The token may need the Maintainer role or higher.'));
      else results.push(result('gitlab.branch_protection', subject, 'pass', `All ${plural(read, 'project')} checked${capped} protect the default branch from force pushes and direct pushes by developers.`, unreadable.length ? { unreadable } : undefined));
    } catch (e) {
      if (e instanceof ConnectorError && e.status === 401) throw e;
      results.push(result('gitlab.branch_protection', subject, 'unknown', `Could not read the group's projects: ${(e as Error).message}`));
    }

    // Two-factor requirement. The field is only shown to group owners.
    if (g.require_two_factor_authentication === true) results.push(result('gitlab.mfa_required', subject, 'pass', 'The group requires everyone in it to set up two-factor sign-in.'));
    else if (g.require_two_factor_authentication === false) results.push(result('gitlab.mfa_required', subject, 'fail', 'The group does not require two-factor sign-in, so a password alone is enough to reach your code.'));
    else results.push(result('gitlab.mfa_required', subject, 'unknown', 'GitLab did not show the two-factor setting. The token needs the Owner role on the group to see it.'));

    // Owners, excluding bot users created for access tokens.
    try {
      const members = await pages<Member>(`${api}/groups/${group}/members/all?per_page=100`, token);
      const owners = members.filter((m) => m.access_level === 50 && m.state === 'active' && !isBot(m)).map((m) => m.name || m.username);
      results.push(adminsCheck('gitlab.admins_limited', subject, owners, 'group owners'));
    } catch (e) {
      if (e instanceof ConnectorError && e.status === 401) throw e;
      results.push(result('gitlab.admins_limited', subject, 'unknown', `Could not read the group's members: ${(e as Error).message}`));
    }

    return { results, label: g.name ?? subject };
  },

  async accounts(c) {
    const { api, group, token } = setup(c);
    const members = await pages<Member>(`${api}/groups/${group}/members/all?per_page=100`, token);
    // GitLab hides member emails from the API, so the account is the username.
    return members.filter((m) => !isBot(m)).map((m): Account => ({
      system: 'GitLab', account: m.username, displayName: m.name ?? null, privilege: ROLE[m.access_level] ?? null,
      lastActiveAt: m.last_activity_on ?? null, enabled: m.state === 'active',
    }));
  },
};
