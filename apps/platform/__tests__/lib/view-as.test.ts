import { describe, it, expect } from 'vitest';
import { parseViewAs, serializeViewAs } from '../../../../packages/auth/src/view-as';

const ORG = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

describe('view-as cookie', () => {
  it('round-trips a client-role preview', () => {
    const v = { role: 'ORG_ADMIN' as const, orgId: ORG, orgName: 'Acme' };
    expect(parseViewAs(serializeViewAs(v))).toEqual(v);
  });
  it('drops the organisation for an auditor preview', () => {
    expect(parseViewAs(serializeViewAs({ role: 'AIC_AUDITOR', orgId: ORG, orgName: 'x' }))).toEqual({ role: 'AIC_AUDITOR', orgId: null, orgName: null });
  });
  it('refuses anything that could widen access or is malformed', () => {
    expect(parseViewAs(encodeURIComponent(JSON.stringify({ role: 'AIC_SUPER_ADMIN' })))).toBeNull();
    expect(parseViewAs(encodeURIComponent(JSON.stringify({ role: 'ORG_ADMIN' })))).toBeNull();
    expect(parseViewAs(encodeURIComponent(JSON.stringify({ role: 'ORG_USER', orgId: 'not-a-uuid' })))).toBeNull();
    expect(parseViewAs('garbage')).toBeNull();
    expect(parseViewAs(undefined)).toBeNull();
  });
});
