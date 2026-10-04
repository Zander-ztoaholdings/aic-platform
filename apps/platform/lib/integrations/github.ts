import { createSign } from 'crypto';

/**
 * AIC's GitHub App: authentication and the handful of read-only calls the
 * checks need.
 *
 * HOW ACCESS WORKS, because it is the whole trust story. The organisation
 * installs AIC's App on the repositories it picks, with read-only permissions.
 * AIC never receives a GitHub password, personal token or OAuth token from
 * them. To read, AIC signs a ten-minute JWT with its own App private key and
 * exchanges it for a one-hour installation token scoped to that installation.
 * Nothing about the installation is stored except its id. Uninstalling the App
 * on GitHub ends access immediately; the next sync sees a 404 and marks the
 * connection disconnected.
 *
 * Required App permissions (repository, all read-only): Metadata, Contents,
 * Pull requests, Administration, Dependabot alerts, Secret scanning alerts.
 * Organisation: Administration (read) for the two-factor check. Any the
 * organisation declines simply make the affected check "unknown".
 *
 * Environment:
 *   GITHUB_APP_ID           numeric App id
 *   GITHUB_APP_SLUG         the App's URL name, for the install link
 *   GITHUB_APP_PRIVATE_KEY  PEM; literal "\n" sequences are accepted
 *   GITHUB_API_URL          optional, defaults to https://api.github.com
 */

export const GITHUB_API = () => (process.env.GITHUB_API_URL || 'https://api.github.com').replace(/\/$/, '');

export function githubAppConfigured(): boolean {
  return !!(process.env.GITHUB_APP_ID && process.env.GITHUB_APP_SLUG && process.env.GITHUB_APP_PRIVATE_KEY);
}

export function installUrl(state: string): string {
  const slug = process.env.GITHUB_APP_SLUG;
  return `https://github.com/apps/${slug}/installations/new?state=${encodeURIComponent(state)}`;
}

const b64url = (b: Buffer | string) =>
  Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

/** The App JWT. Backdated 60s for clock drift; GitHub caps the life at 10 minutes. */
export function appJwt(appId: string, privateKeyPem: string, now = Math.floor(Date.now() / 1000)): string {
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({ iat: now - 60, exp: now + 540, iss: appId }));
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  const sig = b64url(signer.sign(privateKeyPem.replace(/\\n/g, '\n')));
  return `${header}.${payload}.${sig}`;
}

export class GitHubError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function gh(path: string, token: string, init: RequestInit = {}): Promise<Response> {
  const url = path.startsWith('http') ? path : `${GITHUB_API()}${path}`;
  return fetch(url, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'aic-platform',
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(20_000),
  });
}

function appToken(): string {
  return appJwt(process.env.GITHUB_APP_ID!, process.env.GITHUB_APP_PRIVATE_KEY!);
}

export type Installation = {
  id: number;
  account: { login: string; type: 'User' | 'Organization' } | null;
  repository_selection: 'all' | 'selected';
};

/** Read an installation as the App. 404 means it no longer exists. */
export async function getInstallation(installationId: string): Promise<Installation> {
  const res = await gh(`/app/installations/${installationId}`, appToken());
  if (!res.ok) throw new GitHubError(res.status, `GitHub returned ${res.status} for the installation.`);
  return res.json();
}

export async function installationToken(installationId: string): Promise<string> {
  const res = await gh(`/app/installations/${installationId}/access_tokens`, appToken(), { method: 'POST' });
  if (!res.ok) throw new GitHubError(res.status, `GitHub refused an installation token (${res.status}).`);
  const body = (await res.json()) as { token: string };
  return body.token;
}

/** A GET that tells the caller apart: data, not found, or not permitted. */
export type Probe<T> = { ok: true; data: T } | { ok: false; status: number };

export async function probe<T>(path: string, token: string): Promise<Probe<T>> {
  const res = await gh(path, token);
  if (res.ok) return { ok: true, data: (await res.json()) as T };
  return { ok: false, status: res.status };
}

/** Follows Link: rel="next" up to a page cap. Lists only. */
export async function paginate<T>(path: string, token: string, pick: (body: unknown) => T[], maxPages = 5): Promise<T[]> {
  const out: T[] = [];
  let next: string | null = path;
  for (let i = 0; next && i < maxPages; i++) {
    const res = await gh(next, token);
    if (!res.ok) throw new GitHubError(res.status, `GitHub returned ${res.status} for ${next}`);
    out.push(...pick(await res.json()));
    const link = res.headers.get('link') ?? '';
    const m = link.match(/<([^>]+)>;\s*rel="next"/);
    next = m ? m[1] : null;
  }
  return out;
}

// ── Shapes AIC reads ────────────────────────────────────────────────────────

export type Repo = {
  full_name: string;
  name: string;
  default_branch: string;
  archived: boolean;
  private: boolean;
  owner: { login: string; type: string };
};

export type BranchProtection = {
  required_pull_request_reviews?: { required_approving_review_count?: number } | null;
  allow_force_pushes?: { enabled: boolean } | null;
};

export type BranchRule = { type: string; parameters?: { required_approving_review_count?: number } };

export type PullRequest = {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  merged_at: string | null;
  user: { login: string; type: string } | null;
};

export type Review = { state: string; user: { login: string; type: string } | null };

export type SbomPackage = { name?: string; externalRefs?: { referenceLocator?: string }[] };

/**
 * Everything the GitHub checks need about one repository, gathered with the
 * smallest set of calls. A field is null when GitHub would not tell us (the
 * permission was not granted or the feature is off) — evaluation turns that
 * into "unknown", never into a pass.
 */
export type RepoFacts = {
  repo: Repo;
  protection: BranchProtection | null;
  protectionStatus: 'protected' | 'unprotected' | 'unknown';
  rules: BranchRule[] | null;
  mergedPulls: (PullRequest & { reviews: Review[] })[] | null;
  openSevereVulnerabilities: number | null;
  openSecretAlerts: number | null;
  packages: string[] | null;
};

const PR_WINDOW_DAYS = 30;
const MAX_PRS_REVIEWED = 30;

export async function collectRepoFacts(repo: Repo, token: string, now = Date.now()): Promise<RepoFacts> {
  const base = `/repos/${repo.full_name}`;
  const branch = encodeURIComponent(repo.default_branch);

  const [protection, rules, pulls, vulns, secrets, sbom] = await Promise.all([
    probe<BranchProtection>(`${base}/branches/${branch}/protection`, token),
    probe<BranchRule[]>(`${base}/rules/branches/${branch}`, token),
    probe<PullRequest[]>(`${base}/pulls?state=closed&sort=updated&direction=desc&per_page=50`, token),
    probe<unknown[]>(`${base}/dependabot/alerts?state=open&severity=critical,high&per_page=100`, token),
    probe<unknown[]>(`${base}/secret-scanning/alerts?state=open&per_page=100`, token),
    probe<{ sbom?: { packages?: SbomPackage[] } }>(`${base}/dependency-graph/sbom`, token),
  ]);

  let mergedPulls: RepoFacts['mergedPulls'] = null;
  if (pulls.ok) {
    const since = now - PR_WINDOW_DAYS * 86_400_000;
    const recent = pulls.data
      .filter((p) => p.merged_at && new Date(p.merged_at).getTime() >= since)
      .slice(0, MAX_PRS_REVIEWED);
    mergedPulls = await Promise.all(
      recent.map(async (p) => {
        const r = await probe<Review[]>(`${base}/pulls/${p.number}/reviews?per_page=100`, token);
        return { ...p, reviews: r.ok ? r.data : [] };
      })
    );
  }

  return {
    repo,
    protection: protection.ok ? protection.data : null,
    // 404 from this endpoint means "Branch not protected". 403 means AIC was
    // not given Administration: read, so it genuinely cannot say.
    protectionStatus: protection.ok ? 'protected' : protection.status === 404 ? 'unprotected' : 'unknown',
    rules: rules.ok ? rules.data : null,
    mergedPulls,
    openSevereVulnerabilities: vulns.ok ? vulns.data.length : null,
    openSecretAlerts: secrets.ok ? secrets.data.length : null,
    packages: sbom.ok ? packageNames(sbom.data.sbom?.packages ?? []) : null,
  };
}

/** "pkg:npm/%40anthropic-ai/sdk@0.30.0" → "npm:@anthropic-ai/sdk". */
export function packageNames(pkgs: SbomPackage[]): string[] {
  const names = new Set<string>();
  for (const p of pkgs) {
    const purl = p.externalRefs?.map((r) => r.referenceLocator).find((l) => l?.startsWith('pkg:'));
    if (purl) {
      const m = purl.match(/^pkg:([^/]+)\/(.+?)(?:@[^@]*)?$/);
      if (m) {
        names.add(`${m[1].toLowerCase()}:${decodeURIComponent(m[2]).toLowerCase()}`);
        continue;
      }
    }
    if (p.name) names.add(p.name.toLowerCase());
  }
  return [...names];
}

export async function orgTwoFactorRequired(login: string, token: string): Promise<boolean | null> {
  const r = await probe<{ two_factor_requirement_enabled?: boolean | null }>(`/orgs/${encodeURIComponent(login)}`, token);
  if (!r.ok) return null;
  const v = r.data.two_factor_requirement_enabled;
  return typeof v === 'boolean' ? v : null;
}
