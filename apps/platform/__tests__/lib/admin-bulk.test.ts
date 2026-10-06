import { describe, it, expect, vi } from 'vitest';
vi.mock('@aic/auth', () => ({ auth: vi.fn() }));
import { confirmPhrase, planOrgs, planUsers, keepOnOrgAction, DEMO_ORG_ID, type OrgFacts, type UserFacts } from '@/lib/admin-bulk';

const org = (o: Partial<OrgFacts>): OrgFacts => ({ id: 'o1', name: 'Test Org', members: 2, activeMembers: 2, staff: 0, includesActor: false, systems: 1, decisions: 10, documents: 3, certs: 0, badges: 0, ...o });
const user = (u: Partial<UserFacts>): UserFacts => ({ id: 'u1', email: 'a@x.test', name: 'A', role: 'ORG_USER', isSuperAdmin: false, isActive: true, removed: false, ...u });

describe('bulk actions: the safety rules', () => {
  it('asks for a typed phrase only for what cannot be undone', () => {
    expect(confirmPhrase('organizations', 'delete', 3)).toBe('delete 3 organisations');
    expect(confirmPhrase('organizations', 'delete', 1)).toBe('delete 1 organisation');
    expect(confirmPhrase('users', 'remove', 2)).toBe('remove 2 accounts');
    expect(confirmPhrase('organizations', 'suspend', 3)).toBeNull();
  });
  it('never deletes an organisation holding a certificate or a badge, or the demo company', () => {
    const p = planOrgs('delete', [org({ id: 'a', certs: 1 }), org({ id: 'b', badges: 1 }), org({ id: DEMO_ORG_ID }), org({ id: 'c' })]);
    expect(p.map((i) => !!i.skip)).toEqual([true, true, true, false]);
    expect(p[3].detail).toBe('2 members removed, 1 AI system, 10 decisions and 3 documents deleted');
  });
  it('suspending a certified organisation is allowed, deleting is not', () => {
    expect(planOrgs('suspend', [org({ certs: 1 })])[0].skip).toBeNull();
  });
  it('protects you, other super admins, and the last super admin', () => {
    const me = { id: 'me', isSuperAdmin: true };
    const p = planUsers('remove', [user({ id: 'me' }), user({ id: 's1', isSuperAdmin: true }), user({ id: 's2', isSuperAdmin: true })], me, 2);
    expect(p[0].skip).toMatch(/own account/);
    expect(p[1].skip).toBeNull();
    expect(p[2].skip).toMatch(/last active super admin/);
    expect(planUsers('deactivate', [user({ isSuperAdmin: true })], { id: 'x', isSuperAdmin: false }, 3)[0].skip).toMatch(/Only a super admin/);
  });
  it('skips what is already in the asked-for state', () => {
    expect(planUsers('reactivate', [user({ isActive: true })], { id: 'x', isSuperAdmin: true }, 1)[0].skip).toMatch(/Already active/);
    expect(planUsers('remove', [user({ removed: true })], { id: 'x', isSuperAdmin: true }, 1)[0].skip).toMatch(/Already removed/);
  });
  it('never removes or switches off AIC staff, or the person running it, with an organisation', () => {
    expect(keepOnOrgAction({ id: 'me', isSuperAdmin: false, role: 'ORG_ADMIN' }, 'me')).toBe(true);
    expect(keepOnOrgAction({ id: 'x', isSuperAdmin: true, role: 'ORG_ADMIN' }, 'me')).toBe(true);
    expect(keepOnOrgAction({ id: 'x', isSuperAdmin: false, role: 'AIC_AUDITOR' }, 'me')).toBe(true);
    expect(keepOnOrgAction({ id: 'x', isSuperAdmin: false, role: 'ORG_USER' }, 'me')).toBe(false);
    expect(planOrgs('delete', [org({ staff: 1, includesActor: true })])[0].detail).toMatch(/your own account detached and kept/);
  });
});
