/**
 * Amazon Web Services, read with an IAM user's access key (SecurityAudit policy), every request signed with SigV4.
 * Docs: https://docs.aws.amazon.com/aws-managed-policy/latest/reference/SecurityAudit.html
 */
import { call, need, result, listSome, plural, daysSince, signAws, xmlTag, xmlAll, parseCsv, providerMessage } from '../http';
import { ConnectorError, type ConnectorImpl, type Credentials } from '../types';
import type { CheckResult } from '../../integrations/catalog';
import type { Account } from '../../registers/accounts';
import type { AiUseOutput, AiUseRecord } from '../../ai-use/products';

type Keys = { accessKeyId: string; secretAccessKey: string; region: string };
type Row = Record<string, string>;

const setup = (c: Credentials): Keys => ({
  accessKeyId: need(c, 'accessKeyId', 'The access key id'),
  secretAccessKey: need(c, 'secretAccessKey', 'The secret access key'),
  region: (c.region ?? '').trim() || 'us-east-1',
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Signs and sends one request. The host header is signed but left for fetch to set from the URL. */
function signed(k: Keys, method: string, url: string, region: string, service: string, body?: string, headers: Record<string, string> = {}) {
  const all = signAws({ method, url, region, service, body, headers, accessKeyId: k.accessKeyId, secretAccessKey: k.secretAccessKey });
  delete all.host;
  return all;
}

async function request(k: Keys, method: string, url: string, region: string, service: string, body?: string, headers: Record<string, string> = {}): Promise<string> {
  return call<string>(url, { method, headers: signed(k, method, url, region, service, body, headers), body, raw: true });
}

const iam = (k: Keys, action: string) => request(k, 'GET', `https://iam.amazonaws.com/?Action=${action}&Version=2010-05-08`, 'us-east-1', 'iam');

/** The account id, from STS. Needs no permissions, so any refusal means the key itself is wrong. */
async function accountId(k: Keys): Promise<string> {
  try {
    const xml = await request(k, 'POST', 'https://sts.amazonaws.com/', 'us-east-1', 'sts', 'Action=GetCallerIdentity&Version=2011-06-15', { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' });
    const id = xmlTag(xml, 'Account');
    if (!id) throw new ConnectorError(502, 'AWS did not say which account the key belongs to.');
    return id;
  } catch (e) {
    if (e instanceof ConnectorError && e.status === 403) throw new ConnectorError(401, `AWS did not accept the access key. ${e.message}`);
    throw e;
  }
}

/** The IAM credential report: asks AWS to build it, waits up to about ten seconds, then reads the CSV. */
async function credentialReport(k: Keys, waitMs = 2000): Promise<Row[]> {
  for (let i = 0; i < 6; i++) {
    const g = await iam(k, 'GenerateCredentialReport');
    if (xmlTag(g, 'State') === 'COMPLETE') {
      try {
        const r = await iam(k, 'GetCredentialReport');
        const content = xmlTag(r, 'Content');
        if (!content) throw new ConnectorError(502, 'AWS returned an empty credential report.');
        return parseCsv(Buffer.from(content.trim(), 'base64').toString('utf8'));
      } catch (e) {
        const notReady = e instanceof ConnectorError && (e.status === 410 || /ReportInProgress|ReportNotPresent|ReportExpired/.test(e.message));
        if (!notReady) throw e;
      }
    }
    if (i < 5) await sleep(waitMs);
  }
  throw new ConnectorError(504, 'AWS did not finish the credential report in time. Try again in a minute.');
}

/** Credential report dates: an ISO string, or N/A, no_information, not_supported. */
const when = (v: string | undefined) => (v && /^\d{4}-/.test(v) ? v : null);
const on = (v: string | undefined) => v === 'true';
const ROOT = '<root_account>';

function lastActive(r: Row): string | null {
  const dates = [r.password_last_used, r.access_key_1_last_used_date, r.access_key_2_last_used_date].map(when).filter((d): d is string => !!d);
  return dates.length ? dates.reduce((a, b) => (new Date(a) > new Date(b) ? a : b)) : null;
}

function mfaCheck(subject: string, rows: Row[]): CheckResult {
  const root = rows.find((r) => r.user === ROOT);
  const missing = rows.filter((r) => r.user !== ROOT && on(r.password_enabled) && !on(r.mfa_active)).map((r) => r.user);
  const rootMissing = root ? !on(root.mfa_active) : false;
  const offenders = [...(rootMissing ? ['the root account'] : []), ...missing];
  const consoleUsers = rows.filter((r) => r.user !== ROOT && on(r.password_enabled)).length;
  if (offenders.length) return result('aws.iam_users_mfa', subject, 'fail', `${plural(offenders.length, 'sign-in')} without a second factor: ${listSome(offenders)}.`, { offenders });
  if (!root) return result('aws.iam_users_mfa', subject, 'unknown', 'The credential report had no root account row, so AIC could not confirm it has a second factor.');
  return result('aws.iam_users_mfa', subject, 'pass', `The root account and all ${plural(consoleUsers, 'console user')} have a second factor.`);
}

function staleCredentialsCheck(subject: string, rows: Row[], now: Date): CheckResult {
  const stale: { name: string; lastUsed: string | null }[] = [];
  const old = (lastUsed: string | null, created: string | null) => {
    const used = daysSince(lastUsed, now);
    if (used !== null) return used > 90;
    const age = daysSince(created, now);
    return age === null || age > 90;
  };
  let checked = 0;
  for (const r of rows) {
    const isRoot = r.user === ROOT;
    const name = isRoot ? 'root account' : r.user;
    if (!isRoot && on(r.password_enabled)) {
      checked++;
      if (old(when(r.password_last_used), when(r.user_creation_time))) stale.push({ name: `${name} password`, lastUsed: when(r.password_last_used) });
    }
    for (const n of [1, 2]) {
      if (!on(r[`access_key_${n}_active`])) continue;
      checked++;
      const used = when(r[`access_key_${n}_last_used_date`]);
      if (old(used, when(r[`access_key_${n}_last_rotated`]))) stale.push({ name: `${name} access key ${n}`, lastUsed: used });
    }
  }
  if (!checked) return result('aws.stale_credentials', subject, 'pass', 'No passwords or active access keys to check.');
  return stale.length
    ? result('aws.stale_credentials', subject, 'fail', `${plural(stale.length, 'password or access key', 'passwords or access keys')} not used in 90 days: ${listSome(stale.map((s) => s.name))}.`, { stale })
    : result('aws.stale_credentials', subject, 'pass', `All ${plural(checked, 'password and access key', 'passwords and access keys')} used in the last 90 days.`);
}

const FLAGS = ['BlockPublicAcls', 'IgnorePublicAcls', 'BlockPublicPolicy', 'RestrictPublicBuckets'];
const allOn = (xml: string) => FLAGS.every((f) => xmlTag(xml, f) === 'true');

/** One bucket's public access block: true, false, or null when it could not be read. Follows a region redirect once. */
async function bucketBlocked(k: Keys, bucket: string): Promise<boolean | null> {
  const urlFor = (region: string | null) => {
    const host = region ? `s3.${region}.amazonaws.com` : 's3.amazonaws.com';
    // Dotted names break the wildcard certificate, so they use path style.
    return bucket.includes('.') ? `https://${host}/${bucket}?publicAccessBlock` : `https://${bucket}.${host}/?publicAccessBlock`;
  };
  let region: string | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const url = urlFor(region);
    const res: Response = await fetch(url, { headers: signed(k, 'GET', url, region ?? 'us-east-1', 's3'), redirect: 'manual', signal: AbortSignal.timeout(20_000) });
    const text = await res.text();
    if (res.ok) return allOn(text);
    if (res.status === 404 && /NoSuchPublicAccessBlockConfiguration/.test(text)) return false;
    const elsewhere: string | null = res.headers.get('x-amz-bucket-region') ?? xmlTag(text, 'Region');
    if (attempt === 0 && elsewhere && elsewhere !== (region ?? 'us-east-1') && [301, 307, 400].includes(res.status)) { region = elsewhere; continue; }
    if (res.status === 401) throw new ConnectorError(401, `S3 answered 401: ${providerMessage(text)}`);
    return null;
  }
  return null;
}

async function s3Check(k: Keys, subject: string, id: string): Promise<CheckResult> {
  const key = 'aws.s3_public_access_blocked';
  let accountLevel: 'on' | 'partial' | 'none' = 'none';
  try {
    const xml = await request(k, 'GET', `https://${id}.s3-control.${k.region}.amazonaws.com/v20180820/configuration/publicAccessBlock`, k.region, 's3', undefined, { 'x-amz-account-id': id });
    accountLevel = allOn(xml) ? 'on' : 'partial';
  } catch (e) {
    if (!(e instanceof ConnectorError && (e.status === 404 || /NoSuchPublicAccessBlockConfiguration/.test(e.message)))) {
      if (e instanceof ConnectorError && e.status === 401) throw e;
      return result(key, subject, 'unknown', `Could not read the account's S3 public access settings: ${(e as Error).message}`);
    }
  }
  if (accountLevel === 'on') return result(key, subject, 'pass', 'All four public access blocks are on for the whole account.');

  let buckets: string[];
  try {
    buckets = xmlAll(await request(k, 'GET', 'https://s3.amazonaws.com/', 'us-east-1', 's3'), 'Name');
  } catch (e) {
    return result(key, subject, 'unknown', `The account-level public access block is not fully on, and AIC could not list buckets: ${(e as Error).message}`);
  }
  const lead = accountLevel === 'partial' ? 'The account-level public access block is only partly on' : 'There is no account-level public access block';
  if (!buckets.length) return result(key, subject, 'warn', `${lead}. There are no buckets yet, but a new one could be made public.`);
  const sample = buckets.slice(0, 50);
  const open: string[] = [];
  const unread: string[] = [];
  for (const b of sample) {
    const ok = await bucketBlocked(k, b);
    if (ok === false) open.push(b);
    else if (ok === null) unread.push(b);
  }
  const more = buckets.length > sample.length ? ` AIC checked the first ${sample.length} of ${buckets.length} buckets.` : '';
  if (open.length) return result(key, subject, 'fail', `${lead}, and ${plural(open.length, 'bucket does', 'buckets do')} not block public access: ${listSome(open)}.${more}`, { buckets: open, unreadable: unread });
  if (unread.length) return result(key, subject, 'unknown', `${lead}, and AIC could not read the settings of ${plural(unread.length, 'bucket')}: ${listSome(unread)}.${more}`, { unreadable: unread });
  return result(key, subject, 'pass', `${lead}, but every bucket blocks public access on its own.${more}`);
}

type Trail = { Name: string; TrailARN: string; HomeRegion?: string; IsMultiRegionTrail?: boolean; LogFileValidationEnabled?: boolean; IsOrganizationTrail?: boolean };

async function cloudTrail(k: Keys, region: string, op: string, body: unknown) {
  const text = JSON.stringify(body);
  const url = `https://cloudtrail.${region}.amazonaws.com/`;
  const headers = { 'Content-Type': 'application/x-amz-json-1.1', 'X-Amz-Target': `com.amazonaws.cloudtrail.v20131101.CloudTrail_20131101.${op}` };
  return call<Record<string, unknown>>(url, { method: 'POST', headers: signed(k, 'POST', url, region, 'cloudtrail', text, headers), body: text });
}

async function cloudTrailCheck(k: Keys, subject: string): Promise<CheckResult> {
  const key = 'aws.cloudtrail_enabled';
  let trails: Trail[];
  try {
    trails = ((await cloudTrail(k, k.region, 'DescribeTrails', { includeShadowTrails: true })).trailList as Trail[] | undefined) ?? [];
  } catch (e) {
    if (e instanceof ConnectorError && e.status === 401) throw e;
    return result(key, subject, 'unknown', `Could not read CloudTrail: ${(e as Error).message}`);
  }
  const multi = trails.filter((t) => t.IsMultiRegionTrail);
  if (!multi.length) {
    return result(key, subject, 'fail', trails.length
      ? `No trail covers every region. ${plural(trails.length, 'trail')} log only one region: ${listSome(trails.map((t) => t.Name))}.`
      : 'There is no CloudTrail trail, so nothing records who changed what.');
  }
  const logging: Trail[] = [];
  const unread: Trail[] = [];
  for (const t of multi.slice(0, 10)) {
    try {
      const s = await cloudTrail(k, t.HomeRegion || k.region, 'GetTrailStatus', { Name: t.TrailARN });
      if (s.IsLogging === true) logging.push(t);
    } catch {
      // Organisation trails can refuse member accounts; report as unconfirmed rather than off.
      unread.push(t);
    }
  }
  if (!logging.length) {
    return unread.length
      ? result(key, subject, 'warn', `AIC could not confirm that the all-region ${plural(unread.length, 'trail')} ${listSome(unread.map((t) => t.Name))} ${unread.length === 1 ? 'is' : 'are'} logging.`)
      : result(key, subject, 'fail', `The all-region ${plural(multi.length, 'trail')} ${listSome(multi.map((t) => t.Name))} ${multi.length === 1 ? 'is' : 'are'} switched off.`);
  }
  const good = logging.find((t) => t.LogFileValidationEnabled);
  return good
    ? result(key, subject, 'pass', `The trail ${good.Name} logs every region, with log file validation on.`)
    : result(key, subject, 'warn', `The trail ${logging[0].Name} logs every region, but log file validation is off, so tampering with the logs would go unnoticed.`);
}

// ── Amazon Bedrock ──────────────────────────────────────────────────────────
//
// Bedrock publishes Invocations, InputTokenCount and OutputTokenCount to
// CloudWatch under AWS/Bedrock, per ModelId. There is no person in these
// figures: a row is a model in a region on a day. Needs cloudwatch:ListMetrics
// and cloudwatch:GetMetricData (CloudWatchReadOnlyAccess has both).
// Docs: https://docs.aws.amazon.com/bedrock/latest/userguide/monitoring-runtime-metrics.html

const BEDROCK_REGIONS = ['us-east-1', 'us-west-2', 'eu-central-1', 'eu-west-1', 'eu-west-3', 'ap-southeast-2', 'ap-northeast-1', 'ap-south-1'];
const BEDROCK_METRICS = ['Invocations', 'InputTokenCount', 'OutputTokenCount'] as const;

const cw = (k: Keys, region: string, params: Record<string, string>) => {
  const body = new URLSearchParams({ Version: '2010-08-01', ...params }).toString();
  return request(k, 'POST', `https://monitoring.${region}.amazonaws.com/`, region, 'monitoring', body, { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' });
};

/** Model ids with Bedrock invocations in this region over the last two weeks (CloudWatch keeps listing metrics that long). */
export function parseModelIds(xml: string): string[] {
  const ids = new Set<string>();
  for (const dims of xmlAll(xml, 'Dimensions')) {
    const names = xmlAll(dims, 'Name');
    const values = xmlAll(dims, 'Value');
    names.forEach((n, i) => { if (n === 'ModelId' && values[i]) ids.add(values[i]); });
  }
  return [...ids];
}

/** GetMetricData's answer: per query id, the daily timestamps and values. */
export function parseMetricData(xml: string): Map<string, { day: string; value: number }[]> {
  const out = new Map<string, { day: string; value: number }[]>();
  const results = xmlTag(xml, 'MetricDataResults') ?? '';
  for (const chunk of results.split('<Id>').slice(1)) {
    const id = chunk.slice(0, chunk.indexOf('</Id>'));
    const times = xmlAll(xmlTag(chunk, 'Timestamps') ?? '', 'member');
    const values = xmlAll(xmlTag(chunk, 'Values') ?? '', 'member').map(Number);
    out.set(id, times.map((t, i) => ({ day: t.slice(0, 10), value: values[i] ?? 0 })));
  }
  return out;
}

async function bedrockUse(k: Keys, days: number, now: Date): Promise<AiUseOutput> {
  const records: AiUseRecord[] = [];
  const notes: string[] = [];
  const regions = [...new Set([k.region, ...BEDROCK_REGIONS])];
  let refused = 0;
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(end.getTime() - days * 86_400_000);
  for (const region of regions) {
    let models: string[];
    try {
      models = parseModelIds(await cw(k, region, { Action: 'ListMetrics', Namespace: 'AWS/Bedrock', MetricName: 'Invocations' }));
    } catch (e) {
      if (e instanceof ConnectorError && (e.status === 401 || e.status === 403)) refused++;
      continue; // a region not enabled for the account answers with an error; nothing runs there
    }
    if (!models.length) continue;
    const params: Record<string, string> = { Action: 'GetMetricData', StartTime: start.toISOString(), EndTime: end.toISOString() };
    let q = 0;
    const ids: { id: string; model: string; metric: string }[] = [];
    for (const [mi, model] of models.slice(0, 50).entries()) {
      for (const metric of BEDROCK_METRICS) {
        q++;
        const id = `m${mi}_${metric.toLowerCase()}`;
        ids.push({ id, model, metric });
        const p = `MetricDataQueries.member.${q}`;
        Object.assign(params, {
          [`${p}.Id`]: id,
          [`${p}.MetricStat.Metric.Namespace`]: 'AWS/Bedrock',
          [`${p}.MetricStat.Metric.MetricName`]: metric,
          [`${p}.MetricStat.Metric.Dimensions.member.1.Name`]: 'ModelId',
          [`${p}.MetricStat.Metric.Dimensions.member.1.Value`]: model,
          [`${p}.MetricStat.Period`]: '86400',
          [`${p}.MetricStat.Stat`]: 'Sum',
          [`${p}.ReturnData`]: 'true',
        });
      }
    }
    let data: Map<string, { day: string; value: number }[]>;
    try { data = parseMetricData(await cw(k, region, params)); } catch (e) {
      if (e instanceof ConnectorError && (e.status === 401 || e.status === 403)) { refused++; continue; }
      throw e;
    }
    const rows = new Map<string, AiUseRecord>();
    for (const { id, model, metric } of ids) {
      for (const { day, value } of data.get(id) ?? []) {
        const key = `${model}|${day}`;
        const r = rows.get(key) ?? { product: 'aws_bedrock' as const, subjectType: 'model' as const, subject: `${model} (${region})`, day, lastActiveAt: `${day}T00:00:00Z`, activity: 0, metrics: { region, inputTokens: 0, outputTokens: 0 } };
        if (metric === 'Invocations') r.activity += value;
        else if (metric === 'InputTokenCount') (r.metrics as Record<string, number>).inputTokens += value;
        else (r.metrics as Record<string, number>).outputTokens += value;
        rows.set(key, r);
      }
    }
    records.push(...[...rows.values()].filter((r) => r.activity > 0));
  }
  if (refused && !records.length) notes.push('Amazon Bedrock: the AWS key cannot read CloudWatch metrics. Attach CloudWatchReadOnlyAccess to the AIC user, or allow cloudwatch:ListMetrics and cloudwatch:GetMetricData.');
  return { records, notes };
}

export const aws: ConnectorImpl = {
  async run(c, ctx) {
    const k = setup(c);
    const id = await accountId(k);
    const results: CheckResult[] = [];

    let rows: Row[] | null = null;
    let reportError = '';
    try { rows = await credentialReport(k); } catch (e) {
      if (e instanceof ConnectorError && e.status === 401) throw e;
      reportError = (e as Error).message;
    }
    if (rows) {
      results.push(mfaCheck(id, rows));
      results.push(staleCredentialsCheck(id, rows, ctx.now));
    } else {
      results.push(result('aws.iam_users_mfa', id, 'unknown', `Could not read the IAM credential report: ${reportError}`));
      results.push(result('aws.stale_credentials', id, 'unknown', `Could not read the IAM credential report: ${reportError}`));
    }
    results.push(await s3Check(k, id, id));
    results.push(await cloudTrailCheck(k, id));
    return { results, label: id };
  },

  async aiUse(c, ctx, days) {
    return bedrockUse(setup(c), Math.min(days, 14), ctx.now);
  },

  async accounts(c) {
    const k = setup(c);
    const rows = await credentialReport(k);
    return rows.filter((r) => r.user !== ROOT).map((r): Account => ({
      system: 'AWS', account: r.user, displayName: null, privilege: null, lastActiveAt: lastActive(r),
      enabled: on(r.password_enabled) || on(r.access_key_1_active) || on(r.access_key_2_active),
    }));
  },
};
