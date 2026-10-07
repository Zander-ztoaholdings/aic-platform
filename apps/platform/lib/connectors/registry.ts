/**
 * Connector implementations by key, and the glue between a stored
 * integration row and a connector: decrypting its credential, running it,
 * listing its accounts, and bringing an HR system's people into the People
 * register.
 */
import { getTenantDb, integrations, orgPeople, EncryptionService, eq, and } from '@aic/db';
import type { Account } from '../registers/accounts';
import { CONNECTOR_BY_KEY } from './catalog';
import { tenantProven } from '@/lib/integrations/microsoft';
import { ConnectorError, type ConnectorImpl, type Credentials, type RunContext, type PersonRecord } from './types';
import { aws } from './providers/aws';
import { gcp } from './providers/gcp';
import { azure } from './providers/azure';
import { googleWorkspace } from './providers/google_workspace';
import { okta } from './providers/okta';
import { onepassword } from './providers/onepassword';
import { gitlab } from './providers/gitlab';
import { bitbucket } from './providers/bitbucket';
import { snyk } from './providers/snyk';
import { jira } from './providers/jira';
import { linear } from './providers/linear';
import { zendesk } from './providers/zendesk';
import { slack } from './providers/slack';
import { bamboohr } from './providers/bamboohr';
import { hibob } from './providers/hibob';
import { personio } from './providers/personio';
import { deel } from './providers/deel';
import { rippling } from './providers/rippling';
import { intune } from './providers/intune';
import { jamf } from './providers/jamf';
import { kandji } from './providers/kandji';
import { crowdstrike } from './providers/crowdstrike';
import { cloudflare } from './providers/cloudflare';
import { datadog } from './providers/datadog';
import { salesforce } from './providers/salesforce';
import { claudeEnterprise } from './providers/claude_enterprise';

export const IMPLS: Record<string, ConnectorImpl> = {
  aws, gcp, azure, google_workspace: googleWorkspace, okta, onepassword, gitlab, bitbucket, snyk, jira, linear, zendesk, slack,
  bamboohr, hibob, personio, deel, rippling, intune, jamf, kandji, crowdstrike, cloudflare, datadog, salesforce,
  claude_enterprise: claudeEnterprise,
};

type Row = typeof integrations.$inferSelect;

export const isConnector = (provider: string) => !!CONNECTOR_BY_KEY[provider] && !!IMPLS[provider];

/** The stored credential, decrypted. Connectors that reuse Microsoft 365 store none. */
export function credentialsOf(i: Row): Credentials {
  if (!i.secretCiphertext) return {};
  const text = EncryptionService.decrypt(i.secretCiphertext);
  if (!text || text === '[ENCRYPTED_DATA_UNREADABLE]') throw new ConnectorError(400, 'The stored credential could not be read. Connect again and paste it once more.');
  try { return JSON.parse(text) as Credentials; } catch { throw new ConnectorError(400, 'The stored credential could not be read. Connect again.'); }
}

/** The Microsoft 365 tenant, for Azure and Intune, once it has been proved. */
export async function microsoftTenant(orgId: string): Promise<string | null> {
  const [m] = await getTenantDb(orgId).query((tx) =>
    tx.select({ externalId: integrations.externalId, status: integrations.status, settings: integrations.settings }).from(integrations)
      .where(and(eq(integrations.orgId, orgId), eq(integrations.provider, 'microsoft'))).limit(1));
  // Only a tenant proved by sign-in; see tenantProven.
  return m && m.status !== 'disconnected' && tenantProven(m.settings) ? m.externalId : null;
}

export async function contextFor(orgId: string, provider: string): Promise<RunContext> {
  return { now: new Date(), microsoftTenant: CONNECTOR_BY_KEY[provider]?.uses === 'microsoft' ? await microsoftTenant(orgId) : null };
}

/** Accounts from a connector-based integration, read live. Null for anything that is not a connector or lists no accounts. */
export async function connectorAccounts(i: Row): Promise<Account[] | null> {
  const impl = IMPLS[i.provider];
  if (!impl?.accounts) return null;
  return impl.accounts(credentialsOf(i), await contextFor(i.orgId, i.provider));
}

/**
 * Brings an HR system's people into the People register. Each person is
 * matched by the connector and its id; anyone added by hand is left alone,
 * and nobody is deleted, so a leaver stays on the list with a leaving date.
 */
export async function importPeople(orgId: string, source: string, people: PersonRecord[]): Promise<{ added: number; updated: number }> {
  let added = 0, updated = 0;
  try {
    await getTenantDb(orgId).query(async (tx) => {
      const existing = await tx.select({ id: orgPeople.id, externalId: orgPeople.externalId, email: orgPeople.email, source: orgPeople.source }).from(orgPeople).where(eq(orgPeople.orgId, orgId));
      const byExt = new Map(existing.filter((e) => e.source === source && e.externalId).map((e) => [e.externalId!, e.id]));
      const byEmail = new Map(existing.filter((e) => e.email).map((e) => [e.email!.toLowerCase(), e.id]));
      const now = new Date();
      for (const p of people.slice(0, 5000)) {
        const values = { name: p.name.slice(0, 200), email: p.email?.slice(0, 255) ?? null, jobTitle: p.jobTitle?.slice(0, 200) ?? null, department: p.department?.slice(0, 120) ?? null, startDate: p.startDate, endDate: p.endDate, source, externalId: p.externalId.slice(0, 120), updatedAt: now };
        const id = byExt.get(p.externalId) ?? (p.email ? byEmail.get(p.email.toLowerCase()) : undefined);
        if (id) { await tx.update(orgPeople).set(values).where(eq(orgPeople.id, id)); updated++; }
        else { await tx.insert(orgPeople).values({ orgId, ...values }); added++; }
      }
    });
  } catch (e) {
    const code = (e as { code?: string; cause?: { code?: string } }).code ?? (e as { cause?: { code?: string } }).cause?.code;
    if (code !== '42P01') throw e; // migration 016 not applied: nowhere to put people yet
  }
  return { added, updated };
}
