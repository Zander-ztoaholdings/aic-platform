/**
 * Slack, read with a user OAuth token (xoxp, Bearer) from an admin or owner, via users.list and team.info.
 * Docs: https://api.slack.com/methods/users.list
 */
import { call, need, result, adminsCheck, listSome, plural } from '../http';
import { ConnectorError, type ConnectorImpl, type Credentials } from '../types';
import type { Account } from '../../registers/accounts';

type Member = {
  id: string; name: string; real_name?: string; deleted?: boolean; is_bot?: boolean; is_app_user?: boolean;
  is_admin?: boolean; is_owner?: boolean; is_primary_owner?: boolean; is_restricted?: boolean; is_ultra_restricted?: boolean;
  has_2fa?: boolean; profile?: { email?: string; real_name?: string };
};
type SlackAnswer = { ok: boolean; error?: string; response_metadata?: { next_cursor?: string } };

const AUTH_ERRORS = new Set(['invalid_auth', 'not_authed', 'token_revoked', 'account_inactive', 'token_expired']);

/** Slack answers 200 with ok:false; turn that into a ConnectorError. */
async function api<T extends SlackAnswer>(method: string, token: string, params: Record<string, string> = {}): Promise<T> {
  const qs = new URLSearchParams(params).toString();
  const j = await call<T>(`https://slack.com/api/${method}${qs ? `?${qs}` : ''}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!j.ok) {
    const err = j.error ?? 'unknown_error';
    throw new ConnectorError(AUTH_ERRORS.has(err) ? 401 : 400, `Slack answered ${err} to ${method}.`);
  }
  return j;
}

async function members(token: string): Promise<Member[]> {
  const out: Member[] = [];
  let cursor = '';
  for (let i = 0; i < 50; i++) {
    const j = await api<SlackAnswer & { members?: Member[] }>('users.list', token, { limit: '200', ...(cursor ? { cursor } : {}) });
    out.push(...(j.members ?? []));
    cursor = j.response_metadata?.next_cursor ?? '';
    if (!cursor) break;
  }
  return out;
}

const token = (c: Credentials) => need(c, 'token', 'The user OAuth token');
const nameOf = (m: Member) => m.real_name || m.profile?.real_name || m.name;
const isHuman = (m: Member) => !m.is_bot && m.id !== 'USLACKBOT';

function privilege(m: Member): string {
  if (m.is_primary_owner) return 'Primary owner';
  if (m.is_owner) return 'Owner';
  if (m.is_admin) return 'Admin';
  if (m.is_restricted || m.is_ultra_restricted) return 'Guest';
  return 'Member';
}

export const slack: ConnectorImpl = {
  async run(c) {
    const t = token(c);
    const all = await members(t);
    let subject = 'Slack workspace';
    let label = 'Slack';
    try {
      const team = (await api<SlackAnswer & { team?: { name?: string; domain?: string } }>('team.info', t)).team;
      if (team?.domain) subject = `${team.domain}.slack.com`;
      if (team?.name) label = team.name;
    } catch (e) {
      if (e instanceof ConnectorError && e.status === 401) throw e;
      // Without team:read the checks still run; the label stays generic.
    }

    const active = all.filter((m) => !m.deleted && isHuman(m));
    const results = [];

    // has_2fa is only returned to admins and owners, and not at all when sign-in goes through an identity provider.
    if (!active.some((m) => typeof m.has_2fa === 'boolean')) {
      results.push(result('slack.mfa_enabled', subject, 'unknown', 'Slack only shows two-factor status to admins, or your workspace signs in through an identity provider.'));
    } else {
      const without = active.filter((m) => m.has_2fa === false).map(nameOf);
      results.push(without.length
        ? result('slack.mfa_enabled', subject, 'fail', `${plural(without.length, 'member')} without two-factor sign-in: ${listSome(without)}.`, { members: without })
        : result('slack.mfa_enabled', subject, 'pass', `All ${plural(active.length, 'member')} have two-factor sign-in.`));
    }

    results.push(adminsCheck('slack.admins_limited', subject, active.filter((m) => m.is_admin || m.is_owner).map(nameOf), ['admin or owner', 'admins and owners'], 5));
    return { results, label };
  },

  async accounts(c) {
    return (await members(token(c))).filter(isHuman).map((m): Account => ({
      system: 'Slack', account: m.profile?.email?.toLowerCase() || m.name, displayName: nameOf(m) ?? null, privilege: privilege(m), lastActiveAt: null, enabled: !m.deleted,
    }));
  },
};
