import type { CheckResult } from './catalog';
import type { TenantFacts, CaPolicy } from './microsoft';

/** The judgements behind the Microsoft 365 checks. Pure, so they can be tested without Microsoft. */

const DAY = 86_400_000;
export const STALE_DAYS = 90;

function caRequiresMfaForAll(p: CaPolicy): boolean {
  if (p.state !== 'enabled') return false;
  const all = p.conditions?.users?.includeUsers?.includes('All');
  const mfa = (p.grantControls?.builtInControls ?? []).includes('mfa') || !!p.grantControls?.authenticationStrength;
  return !!all && mfa;
}

export function evaluateTenant(subject: string, f: TenantFacts, now = Date.now()): CheckResult[] {
  const out: CheckResult[] = [];

  // MFA enforced: security defaults, or a live Conditional Access policy that
  // requires MFA of all users.
  const caMfa = (f.caPolicies ?? []).filter(caRequiresMfaForAll);
  if (f.securityDefaults === true || caMfa.length > 0) {
    out.push({
      checkKey: 'm365.mfa_enforced', subject, status: 'pass',
      summary: f.securityDefaults ? 'Security defaults are on, so every user must use a second factor.' : `Conditional Access requires a second factor of every user (${caMfa.map((p) => p.displayName).join(', ')}).`,
    });
  } else if (f.securityDefaults === null && f.caPolicies === null) {
    out.push({ checkKey: 'm365.mfa_enforced', subject, status: 'unknown', summary: 'AIC was not allowed to read the tenant’s sign-in policies.' });
  } else {
    out.push({
      checkKey: 'm365.mfa_enforced', subject, status: 'fail',
      summary: 'Nothing requires every user to use a second factor: security defaults are off and no Conditional Access policy covers all users.',
    });
  }

  if (f.registrations === null) {
    out.push({ checkKey: 'm365.mfa_registered', subject, status: 'unknown', summary: 'The registration report needs an Entra ID P1 or P2 licence, or AIC was not given permission to read it.' });
  } else {
    const members = f.registrations.filter((r) => (r.userType ?? 'member').toLowerCase() === 'member');
    const missing = members.filter((r) => !r.isMfaRegistered);
    const admins = missing.filter((r) => r.isAdmin);
    out.push(
      missing.length === 0
        ? { checkKey: 'm365.mfa_registered', subject, status: 'pass', summary: `All ${members.length} members have a second factor registered.` }
        : {
            checkKey: 'm365.mfa_registered', subject, status: 'fail',
            summary: `${missing.length} of ${members.length} members have no second factor registered${admins.length ? `, ${admins.length} of them administrators` : ''}.`,
            detail: { people: missing.slice(0, 50).map((r) => ({ name: r.userDisplayName ?? r.userPrincipalName, upn: r.userPrincipalName, admin: !!r.isAdmin })) },
          }
    );
  }

  if (f.globalAdmins === null) {
    out.push({ checkKey: 'm365.global_admins', subject, status: 'unknown', summary: 'AIC was not allowed to read directory roles.' });
  } else {
    const n = f.globalAdmins.length;
    const people = f.globalAdmins.map((a) => a.displayName ?? a.userPrincipalName ?? 'unnamed');
    out.push({
      checkKey: 'm365.global_admins', subject,
      status: n >= 2 && n <= 4 ? 'pass' : n < 2 ? 'warn' : 'fail',
      summary:
        n > 4 ? `${n} people are global administrators. Microsoft recommends fewer than five.`
          : n < 2 ? `Only ${n} global administrator${n === 1 ? '' : 's'}: if that account is lost, nobody can administer the tenant.`
            : `${n} global administrators.`,
      detail: { people },
    });
  }

  if (f.users === null) {
    out.push({ checkKey: 'm365.stale_accounts', subject, status: 'unknown', summary: 'AIC was not allowed to read user accounts.' });
  } else if (!f.users.some((u) => u.signInActivity !== undefined)) {
    out.push({ checkKey: 'm365.stale_accounts', subject, status: 'unknown', summary: 'Sign-in activity needs an Entra ID P1 or P2 licence.' });
  } else {
    const cutoff = now - STALE_DAYS * DAY;
    const stale = f.users.filter((u) => {
      if (!u.accountEnabled || (u.userType ?? 'Member') !== 'Member') return false;
      const last = [u.signInActivity?.lastSignInDateTime, u.signInActivity?.lastNonInteractiveSignInDateTime]
        .filter(Boolean)
        .map((d) => new Date(d as string).getTime());
      const lastSeen = last.length ? Math.max(...last) : null;
      const created = u.createdDateTime ? new Date(u.createdDateTime).getTime() : 0;
      return lastSeen === null ? created < cutoff : lastSeen < cutoff;
    });
    out.push(
      stale.length === 0
        ? { checkKey: 'm365.stale_accounts', subject, status: 'pass', summary: `No enabled member account has gone unused for ${STALE_DAYS} days.` }
        : {
            checkKey: 'm365.stale_accounts', subject, status: 'fail',
            summary: `${stale.length} enabled account${stale.length === 1 ? ' has' : 's have'} not signed in for ${STALE_DAYS} days or more.`,
            detail: { people: stale.slice(0, 50).map((u) => ({ name: u.displayName ?? u.userPrincipalName, upn: u.userPrincipalName })) },
          }
    );
  }
  return out;
}
