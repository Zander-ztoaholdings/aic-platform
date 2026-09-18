import { describe, it, expect } from 'vitest';
import {
  ALL_CAPABILITIES,
  ROLE_CAPABILITIES,
  SUPER_ADMIN_ONLY,
  roleHasCapability,
  type Capability,
} from '../../lib/capabilities';

/**
 * These assert the authorisation model itself, not a handler that uses it.
 *
 * A certification body is asked, by its own accreditation assessors, to
 * demonstrate that evaluation and the certification decision are separated. The
 * honest form of that demonstration is a test that fails when somebody widens
 * the auditor's grant, not a paragraph in a policy document claiming the
 * separation exists.
 */

const CERTIFICATION_DECISION: Capability[] = [
  'approve_certification',
  'issue_certification',
  'manage_certification_lifecycle',
];

describe('separation of evaluation from the certification decision', () => {
  it('lets an auditor perform an assessment', () => {
    expect(roleHasCapability('AIC_AUDITOR', 'conduct_assessment')).toBe(true);
  });

  it('does not let an auditor decide the outcome of one', () => {
    for (const cap of CERTIFICATION_DECISION) {
      expect(roleHasCapability('AIC_AUDITOR', cap)).toBe(false);
    }
  });

  it('does not let an auditor clear an impartiality conflict', () => {
    // The control exists so that a declared conflict is cleared by somebody
    // other than the person it attaches to. A role that could clear its own
    // would make the declaration ceremonial.
    expect(roleHasCapability('AIC_AUDITOR', 'clear_impartiality_conflict')).toBe(false);
  });
});

describe('the AIC_SUPER_ADMIN label is not the power', () => {
  // lib/roles.ts and /api/v1/admin/users both state the rule: users.role is a
  // label and users.isSuperAdmin is the gate. If the role alone ever starts
  // granting these, that rule has been quietly broken and this fails.
  it('grants no certification-decision capability on the strength of the role', () => {
    for (const cap of CERTIFICATION_DECISION) {
      expect(roleHasCapability('AIC_SUPER_ADMIN', cap)).toBe(false);
    }
  });

  it('grants no platform administration on the strength of the role', () => {
    expect(roleHasCapability('AIC_SUPER_ADMIN', 'access_admin_tools')).toBe(false);
    expect(roleHasCapability('AIC_SUPER_ADMIN', 'manage_roles')).toBe(false);
    expect(roleHasCapability('AIC_SUPER_ADMIN', 'manage_users')).toBe(false);
  });
});

describe('a client organisation holds no AIC-staff capability', () => {
  const staffOnly = ALL_CAPABILITIES.filter((c) => c !== 'upload_bias_report');

  it('gives ORG_ADMIN nothing on the staff side', () => {
    for (const cap of staffOnly) {
      expect(roleHasCapability('ORG_ADMIN', cap)).toBe(false);
    }
  });

  it('gives ORG_USER nothing on the staff side', () => {
    for (const cap of staffOnly) {
      expect(roleHasCapability('ORG_USER', cap)).toBe(false);
    }
  });

  it('cannot read revenue or other organisations', () => {
    expect(roleHasCapability('ORG_ADMIN', 'view_revenue')).toBe(false);
    expect(roleHasCapability('ORG_ADMIN', 'view_all_orgs')).toBe(false);
  });
});

describe('the matrix is closed', () => {
  it('accounts for every capability exactly once, as role-granted or super-admin-only', () => {
    const roleGranted = new Set(Object.values(ROLE_CAPABILITIES).flat());
    for (const cap of ALL_CAPABILITIES) {
      const inMatrix = roleGranted.has(cap);
      const inSuperOnly = SUPER_ADMIN_ONLY.includes(cap);
      expect(inMatrix || inSuperOnly).toBe(true);
      expect(inMatrix && inSuperOnly).toBe(false);
    }
  });

  it('keeps the certification decision super-admin-only', () => {
    for (const cap of CERTIFICATION_DECISION) {
      expect(SUPER_ADMIN_ONLY).toContain(cap);
    }
  });
});

describe('unknown and absent roles', () => {
  it('denies a null or undefined role', () => {
    expect(roleHasCapability(null, 'conduct_assessment')).toBe(false);
    expect(roleHasCapability(undefined, 'conduct_assessment')).toBe(false);
  });

  it('denies a role that is not in the model', () => {
    // Retired values (ADMIN, AUDITOR, COMPLIANCE_OFFICER, VIEWER) and anything
    // a future migration leaves behind must not fall through to a grant.
    expect(roleHasCapability('ADMIN', 'conduct_assessment')).toBe(false);
    expect(roleHasCapability('AUDITOR', 'conduct_assessment')).toBe(false);
    expect(roleHasCapability('', 'conduct_assessment')).toBe(false);
  });
});
