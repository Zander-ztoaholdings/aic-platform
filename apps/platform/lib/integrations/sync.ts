import {
  getTenantDb, getSystemDb, integrations, integrationChecks, llmUsageRecords, aiSystems,
  estateSnapshots, EncryptionService, eq, and, gte,
} from '@aic/db';
import { CHECK_BY_KEY, type CheckResult } from './catalog';
import {
  githubAppConfigured, installationToken, getInstallation, paginate, collectRepoFacts,
  orgTwoFactorRequired, GitHubError, type Repo,
} from './github';
import { evaluateRepo, evaluateOrg2fa } from './github-checks';
import { pullUsage, ProviderError, type Provider } from './providers';
import { evaluateProvider } from './provider-checks';
import { collectTenantFacts, microsoftConfigured, MicrosoftError, tenantProven } from './microsoft';
import { evaluateTenant } from './microsoft-checks';
import { observeEstate } from '../continuity-store';
import { IMPLS, isConnector, credentialsOf, contextFor, importPeople } from '../connectors/registry';
import { ConnectorError } from '../connectors/types';
import { forgetLeavers } from '../registers/facts';
import { recordConnectorRun } from '../connectors/runs';
import { CONNECTOR_BY_KEY } from '../connectors/catalog';
import { saveAiUse, registerChecks } from '../ai-use/store';
import { pullClaudeCode } from '../ai-use/anthropic';
import { pullGithubCopilot, pullM365Copilot } from '../ai-use/copilot';
import type { AiUseOutput } from '../ai-use/products';

/**
 * One sync of one organisation's connected systems: read each source, run its
 * checks, store the latest result of each, and — if the organisation has
 * begun its continuity record — take an observation so that a check going
 * from pass to fail lands in the hash-chained record with a date on it.
 */

const MAX_REPOS = 50;
const FIRST_PULL_DAYS = 30;
const PULL_DAYS = 7;

type IntegrationRow = typeof integrations.$inferSelect;

export type SyncOutcome = { provider: string; status: string; checks: number; error?: string };

async function inBatches<T, R>(items: T[], size: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  return out;
}

function links(i: IntegrationRow): Record<string, string> {
  const s = (i.settings ?? {}) as { links?: Record<string, string> };
  return s.links ?? {};
}

async function githubResults(i: IntegrationRow, declaredIds: Set<string>): Promise<{ results: CheckResult[]; settings: object }> {
  if (!githubAppConfigured()) throw new Error('The AIC GitHub App is not configured on this server.');
  if (!i.externalId) throw new Error('No GitHub installation is recorded for this connection.');
  const installation = await getInstallation(i.externalId);
  const token = await installationToken(i.externalId);
  const repos = (
    await paginate<Repo>('/installation/repositories?per_page=100', token, (b) => (b as { repositories: Repo[] }).repositories)
  ).filter((r) => !r.archived);

  const scanned = repos.slice(0, MAX_REPOS);
  const facts = await inBatches(scanned, 4, (r) => collectRepoFacts(r, token));
  const repoLinks = links(i);
  const results = facts.flatMap((f) => evaluateRepo(f, { link: repoLinks[f.repo.full_name], declaredSystemIds: declaredIds }));

  if (installation.account?.type === 'Organization') {
    results.push(evaluateOrg2fa(installation.account.login, await orgTwoFactorRequired(installation.account.login, token)));
  }
  return {
    results,
    settings: {
      ...((i.settings as object) ?? {}),
      repositories: scanned.map((r) => r.full_name),
      repositoriesTotal: repos.length,
      repositorySelection: installation.repository_selection,
      accountType: installation.account?.type ?? null,
    },
  };
}

async function providerResults(orgId: string, i: IntegrationRow, declared: { ids: Set<string>; names: Set<string> }): Promise<CheckResult[]> {
  const provider = i.provider as Provider;
  const db = getTenantDb(orgId);

  if (i.mode === 'api_key') {
    const key = EncryptionService.decrypt(i.secretCiphertext);
    if (!key || key === '[ENCRYPTED_DATA_UNREADABLE]') throw new Error('The stored key could not be read. Paste it again.');
    const rows = await pullUsage(provider, key, i.lastSyncedAt ? PULL_DAYS : FIRST_PULL_DAYS);
    await db.query(async (tx) => {
      for (const r of rows) {
        const values = {
          requests: r.requests,
          inputTokens: r.inputTokens,
          outputTokens: r.outputTokens,
          costUsd: r.costUsd === null ? null : r.costUsd.toFixed(4),
        };
        await tx
          .insert(llmUsageRecords)
          .values({
            orgId, provider, model: r.model, periodStart: r.periodStart, periodEnd: r.periodEnd,
            ...values, source: 'api_pull', ingestedVia: 'aic_pull',
          })
          .onConflictDoUpdate({
            target: [llmUsageRecords.orgId, llmUsageRecords.provider, llmUsageRecords.model, llmUsageRecords.periodStart, llmUsageRecords.periodEnd],
            set: values,
          });
      }
    });
  }

  const since = new Date(Date.now() - 35 * 86_400_000);
  const usage = await db.query((tx) =>
    tx
      .select({
        model: llmUsageRecords.model,
        systemName: llmUsageRecords.systemName,
        periodEnd: llmUsageRecords.periodEnd,
        inputTokens: llmUsageRecords.inputTokens,
        outputTokens: llmUsageRecords.outputTokens,
      })
      .from(llmUsageRecords)
      .where(and(eq(llmUsageRecords.orgId, orgId), eq(llmUsageRecords.provider, provider), gte(llmUsageRecords.periodEnd, since)))
  );

  return evaluateProvider({
    provider,
    connectedAt: i.createdAt,
    rows: usage.map((u) => ({
      model: u.model, systemName: u.systemName, periodEnd: u.periodEnd,
      tokens: Number(u.inputTokens ?? 0) + Number(u.outputTokens ?? 0),
    })),
    declaredSystemIds: declared.ids,
    declaredSystemNames: declared.names,
    links: links(i),
  });
}


/**
 * AI use read alongside a source's checks (lib/ai-use): stored, turned into
 * the register check, and summarised onto the connection so the page can say
 * what was read and what could not be. A failure here never fails the sync;
 * the checks the source exists for still land.
 */
async function recordAiUse(orgId: string, source: string, read: () => Promise<AiUseOutput>, systemNames: string[], now: Date): Promise<{ results: CheckResult[]; summary: object }> {
  let out: AiUseOutput;
  try {
    out = await read();
  } catch (e) {
    console.error(`[AI-USE] ${source}:`, (e as Error).message);
    return { results: [], summary: { at: now.toISOString(), readings: 0, notes: [`AI use could not be read this time: ${(e as Error).message}`] } };
  }
  const stored = await saveAiUse(orgId, source, out.records, now);
  const products = [...new Set(out.records.map((r) => r.product))];
  return {
    results: registerChecks(out.records, systemNames, now),
    summary: { at: now.toISOString(), readings: stored, products, notes: out.notes, facts: out.facts ?? null },
  };
}

const aiDays = (i: IntegrationRow) => (i.lastSyncedAt ? PULL_DAYS : FIRST_PULL_DAYS);

async function storeResults(orgId: string, integrationId: string, results: CheckResult[], now: Date) {
  const db = getTenantDb(orgId);
  await db.query(async (tx) => {
    const existing = await tx
      .select({ id: integrationChecks.id, checkKey: integrationChecks.checkKey, subject: integrationChecks.subject, status: integrationChecks.status, failingSince: integrationChecks.failingSince })
      .from(integrationChecks)
      .where(and(eq(integrationChecks.orgId, orgId), eq(integrationChecks.integrationId, integrationId)));
    const prior = new Map(existing.map((e) => [`${e.checkKey}|${e.subject}`, e]));
    const seen = new Set<string>();

    for (const r of results) {
      if (!CHECK_BY_KEY[r.checkKey]) continue;
      const k = `${r.checkKey}|${r.subject}`;
      seen.add(k);
      const before = prior.get(k);
      const failingSince = r.status === 'fail' ? (before?.status === 'fail' && before.failingSince ? before.failingSince : now) : null;
      await tx
        .insert(integrationChecks)
        .values({ orgId, integrationId, checkKey: r.checkKey, subject: r.subject, status: r.status, summary: r.summary, detail: r.detail ?? {}, failingSince, observedAt: now })
        .onConflictDoUpdate({
          target: [integrationChecks.orgId, integrationChecks.checkKey, integrationChecks.subject],
          set: { integrationId, status: r.status, summary: r.summary, detail: r.detail ?? {}, failingSince, observedAt: now },
        });
    }
    // A repository removed from the installation, or a model no longer used,
    // stops being checked. Its last result is not left behind looking current.
    for (const [k, e] of prior) if (!seen.has(k)) await tx.delete(integrationChecks).where(eq(integrationChecks.id, e.id));
  });
}

export async function syncOrg(orgId: string, actorLabel = 'AIC connector sync'): Promise<SyncOutcome[]> {
  const db = getTenantDb(orgId);
  const [rows, systems] = await db.query(async (tx) => [
    await tx.select().from(integrations).where(eq(integrations.orgId, orgId)),
    await tx.select({ id: aiSystems.id, name: aiSystems.name, isActive: aiSystems.isActive }).from(aiSystems).where(eq(aiSystems.orgId, orgId)),
  ] as const);

  const live = systems.filter((s) => s.isActive !== false);
  const declared = { ids: new Set(live.map((s) => s.id)), names: new Set(live.map((s) => s.name.trim().toLowerCase())) };
  const outcomes: SyncOutcome[] = [];
  const now = new Date();

  for (const i of rows) {
    // The demo company's connections are fixtures: there is nothing to reach.
    if (i.mode === 'demo') continue;
    if (i.status === 'disconnected') continue;
    try {
      let results: CheckResult[];
      let settings: object | undefined;
      let label: string | undefined;
      if (isConnector(i.provider)) {
        const impl = IMPLS[i.provider];
        const creds = credentialsOf(i);
        const ctx = await contextFor(orgId, i.provider);
        const out = await impl.run(creds, ctx);
        results = out.results;
        label = out.label;
        if (impl.people) {
          const people = await impl.people(creds, ctx);
          const counts = await importPeople(orgId, i.provider, people);
          settings = { ...((i.settings as object) ?? {}), people: people.length, peopleAdded: counts.added };
        }
        if (impl.accounts || impl.people) forgetLeavers(orgId);
      } else if (i.provider === 'github') {
        ({ results, settings } = await githubResults(i, declared.ids));
      } else if (i.provider === 'microsoft') {
        if (!microsoftConfigured()) throw new Error('The AIC Microsoft app is not configured on this server.');
        if (!i.externalId) throw new Error('No Microsoft tenant is recorded for this connection.');
        // Connected before the sign-in proof existed: the tenant in it came from
        // an address that could have been edited, so it is not read again until
        // an administrator reconnects and signs in.
        if (!tenantProven(i.settings)) throw new Error('Reconnect Microsoft 365 and sign in with an account from your organisation, so AIC can confirm the tenant is yours. Until then AIC does not read it.');
        const facts = await collectTenantFacts(i.externalId);
        const subject = facts.tenantName ?? i.accountLabel ?? i.externalId;
        results = evaluateTenant(subject, facts);
        settings = { ...((i.settings as object) ?? {}), tenantName: facts.tenantName, users: facts.users?.length ?? null };
      } else {
        results = await providerResults(orgId, i, declared);
      }

      // AI use inside this source, where it has any (lib/ai-use).
      const names = [...declared.names];
      let aiRead: (() => Promise<AiUseOutput>) | null = null;
      if (isConnector(i.provider) && IMPLS[i.provider].aiUse && CONNECTOR_BY_KEY[i.provider]?.ai) {
        const impl = IMPLS[i.provider];
        aiRead = async () => impl.aiUse!(credentialsOf(i), await contextFor(orgId, i.provider), aiDays(i));
      } else if (i.provider === 'anthropic' && i.mode === 'api_key') {
        aiRead = () => {
          const key = EncryptionService.decrypt(i.secretCiphertext);
          return pullClaudeCode(key, aiDays(i), now);
        };
      } else if (i.provider === 'github' && i.accountLabel && (settings as { accountType?: string } | undefined)?.accountType === 'Organization') {
        aiRead = async () => pullGithubCopilot(i.accountLabel!, await installationToken(i.externalId!), now);
      } else if (i.provider === 'microsoft' && i.externalId) {
        aiRead = () => pullM365Copilot(i.externalId!, now);
      }
      if (aiRead) {
        const ai = await recordAiUse(orgId, i.provider, aiRead, names, now);
        results = [...results, ...ai.results];
        settings = { ...((settings ?? i.settings ?? {}) as object), aiUse: ai.summary };
      }
      await storeResults(orgId, i.id, results, now);
      const waiting = i.mode === 'exporter' && results.some((r) => r.checkKey === 'ai.usage_fresh' && r.status === 'warn');
      await db.query((tx) =>
        tx.update(integrations)
          .set({ status: waiting ? 'pending' : 'active', lastSyncedAt: now, lastError: null, updatedAt: now, ...(settings ? { settings } : {}), ...(label ? { accountLabel: label.slice(0, 255) } : {}) })
          .where(eq(integrations.id, i.id))
      );
      outcomes.push({ provider: i.provider, status: 'ok', checks: results.length });
      if (isConnector(i.provider)) await recordConnectorRun(orgId, i.provider, 'ok', results, null, false);
    } catch (err) {
      const status = err instanceof GitHubError || err instanceof ProviderError || err instanceof MicrosoftError || err instanceof ConnectorError ? err.status : 0;
      const connector = isConnector(i.provider);
      // 404 on the installation, or 401/403 on a provider key, means access was
      // withdrawn on the other side — not a transient fault.
      const gone =
        (connector && status === 401) ||
        (i.provider === 'github' && status === 404) ||
        (i.provider === 'microsoft' && status === 403) ||
        (!connector && i.provider !== 'github' && i.provider !== 'microsoft' && (status === 401 || status === 403));
      const message = gone
        ? connector
          ? `${(err as Error).message} The credential may have been revoked or expired; connect again with a new one.`
          : i.provider === 'github'
          ? 'The AIC GitHub App was uninstalled or lost access. Reconnect to resume checks.'
          : i.provider === 'microsoft'
            ? 'Microsoft no longer lets AIC read this tenant. An administrator may have removed the AIC app; reconnect to resume checks.'
            : 'The provider rejected the stored key. It may have been revoked; paste a new one.'
        : (err as Error).message;
      await db.query(async (tx) => {
        await tx.update(integrations)
          .set({ status: gone ? 'disconnected' : 'error', lastError: message, updatedAt: now })
          .where(eq(integrations.id, i.id));
        if (gone) await tx.delete(integrationChecks).where(eq(integrationChecks.integrationId, i.id));
      });
      outcomes.push({ provider: i.provider, status: gone ? 'disconnected' : 'error', checks: 0, error: message });
      if (connector) await recordConnectorRun(orgId, i.provider, gone ? 'disconnected' : 'error', null, message, false);
    }
  }

  // Into the continuity record, but only for an organisation that has begun
  // one. Starting the record is the organisation's act ("Begin the record");
  // a background sync must not do it on their behalf.
  const [begun] = await db.query((tx) => tx.select({ orgId: estateSnapshots.orgId }).from(estateSnapshots).where(eq(estateSnapshots.orgId, orgId)).limit(1));
  if (begun && outcomes.some((o) => o.status === 'ok')) {
    try {
      await observeEstate(orgId, actorLabel);
    } catch (e) {
      console.error('[INTEGRATIONS] observation after sync failed:', (e as Error).message);
    }
  }
  return outcomes;
}

/** Every organisation with at least one live connection. For the nightly job. */
export async function orgsToSync(): Promise<string[]> {
  const rows = await getSystemDb().selectDistinct({ orgId: integrations.orgId }).from(integrations);
  return rows.map((r) => r.orgId);
}
