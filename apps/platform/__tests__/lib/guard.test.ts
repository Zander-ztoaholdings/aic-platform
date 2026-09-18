import { describe, it, expect } from 'vitest';
import { requireOrgCapability, requireOrgId } from '../../lib/guard';
import {
  canManageEstate,
  canManageCompliance,
  canRecordDecisions,
  canEditOrgProfile,
  canManageTeamAndKeys,
} from '../../lib/roles';

/**
 * The client-side write guard. These exist because the failure they prevent is
 * silent: a route that forgets the check still returns 200, still writes the
 * row, and still looks correct in every log.
 */

const ORG = ['ORG_ADMIN', 'ORG_USER'] as const;
const NOT_ORG_MEMBERS = ['AIC_SUPER_ADMIN', 'AIC_AUDITOR'] as const;
const PREDICATES = [
  ['canManageEstate', canManageEstate],
  ['canManageCompliance', canManageCompliance],
  ['canRecordDecisions', canRecordDecisions],
  ['canEditOrgProfile', canEditOrgProfile],
] as const;

describe('requireOrgCapability', () => {
  it("lets an organisation's own people write", () => {
    for (const role of ORG) {
      for (const [, allows] of PREDICATES) {
        expect(requireOrgCapability(role, allows, 'do the thing')).toBeNull();
      }
    }
  });

  it('refuses AIC staff writing into a client organisation', () => {
    // An assessor amending the evidence they are assessing is the failure this
    // guard is for. AIC staff are not members of the organisation.
    for (const role of NOT_ORG_MEMBERS) {
      for (const [, allows] of PREDICATES) {
        const res = requireOrgCapability(role, allows, 'do the thing');
        expect(res).not.toBeNull();
        expect(res!.status).toBe(403);
      }
    }
  });

  it('fails closed on a missing or unrecognised role', () => {
    // settings PATCH previously read `if (userRole && userRole !== ...)`, so a
    // session with no role skipped the check. Null must refuse.
    for (const role of [null, undefined, '', 'ADMIN', 'VIEWER', 'nonsense']) {
      const res = requireOrgCapability(role, canEditOrgProfile, 'do the thing');
      expect(res).not.toBeNull();
      expect(res!.status).toBe(403);
    }
  });

  it('keeps team and key management to the organisation admin', () => {
    expect(requireOrgCapability('ORG_ADMIN', canManageTeamAndKeys, 'invite')).toBeNull();
    expect(requireOrgCapability('ORG_USER', canManageTeamAndKeys, 'invite')).not.toBeNull();
  });

  it('names the action in the message the refused person reads', async () => {
    const res = requireOrgCapability('AIC_AUDITOR', canManageEstate, 'declare or edit a model');
    const body = await res!.json();
    expect(body.message).toContain('declare or edit a model');
  });
});

describe('requireOrgId', () => {
  it('returns the id for a member session', () => {
    expect(requireOrgId('11111111-2222-3333-4444-555555555555')).toEqual({
      orgId: '11111111-2222-3333-4444-555555555555',
    });
  });

  it('refuses a session with no organisation', async () => {
    for (const value of [null, undefined, '', 0, {}, []]) {
      const res = requireOrgId(value);
      expect(res).toBeInstanceOf(Response);
      expect((res as Response).status).toBe(401);
    }
  });
});
