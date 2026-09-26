import { describe, it, expect } from 'vitest';
import {
  isStaff,
  canUseClientWorkspace,
  canUseHq,
  staffCan,
  homeFor,
  safePath,
  canEnter,
  resolveLanding,
} from '../../lib/workspace';

/**
 * Where each kind of person lands and what they may open. These encode the
 * user flow itself: if one of them fails, somebody is being sent to the wrong
 * place or shown a door they should not see.
 */

const ORG = '11111111-2222-3333-4444-555555555555';
const client = { role: 'ORG_ADMIN', orgId: ORG, isSuperAdmin: false };
const member = { role: 'ORG_USER', orgId: ORG, isSuperAdmin: false };
const auditor = { role: 'AIC_AUDITOR', orgId: null, isSuperAdmin: false };
const superAdmin = { role: 'AIC_SUPER_ADMIN', orgId: null, isSuperAdmin: true };
const labelOnly = { role: 'AIC_SUPER_ADMIN', orgId: null, isSuperAdmin: false };
const orphan = { role: 'ORG_USER', orgId: null, isSuperAdmin: false };

describe('who is staff', () => {
  it('treats auditors and super-admins as staff', () => {
    expect(isStaff(auditor)).toBe(true);
    expect(isStaff(superAdmin)).toBe(true);
  });

  it('never treats a client as staff', () => {
    expect(isStaff(client)).toBe(false);
    expect(isStaff(member)).toBe(false);
    expect(isStaff(null)).toBe(false);
  });
});

describe('where people land after signing in', () => {
  it('sends clients to their workspace', () => {
    expect(homeFor(client)).toBe('/dashboard');
    expect(homeFor(member)).toBe('/dashboard');
  });

  it('sends AIC staff to the staff workspace, not the client dashboard', () => {
    // The bug this replaces: every sign-in went to `/`, and an auditor with no
    // organisation landed on a page that could not load a single thing.
    expect(homeFor(auditor)).toBe('/admin');
    expect(homeFor(superAdmin)).toBe('/admin');
  });

  it('has nowhere to send an account with no organisation and no staff role', () => {
    expect(homeFor(orphan)).toBe('/unauthorized');
    expect(homeFor(null)).toBe('/login');
  });
});

describe('what each role may open', () => {
  it('keeps clients out of the staff console and HQ', () => {
    expect(canEnter('/admin/users', client)).toBe(false);
    expect(canEnter('/admin', member)).toBe(false);
    expect(canEnter('/hq/growth/revenue', client)).toBe(false);
  });

  it('lets auditors into assessment work but not HQ', () => {
    expect(canEnter('/admin/queue', auditor)).toBe(true);
    expect(canEnter('/hq/people/hr', auditor)).toBe(false);
  });

  it('gates HQ on the boolean, not the label', () => {
    // lib/roles.ts: holding the AIC_SUPER_ADMIN label is not holding the power.
    expect(canUseHq(labelOnly)).toBe(false);
    expect(canUseHq(superAdmin)).toBe(true);
  });

  it('needs an organisation for the client workspace', () => {
    expect(canUseClientWorkspace(client)).toBe(true);
    expect(canUseClientWorkspace(auditor)).toBe(false);
    expect(canEnter('/evidence', auditor)).toBe(false);
  });

  it('does not treat /administrator or /hqx as staff areas', () => {
    expect(canEnter('/administrator', client)).toBe(true);
    expect(canEnter('/hqx', client)).toBe(true);
  });
});

describe('the next= deep link', () => {
  it('honours a safe path the person may open', () => {
    expect(resolveLanding(client, '/evidence?tab=pending')).toBe('/evidence?tab=pending');
    expect(resolveLanding(auditor, '/admin/queue')).toBe('/admin/queue');
  });

  it('ignores a path the person may not open, rather than bouncing them into a refusal', () => {
    expect(resolveLanding(client, '/admin/users')).toBe('/dashboard');
    expect(resolveLanding(auditor, '/hq/growth/revenue')).toBe('/admin');
  });

  it('refuses anything that would make sign-in an open redirect', () => {
    for (const bad of [
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      'javascript:alert(1)',
      '/api/users',
      '/login',
      '/start?next=/admin',
      '',
      null,
      undefined,
    ]) {
      expect(safePath(bad as string)).toBeNull();
    }
    // Raw control characters are refused. Percent-encoded ones stay a harmless
    // literal path on this origin — the router never decodes them into headers.
    expect(safePath('/evidence\u0000')).toBeNull();
    expect(safePath('/a\r\nLocation: x')).toBeNull();
    expect(resolveLanding(client, 'https://evil.example')).toBe('/dashboard');
  });
});

describe('staff navigation visibility', () => {
  it('shows an auditor assessment tools and hides administration', () => {
    expect(staffCan(auditor, 'conduct_assessment')).toBe(true);
    expect(staffCan(auditor, 'manage_users')).toBe(false);
    expect(staffCan(auditor, 'issue_certification')).toBe(false);
  });

  it('shows a super-admin everything', () => {
    expect(staffCan(superAdmin, 'manage_users')).toBe(true);
    expect(staffCan(superAdmin, 'access_hq')).toBe(true);
  });

  it('shows a client none of it', () => {
    expect(staffCan(client, 'conduct_assessment')).toBe(false);
  });
});
