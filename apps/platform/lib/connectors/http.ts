/**
 * The HTTP pieces every connector uses: a JSON call with a timeout and a
 * readable error, Basic auth, and the date arithmetic the checks share.
 */
import { createHash, createHmac, createSign } from 'crypto';
import { ConnectorError } from './types';
import type { CheckResult, CheckStatus } from '../integrations/catalog';

export type CallInit = { method?: string; headers?: Record<string, string>; body?: unknown; form?: Record<string, string>; timeoutMs?: number; raw?: boolean };

/** Calls an API and returns parsed JSON (or text with `raw`). Throws ConnectorError with the status and the provider's own message. */
export async function call<T = unknown>(url: string, init: CallInit = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', 'User-Agent': 'AIC-Platform/1.0', ...(init.headers ?? {}) };
  let body: string | undefined;
  if (init.form) { body = new URLSearchParams(init.form).toString(); headers['Content-Type'] = 'application/x-www-form-urlencoded'; }
  else if (init.body !== undefined) { body = typeof init.body === 'string' ? init.body : JSON.stringify(init.body); headers['Content-Type'] ??= 'application/json'; }
  let res: Response;
  try {
    res = await fetch(url, { method: init.method ?? (body ? 'POST' : 'GET'), headers, body, signal: AbortSignal.timeout(init.timeoutMs ?? 20_000) });
  } catch (e) {
    throw new ConnectorError(0, `Could not reach ${new URL(url).host}: ${(e as Error).message}`);
  }
  const text = await res.text();
  if (!res.ok) throw new ConnectorError(res.status, `${new URL(url).host} answered ${res.status}: ${providerMessage(text)}`);
  if (init.raw) return text as T;
  if (!text) return {} as T;
  try { return JSON.parse(text) as T; } catch { return text as T; }
}

/** The useful part of an error body, whatever shape the provider uses. */
export function providerMessage(text: string): string {
  try {
    const j = JSON.parse(text) as Record<string, unknown>;
    const pick = (v: unknown): string | null => {
      if (!v) return null;
      if (typeof v === 'string') return v;
      if (Array.isArray(v)) return pick(v[0]);
      if (typeof v === 'object') {
        const o = v as Record<string, unknown>;
        return pick(o.message) ?? pick(o.errors) ?? pick(o.errorSummary) ?? pick(o.detail) ?? pick(o.error_description) ?? pick(o.title) ?? pick(o.error);
      }
      return null;
    };
    return (pick(j) ?? text).slice(0, 200);
  } catch {
    return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200) || 'no detail';
  }
}

export const basic = (user: string, pass: string) => `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;

/**
 * Trims a base URL the person pasted: no trailing slash, https assumed. Refuses
 * addresses inside a private network, so a connector cannot be pointed at
 * AIC's own infrastructure.
 */
export function baseUrl(v: string | undefined, fallback?: string): string {
  const s = (v ?? '').trim() || fallback || '';
  if (!s) throw new ConnectorError(400, 'A web address is missing.');
  const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  let u: URL;
  try { u = new URL(withScheme); } catch { throw new ConnectorError(400, `${s} is not a web address.`); }
  if (u.protocol !== 'https:') throw new ConnectorError(400, 'The address must start with https://');
  if (u.username || u.password) throw new ConnectorError(400, 'Leave the user name and password out of the address.');
  if (isPrivateHost(u.hostname) && process.env.NODE_ENV !== 'test') throw new ConnectorError(400, 'That address is on a private network. AIC can only reach systems on the internet.');
  return `${u.origin}${u.pathname.replace(/\/+$/, '')}`;
}

/** Loopback, private, link-local and single-label names. */
export function isPrivateHost(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, '').toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.internal') || h.endsWith('.local') || !h.includes('.') && !h.includes(':')) return true;
  const v4 = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  if (h.includes(':')) return h === '::1' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80') || h.startsWith('::ffff:');
  return false;
}

/** A required credential field, or a clear error naming it. */
export function need(creds: Record<string, string>, key: string, label = key): string {
  const v = (creds[key] ?? '').trim();
  if (!v) throw new ConnectorError(400, `${label} is missing.`);
  return v;
}

export const DAY = 86_400_000;
export const daysSince = (v: string | number | Date | null | undefined, now: Date) => (v === null || v === undefined || v === '' ? null : Math.floor((now.getTime() - new Date(v).getTime()) / DAY));

/** Builds a check result. Keeps every connector's output the same shape. */
export function result(checkKey: string, subject: string, status: CheckStatus, summary: string, detail?: Record<string, unknown>): CheckResult {
  return { checkKey, subject, status, summary, detail };
}

/** "3 people: a, b, c and 2 more" */
export function listSome(items: string[], n = 5): string {
  if (items.length <= n) return items.join(', ');
  return `${items.slice(0, n).join(', ')} and ${items.length - n} more`;
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Admin count rule shared by every "admins limited" check: more than `max` is too many; one is a single point of failure.
 * `what` is the plural ("super admins"), or [singular, plural] where dropping an s would read wrong.
 */
export function adminsCheck(checkKey: string, subject: string, admins: string[], what: string | [string, string], max = 3): CheckResult {
  const [one, many] = Array.isArray(what) ? what : [what.replace(/s$/, ''), what];
  const n = admins.length;
  if (n === 0) return result(checkKey, subject, 'unknown', `AIC could not see any ${many}. The credential may not be allowed to read roles.`);
  if (n > max) return result(checkKey, subject, 'fail', `${plural(n, one, many)}: ${listSome(admins)}. Keep it to ${max} or fewer.`, { admins });
  if (n === 1) return result(checkKey, subject, 'warn', `Only one ${one} (${admins[0]}). If that account is lost, nobody can manage it.`, { admins });
  return result(checkKey, subject, 'pass', `${plural(n, one, many)}: ${listSome(admins)}.`, { admins });
}

/** Stale account rule shared by connectors: enabled, created over 30 days ago, and not used in `days` days (or never). */
export function staleCheck(checkKey: string, subject: string, users: { name: string; lastActive: string | null; created?: string | null }[], now: Date, days = 90): CheckResult {
  const stale = users.filter((u) => {
    const created = daysSince(u.created ?? null, now);
    if (created !== null && created < 30) return false;
    const last = daysSince(u.lastActive, now);
    return last === null || last > days;
  });
  if (!users.length) return result(checkKey, subject, 'unknown', 'AIC could not read any accounts.');
  return stale.length
    ? result(checkKey, subject, 'fail', `${plural(stale.length, 'account')} not used in ${days} days: ${listSome(stale.map((s) => s.name))}.`, { stale: stale.map((s) => ({ name: s.name, lastActive: s.lastActive })) })
    : result(checkKey, subject, 'pass', `All ${plural(users.length, 'account')} used in the last ${days} days.`);
}

// ── Signed requests ─────────────────────────────────────────────────────────

/** A Google service-account access token (RS256 JWT bearer grant), optionally impersonating a Workspace user. */
export async function googleToken(serviceAccountJson: string, scopes: string[], subject?: string): Promise<{ token: string; projectId: string | null; clientEmail: string }> {
  let sa: { client_email?: string; private_key?: string; token_uri?: string; project_id?: string };
  try { sa = JSON.parse(serviceAccountJson); } catch { throw new ConnectorError(400, 'The service account key is not valid JSON. Paste the whole downloaded key file.'); }
  if (!sa.client_email || !sa.private_key) throw new ConnectorError(400, 'The key file has no client_email or private_key. Download a JSON key for the service account.');
  const now = Math.floor(Date.now() / 1000);
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const tokenUri = sa.token_uri || 'https://oauth2.googleapis.com/token';
  const unsigned = `${enc({ alg: 'RS256', typ: 'JWT' })}.${enc({ iss: sa.client_email, scope: scopes.join(' '), aud: tokenUri, iat: now, exp: now + 3600, ...(subject ? { sub: subject } : {}) })}`;
  const sig = createSign('RSA-SHA256').update(unsigned).sign(sa.private_key).toString('base64url');
  const j = await call<{ access_token: string }>(tokenUri, { form: { grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${sig}` } });
  return { token: j.access_token, projectId: sa.project_id ?? null, clientEmail: sa.client_email };
}

/** OAuth client-credentials token from any provider's token endpoint. */
export async function clientCredentials(tokenUrl: string, clientId: string, clientSecret: string, extra: Record<string, string> = {}, inBody = true): Promise<string> {
  const j = await call<{ access_token?: string }>(tokenUrl, inBody
    ? { form: { grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret, ...extra } }
    : { form: { grant_type: 'client_credentials', ...extra }, headers: { Authorization: basic(clientId, clientSecret) } });
  if (!j.access_token) throw new ConnectorError(401, 'The provider did not issue a token. Check the client id and secret.');
  return j.access_token;
}

/**
 * AWS Signature Version 4. Small on purpose: GET and POST against a single
 * service endpoint, which is all the read-only checks need.
 */
export function signAws(input: {
  method: string; url: string; region: string; service: string; body?: string; headers?: Record<string, string>;
  accessKeyId: string; secretAccessKey: string; sessionToken?: string; now?: Date;
}): Record<string, string> {
  const u = new URL(input.url);
  const now = input.now ?? new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const day = amzDate.slice(0, 8);
  const body = input.body ?? '';
  const hash = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
  const hmac = (k: Buffer | string, s: string) => createHmac('sha256', k).update(s, 'utf8').digest();
  const headers: Record<string, string> = { ...(input.headers ?? {}), host: u.host, 'x-amz-date': amzDate };
  // S3 and S3 Control require the payload hash as a header; the query APIs do not.
  if (input.service === 's3') headers['x-amz-content-sha256'] = hash(body);
  if (input.sessionToken) headers['x-amz-security-token'] = input.sessionToken;
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v).trim()]));
  const names = Object.keys(lower).sort();
  const canonicalQuery = [...u.searchParams.entries()]
    .map(([k, v]) => [encodeRfc3986(k), encodeRfc3986(v)])
    .sort(([a, x], [b, y]) => (a < b ? -1 : a > b ? 1 : x < y ? -1 : x > y ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`).join('&');
  const canonicalPath = u.pathname.split('/').map((s) => encodeRfc3986(decodeURIComponent(s))).join('/') || '/';
  const canonical = [input.method.toUpperCase(), canonicalPath, canonicalQuery, names.map((n) => `${n}:${lower[n]}\n`).join(''), names.join(';'), hash(body)].join('\n');
  const scope = `${day}/${input.region}/${input.service}/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, hash(canonical)].join('\n');
  const kSigning = hmac(hmac(hmac(hmac(`AWS4${input.secretAccessKey}`, day), input.region), input.service), 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(toSign, 'utf8').digest('hex');
  return { ...headers, Authorization: `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}` };
}

const encodeRfc3986 = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/** First match of a simple XML tag, or every match. Enough for the AWS query APIs' flat answers. */
export const xmlTag = (xml: string, tag: string): string | null => xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))?.[1] ?? null;
export const xmlAll = (xml: string, tag: string): string[] => [...xml.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g'))].map((m) => m[1]);

/** A small CSV reader for credential reports and similar exports: header row, commas, quoted fields. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; continue; }
    if (ch === '"') q = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (ch !== '\r') cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const [head, ...rest] = rows;
  return head ? rest.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? '']))) : [];
}
