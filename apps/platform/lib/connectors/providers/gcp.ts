/**
 * Google Cloud, read with a service account key (Viewer and Security Reviewer) exchanged for a read-only OAuth token.
 * Docs: https://cloud.google.com/resource-manager/reference/rest/v3/projects/getIamPolicy
 */
import { call, need, result, listSome, plural, googleToken } from '../http';
import { ConnectorError, type ConnectorImpl } from '../types';
import type { CheckResult } from '../../integrations/catalog';

type Binding = { role: string; members?: string[] };
type AuditConfig = { service: string; auditLogConfigs?: { logType: string }[] };
type Policy = { bindings?: Binding[]; auditConfigs?: AuditConfig[] };
type Bucket = { name: string; iamConfiguration?: { publicAccessPrevention?: string } };

const PERSONAL = new Set(['gmail.com', 'googlemail.com']);
const domainOf = (email: string) => email.split('@')[1]?.toLowerCase() ?? '';

function ownersCheck(subject: string, policy: Policy): CheckResult {
  const key = 'gcp.owners_limited';
  const members = (role: string) => (policy.bindings ?? []).filter((b) => b.role === role).flatMap((b) => b.members ?? []);
  const owners = [...new Set(members('roles/owner'))];
  const editors = [...new Set(members('roles/editor'))];
  const people = (list: string[]) => list.filter((m) => m.startsWith('user:') || m.startsWith('group:')).map((m) => m.slice(m.indexOf(':') + 1));
  const ownerUsers = owners.filter((m) => m.startsWith('user:')).map((m) => m.slice(5));
  const privileged = [...new Set([...people(owners), ...people(editors)])];

  // AIC does not know the organisation's domain, so the most common one among owners and editors is taken as theirs.
  const counts = new Map<string, number>();
  for (const p of privileged) { const d = domainOf(p); if (d && !PERSONAL.has(d)) counts.set(d, (counts.get(d) ?? 0) + 1); }
  const home = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
  const outside = privileged.filter((p) => PERSONAL.has(domainOf(p)) || (home !== null && domainOf(p) !== home));

  const problems: string[] = [];
  if (ownerUsers.length > 3) problems.push(`${plural(ownerUsers.length, 'person', 'people')} hold Owner: ${listSome(ownerUsers)}. Keep it to 3 or fewer.`);
  if (outside.length) problems.push(`${plural(outside.length, 'account')} from outside ${home ?? 'your domain'} ${outside.length === 1 ? 'holds' : 'hold'} Owner or Editor: ${listSome(outside)}.`);
  if (problems.length) return result(key, subject, 'fail', problems.join(' '), { owners: ownerUsers, outside, domain: home });
  if (!owners.length) return result(key, subject, 'unknown', 'Nobody holds Owner directly on the project. It may be granted on a folder or the organisation, which AIC cannot see from here.');
  if (ownerUsers.length === 1 && owners.length === 1) return result(key, subject, 'warn', `Only one person holds Owner (${ownerUsers[0]}). If that account is lost, nobody can manage the project.`, { owners: ownerUsers });
  return result(key, subject, 'pass', `${plural(owners.length, 'account')} ${owners.length === 1 ? 'holds' : 'hold'} Owner, all from ${home ?? 'your domain'}.`, { owners });
}

function auditCheck(subject: string, policy: Policy): CheckResult {
  const key = 'gcp.audit_logging';
  const all = (policy.auditConfigs ?? []).find((a) => a.service === 'allServices');
  const types = new Set((all?.auditLogConfigs ?? []).map((c) => c.logType));
  const missing = ['DATA_READ', 'DATA_WRITE'].filter((t) => !types.has(t)).map((t) => (t === 'DATA_READ' ? 'Data Read' : 'Data Write'));
  // Unverified: audit settings made on a folder or the organisation are inherited but do not appear in the project's policy.
  if (!missing.length) return result(key, subject, 'pass', 'Data Read and Data Write audit logs are on for all services.');
  const others = (policy.auditConfigs ?? []).filter((a) => a.service !== 'allServices').map((a) => a.service);
  return result(key, subject, 'fail', `${missing.join(' and ')} audit ${missing.length === 1 ? 'logging is' : 'logs are'} not on for all services${others.length ? `, only for ${listSome(others)}` : ''}.`, { missing, services: others });
}

async function bucketsCheck(subject: string, project: string, get: <T>(url: string) => Promise<T>): Promise<CheckResult> {
  const key = 'gcp.gcs_public_access_prevented';
  const buckets: Bucket[] = [];
  let pageToken: string | undefined;
  for (let i = 0; i < 20; i++) {
    const qs = new URLSearchParams({ project, maxResults: '1000', ...(pageToken ? { pageToken } : {}) });
    const page = await get<{ items?: Bucket[]; nextPageToken?: string }>(`https://storage.googleapis.com/storage/v1/b?${qs}`);
    buckets.push(...(page.items ?? []));
    pageToken = page.nextPageToken;
    if (!pageToken) break;
  }
  if (!buckets.length) return result(key, subject, 'pass', 'The project has no storage buckets.');
  const loose = buckets.filter((b) => b.iamConfiguration?.publicAccessPrevention !== 'enforced');
  const sample = loose.slice(0, 50);
  const open: string[] = [];
  const unread: string[] = [];
  for (const b of sample) {
    try {
      const iam = await get<{ bindings?: Binding[] }>(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(b.name)}/iam`);
      if ((iam.bindings ?? []).some((x) => (x.members ?? []).some((m) => m === 'allUsers' || m === 'allAuthenticatedUsers'))) open.push(b.name);
    } catch (e) {
      if (e instanceof ConnectorError && e.status === 401) throw e;
      unread.push(b.name);
    }
  }
  const more = loose.length > sample.length ? ` AIC checked ${sample.length} of the ${loose.length} buckets without enforcement.` : '';
  if (open.length) return result(key, subject, 'fail', `${plural(open.length, 'bucket is', 'buckets are')} open to the public: ${listSome(open)}.${more}`, { buckets: open });
  if (unread.length) return result(key, subject, 'unknown', `AIC could not read who has access to ${plural(unread.length, 'bucket')}: ${listSome(unread)}.${more}`, { unreadable: unread });
  return loose.length
    ? result(key, subject, 'pass', `No bucket is public. ${plural(loose.length, 'bucket does', 'buckets do')} not enforce public access prevention, so one could be opened later: ${listSome(loose.map((b) => b.name))}.${more}`, { notEnforced: loose.map((b) => b.name) })
    : result(key, subject, 'pass', `All ${plural(buckets.length, 'bucket')} enforce public access prevention.`);
}

export const gcp: ConnectorImpl = {
  async run(c) {
    const sa = need(c, 'serviceAccount', 'The service account key');
    const { token, projectId: keyProject } = await googleToken(sa, ['https://www.googleapis.com/auth/cloud-platform.read-only']);
    const project = (c.projectId ?? '').trim() || keyProject;
    if (!project) throw new ConnectorError(400, 'The project id is missing, and the key file does not name one.');
    const subject = project;
    const auth = { Authorization: `Bearer ${token}` };
    const get = <T>(url: string) => call<T>(url, { headers: auth });
    const results: CheckResult[] = [];

    let policy: Policy | null = null;
    let policyError = '';
    try {
      policy = await call<Policy>(`https://cloudresourcemanager.googleapis.com/v3/projects/${encodeURIComponent(project)}:getIamPolicy`, { method: 'POST', headers: auth, body: { options: { requestedPolicyVersion: 3 } } });
    } catch (e) {
      if (e instanceof ConnectorError && e.status === 401) throw e;
      policyError = (e as Error).message;
    }
    results.push(policy ? ownersCheck(subject, policy) : result('gcp.owners_limited', subject, 'unknown', `Could not read the project's access policy: ${policyError}`));

    try {
      results.push(await bucketsCheck(subject, project, get));
    } catch (e) {
      if (e instanceof ConnectorError && e.status === 401) throw e;
      results.push(result('gcp.gcs_public_access_prevented', subject, 'unknown', `Could not list storage buckets: ${(e as Error).message}`));
    }

    results.push(policy ? auditCheck(subject, policy) : result('gcp.audit_logging', subject, 'unknown', `Could not read the project's audit settings: ${policyError}`));
    return { results, label: project };
  },
};
