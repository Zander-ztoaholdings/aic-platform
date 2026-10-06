import { describe, it, expect, vi } from 'vitest';
vi.mock('@aic/auth', () => ({ auth: vi.fn() }));
import { explainAccess, refuseChange, roleMatrix } from '@/lib/rbac-admin';

const line = (lines: ReturnType<typeof explainAccess>, slug: string) => lines.find((l) => l.slug === slug)!;

describe('explainAccess follows lib/rbac.ts', () => {
  it('a per-person denial beats the super admin switch', () => {
    const l = explainAccess({ role: 'AIC_SUPER_ADMIN', isSuperAdmin: true }, [{ slug: 'issue_certification', isGranted: false }]);
    expect(line(l, 'issue_certification')).toMatchObject({ granted: false, because: 'per-person exception (denied)' });
    expect(line(l, 'manage_users')).toMatchObject({ granted: true, because: 'super admin' });
  });
  it('the super admin switch beats the role', () => {
    expect(line(explainAccess({ role: 'AIC_AUDITOR', isSuperAdmin: true }, []), 'approve_certification').because).toBe('super admin');
  });
  it('falls back to the role matrix, then not held', () => {
    const l = explainAccess({ role: 'AIC_AUDITOR', isSuperAdmin: false }, []);
    expect(line(l, 'conduct_assessment')).toMatchObject({ granted: true, because: 'role Auditor' });
    expect(line(l, 'approve_certification')).toMatchObject({ granted: false, because: 'not held' });
  });
  it('a grant exception adds one capability', () => {
    expect(line(explainAccess({ role: 'AIC_AUDITOR', isSuperAdmin: false }, [{ slug: 'view_revenue', isGranted: true }]), 'view_revenue').granted).toBe(true);
  });
  it('a deactivated account holds nothing', () => {
    expect(explainAccess({ role: 'AIC_AUDITOR', isSuperAdmin: true, isActive: false }, []).every((l) => !l.granted)).toBe(true);
  });
});

describe('refuseChange', () => {
  const admin = { id: 'a', role: 'AIC_SUPER_ADMIN', isSuperAdmin: true };
  const auditor = { id: 'b', role: 'AIC_AUDITOR', isSuperAdmin: false };
  const client = { id: 'c', role: 'ORG_ADMIN', isSuperAdmin: false };
  const ok = 'Covering the queue while Sipho is away';
  it('allows a reasoned exception for staff', () => expect(refuseChange({ actor: admin, target: auditor, slug: 'view_revenue', effect: 'grant', reason: ok })).toBeNull());
  it('needs a reason', () => expect(refuseChange({ actor: admin, target: auditor, slug: 'view_revenue', effect: 'grant', reason: 'x' })).toMatch(/reason/));
  it('refuses changing your own access', () => expect(refuseChange({ actor: admin, target: admin, slug: 'view_revenue', effect: 'deny', reason: ok })).toMatch(/your own/));
  it('refuses exceptions for client users', () => expect(refuseChange({ actor: admin, target: client, slug: 'view_all_orgs', effect: 'grant', reason: ok })).toMatch(/staff only/));
  it('refuses non super admins', () => expect(refuseChange({ actor: auditor, target: admin, slug: 'view_revenue', effect: 'grant', reason: ok })).toMatch(/super admin/));
});

describe('roleMatrix', () => {
  it('keeps certification decisions away from auditors', () => {
    const r = roleMatrix().rows.find((x) => x.slug === 'approve_certification')!;
    expect(r.held.AIC_AUDITOR).toBe(false);
    expect(r.held.SUPER_ADMIN).toBe(true);
  });
});
