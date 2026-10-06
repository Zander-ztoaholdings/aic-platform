# Running AIC in production

What has to be switched on, by hand, for the October 2026 professional-standards work to take effect. Each section says what to do, how to check it worked, and what happens if you skip it. Work top to bottom; the order matters for the first three.

Related: `docs/STAGING.md` (staging and releases), `docs/INTEGRATIONS.md` (GitHub, Microsoft 365 and AI providers), `docs/INCIDENT-RESPONSE.md` (when something goes wrong), `docs/legal/DATA-PROCESSING-AGREEMENT-DRAFT.md` (for the lawyer).

## 1. Database migrations

011 to 013 were applied on 5 October 2026.

**014 (trust pages, questionnaires, AI budget, decision review) must be applied before the code that uses it is deployed.** Drizzle names every column of a table in its queries, so the new platform build fails on the decision log, organisations and every client page until 014 is in. 014 is additive, so the old build keeps working once it is applied. Order: run 014, then push.

Paste `db/manual/run-014-in-platform-terminal.txt` into **Coolify → aic-platform → Terminal**. It ends with `✓ 014 verified`. Safe to run twice.

**015 (frameworks)** adds the tables for choosing frameworks and writing custom ones. Nothing existing reads them, so it can go in before or after the push; until it is in, the Frameworks page says the choice cannot be saved and Controls shows the default frameworks. Paste `db/manual/run-015-in-platform-terminal.txt` the same way; it ends with `✓ 015 verified`.

**016 (risk and people)** adds the supplier register, risk register, training records, access reviews and the people list. Nothing existing depends on them: until it is in, those five pages say the migration is needed and the matching controls show no evidence. Paste `db/manual/run-016-in-platform-terminal.txt` the same way; it ends with `✓ 016 verified`. Rebuild the demo company afterwards (Admin, Demo company) so it has the registers filled in.

**017 (tools and markets)** adds the agent runtime (agents, agent_runs, agent_run_steps), model trials, supplier document reads, connector run history and the HQ markets tracker (seeded with South Africa live, Botswana and Mauritius mapped). Nothing existing depends on it: until it is in, Agents, Markets, Connector health and supplier documents say the migration is needed. Paste `db/manual/run-017-in-platform-terminal.txt` the same way; it ends with `✓ 017 verified`.

**Check:** `/api/health` shows `schema: ok` and names the newest migration applied.

## 2. Tenant isolation (row-level security)

Done on 5 October 2026. Migration 008 created a database role, `aic_tenant`, that cannot read another organisation's rows; the platform uses it through `TENANT_DATABASE_URL` (same host and database as `DATABASE_URL`, user `aic_tenant`).

**Check:** `/api/health` shows `tenant_isolation: ok, enforced (signed in as aic_tenant)`. The check actually signs in, so a wrong password shows as `tenant role cannot sign in: 28P01 …` rather than a false green.

**If the password and the variable ever disagree** (every client page shows the System Error screen and the log says `password authentication failed for user "aic_tenant"`): paste `db/manual/fix-tenant-password-in-platform-terminal.txt` into the aic-platform terminal. It sets the role's password to exactly what `TENANT_DATABASE_URL` contains and tests the login, without printing it. No redeploy needed.

**Changing the owner (`postgres`) password:** edit every variable that carries it first (on 5 October: `DATABASE_URL` and `POSTGRES_URL` on aic-platform and aic-web, Prod and Preview), then run `ALTER ROLE postgres WITH PASSWORD '…'` in the Postgres terminal with the value copied from one of those variables, then redeploy aic-platform and aic-web straight away, then update the password field on the Postgres resource in Coolify so its backups keep working.

## 3. Encryption key

Provider keys, MFA secrets and exam answers are encrypted with AES-256-GCM. The key must be 32 random bytes, not a passphrase.

1. Generate one: `openssl rand -hex 32`. Store it in the password manager under "AIC ENCRYPTION_KEY". If it is lost, everything encrypted with it is lost too.
2. Set `ENCRYPTION_KEY` on aic-platform and redeploy.
3. Re-encrypt what was stored under the old scheme. In the container, first `npx tsx scripts/reencrypt.ts --dry-run`, read the counts, then run it without `--dry-run`.

**Rotating later:** set `ENCRYPTION_KEYS="k2:<new hex>,k1:<old hex>"` (newest first), redeploy, run `scripts/reencrypt.ts`, and remove `k1` once it reports nothing left on the old key. Every stored value names the key it was written with, so old values stay readable during the change.

If the key is set to something that is not 64 hex characters or base64 of 32 bytes, the app still works but logs a warning and derives a key from it; fix that rather than ignore it.

## 4. Rate limiting through Redis

Login, password reset, sign-up, invites and the public endpoints are rate-limited. Without Redis each app instance counts separately and the count resets on every deploy.

The limiter uses the same `REDIS_URL` as the event bus, which should already be set on aic-platform; confirm it is there and points at the Redis service's internal URL. No migration is needed. If Redis goes down, the app falls back to counting in memory rather than refusing requests.

## 5. Backups and the restore test

As of 5 October 2026 production had **no backups at all**. Production runs Postgres 18 (`pgvector/pgvector:pg18`), so any `pg_dump` / `pg_restore` you use must be version 18 or newer.

**Today, in Coolify (ten minutes, no server access needed).**

1. Create a bucket at Backblaze B2 or Cloudflare R2, with an application key limited to that bucket.
2. In Coolify, **Storages → Add S3 storage**, enter the endpoint, bucket, key and secret, and press **Validate**.
3. Open the Postgres resource → **Backups → Add scheduled backup**: frequency `30 2 * * *` (02:30 UTC), tick **Save to S3** with that storage, keep 30 locally and 30 in S3. Save, then press **Backup now** once and check the file appears in the bucket.

That gives a daily, off-server copy. It is not encrypted by AIC (the provider encrypts at rest), and it does not include evidence files.

**Next, the encrypted backup with evidence files** (`scripts/backup/backup.sh`). On the VPS, as root:

1. On your laptop, not the server: `age-keygen -o ~/.config/aic/backup.key`. It prints a public key (`age1…`). Keep the private key file in the password manager and one offline copy; the server only gets the public key, so someone who takes the server cannot read old backups.
2. `apt install age rclone`, then `rclone config` to add the bucket as a remote, for example `b2`.
3. Find the database container name with `docker ps --format '{{.Names}}' | grep mkmg7` and copy the script to `/opt/aic/scripts/backup/`.
4. Add a cron entry for root:

```
45 2 * * * PG_CONTAINER='<container name>' AGE_RECIPIENT='age1…' RCLONE_REMOTE='b2:aic-backups/prod' /opt/aic/scripts/backup/backup.sh >> /var/log/aic-backup.log 2>&1
```

With `PG_CONTAINER` set, the dump runs inside the database container with its own `pg_dump`, so the versions always match and no database port is opened. The container name changes when Coolify recreates the database, so re-check it after any database redeploy; the log will say `No such container` if it is stale. Add `MINIO_RCLONE_REMOTE` once evidence storage exists (see "Evidence storage" below); without it only the database is backed up.

The script keeps 30 daily and 12 monthly copies.

**Monthly, and after any change to the above:** on your laptop, with Postgres 18 client tools (`brew install postgresql@18`) and a local Postgres 18 to restore into:

```
AGE_IDENTITY=~/.config/aic/backup.key RCLONE_REMOTE=b2:aic-backups/prod \
RESTORE_URL=postgres://postgres:postgres@localhost:5432/postgres \
scripts/backup/restore-test.sh
```

It restores the newest dump into a throwaway database and checks that the core tables hold rows. For a Coolify backup instead, download the newest file from the bucket and run `pg_restore --list` on it, then restore it into a throwaway database the same way. Write the date and result in the operations log. A backup nobody has restored is a hope.

**Evidence storage.** Uploaded evidence goes to any S3-compatible bucket. Production had none on 5 October, so every upload failed. The simplest set-up is a second private bucket at the same provider as the backups (Backblaze B2 or Cloudflare R2), with its own key limited to that bucket. On aic-platform set:

| Variable | Value |
|---|---|
| `MINIO_ENDPOINT` | the provider's S3 URL, e.g. `https://s3.eu-central-003.backblazeb2.com` or `https://<account>.r2.cloudflarestorage.com` |
| `MINIO_ACCESS_KEY` | the key ID |
| `MINIO_SECRET_KEY` | the key secret |
| `MINIO_BUCKET` | the bucket name, e.g. `aic-evidence` (create it first; a scoped key cannot) |
| `MINIO_REGION` | only if the provider needs it (R2 uses `auto`, set automatically) |

**Check:** `/api/health` shows `evidence_storage: ok`, then upload one file in the Evidence Vault and open it again. Without these variables an upload now says plainly that storage is not switched on, rather than failing with a server error.

## 6. Error and uptime monitoring

- **Errors:** create a project at sentry.io (the free tier is enough). Set `NEXT_PUBLIC_SENTRY_DSN` on aic-platform, and `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` if you want readable stack traces. Pick the EU data region; the content-security policy already allows both the US and EU ingest hosts.
- **Uptime:** add a monitor at Better Stack, UptimeRobot or similar on `https://app.aiccertified.cloud/api/health` every minute, alerting by email and phone. It returns 503 when the database is down and 200 with `degraded` when only the engine is down. Add a second, simpler monitor on `https://aiccertified.cloud`.
- **Alert to:** Zander's phone, and security@ once it exists.

## 7. Security headers

Both apps now send a content-security policy, `X-Frame-Options`, `Referrer-Policy` and `Permissions-Policy`. HSTS and `upgrade-insecure-requests` switch on only when `NEXTAUTH_URL` (platform) or the production build (website) is https, so local work is unaffected.

**Check:** after deploying, open the browser console on a few pages. A red "Refused to load…" message means something the page needs is not on the list in `next.config.ts`. Then run both domains through securityheaders.com.

Once HSTS has been live for a few weeks without trouble, submit the domain at hstspreload.org.

## 8. AIC's own GitHub

AIC asks its clients to protect their main branch; its own repositories should pass the same checks. On each repository (`aic-platform`, `aic-website`):

1. **Settings → Branches → Add rule** for `main`: require a pull request, require 1 approval, require status checks to pass (`check`, `build`, and `migrations` on the platform), do not allow bypassing.
2. **Settings → Code security:** turn on Dependabot alerts, Dependabot security updates, secret scanning and push protection. `.github/dependabot.yml` already asks for weekly updates.
3. **Organisation settings → Authentication security:** require two-factor authentication.
4. Connect AIC's own GitHub organisation on the platform's Connected systems page. Every check should pass; if one fails, that is the first thing to fix.

CI (`.github/workflows/ci.yml`) runs type checks, lint, tests and a production build on every pull request. On the platform it also starts an empty Postgres, applies every migration in order, verifies them, and applies them a second time to prove they are safe to re-run.

## 9. Staging

See `docs/STAGING.md`. Branch protection on `main` (above) is what makes staging mandatory rather than optional.

## 10. Audit engine and network aliases

As of 5 October 2026 aic-engine had **never been deployed** in Coolify (no deployments, no container), which is why health shows it unreachable. Open aic-engine in Coolify and press **Deploy** first; check its logs come up on port 8000.

`/api/health` shows the engine as unreachable until the platform can reach it by name. In Coolify, on the engine service, add the network alias `aic-engine` (Advanced → Network aliases, or `--network-alias aic-engine` in custom Docker options), then set `ENGINE_URL=http://aic-engine:8000` on aic-platform. Use aliases for Postgres (`aic-db`), Redis and MinIO as well, rather than the generated container names, which change when a service is recreated.

**Check:** HQ → Audit engine shows every row as working.

## 10a. Decision review callbacks

Systems that hold a decision for a person (`require_review: true`) can be called back. Callbacks are signed with a per-organisation secret derived from `INTEGRATIONS_STATE_SECRET`, so that variable must be set (`openssl rand -hex 32`) before clients use callbacks. Changing it later changes every organisation's signing secret, so set it once and keep it in the password manager.

## 10b. AI assistance (optional)

Three features use a language model when one is configured: drafting questionnaire answers the rules cannot place, suggesting which common controls a custom framework's requirements map to, and a first read of each uploaded evidence document. Without it they fall back to rules and nothing breaks.

1. Create an API key on **AIC's own** Anthropic account (not a client's). Ask Anthropic for zero data retention on that account.
2. Set `AIC_AI_API_KEY` on aic-platform. Optionally `AIC_AI_MODEL` (default `claude-sonnet-5-5`; set it to a current model name if that one is retired).
3. Before switching it on for a client, the DPA must list Anthropic as a sub-processor and cover the transfer outside South Africa (POPIA section 72). Until the lawyer has signed that off, leave it off in production.

**Check:** `/api/health` shows `ai_assist: on (<model>)`. Upload a PDF in the Evidence Vault; the confirmation shows AIC's first read.

## 10c. Connectors (the 25 systems beyond GitHub, Microsoft 365 and the AI providers)

The catalogue on Connected systems lists AWS, Google Cloud, Azure, Google Workspace, Okta, 1Password, GitLab, Bitbucket, Snyk, Jira, Linear, Zendesk, Slack, BambooHR, HiBob, Personio, Deel, Rippling, Intune, Jamf, Kandji, CrowdStrike, Cloudflare, Datadog and Salesforce. Each is read-only: the client pastes a read-only credential, AIC tries it once before saving, and stores it encrypted in `integrations.secret_ciphertext`, so `ENCRYPTION_KEY` (section 3) must be set or the connect button refuses to save. They run in the same nightly sync as the others. No migration is needed.

Two need something on AIC's side. Intune reads devices through AIC's own Microsoft app, so add the application permission `DeviceManagementManagedDevices.Read.All` to that app in Entra and grant admin consent on AIC's tenant; each client's global administrator then re-consents once. Azure reuses the same app and needs nothing new from AIC; the client assigns Reader and Security Reader to it on each subscription.

Every connector is built from the provider's documentation and tested against recorded answers, not yet against a live account. Each one says "New" in the catalogue until it has run against a real tenant; set `verified: true` in `lib/connectors/catalog.ts` once it has. The code marks the specific fields that need confirming with `// Unverified:` comments.

Since 017 every sync and connect attempt is recorded in `connector_runs`, and staff see the result on Admin, Connector health. A connector loses its "New" badge automatically once it has completed a run against a real (non-demo) client; the `verified` flag is no longer the only way.

## 10d. Agent runtime (optional tool for clients)

Clients can run their own agents from AIC (Tools, Agents): their own Anthropic or OpenAI key, their instructions, and a short list of tools (web addresses with allowed methods and paths, ask a person, record a decision). AIC checks every call against the tool's scope before it leaves, pauses writes for a person's approval when the tool says so, follows no redirects, and hash-chains every step of every run. Limits per agent: steps and tokens per run, runs per 24 hours, and a monthly budget worked out from published prices. Model usage lands in the AI spend page with source `aic_runtime`. Pausing an agent stops runs in progress at their next step.

It needs `ENCRYPTION_KEY` (section 3) to store model keys and secret headers. Runs execute inside the request (up to 300 seconds, `maxDuration`); a run that waits for a person costs nothing while it waits. For testing against a mock, `AIC_AGENT_ANTHROPIC_URL` and `AIC_AGENT_OPENAI_URL` override the provider addresses; leave them unset in production.

The page and the API both state that the runtime is optional and neither raises nor lowers an organisation's chance of being certified (`TOOLS_NOTICE` in `lib/agents/config.ts`). Keep the same sentence on aiccertified.cloud.

## 11. The security mailbox

`SECURITY.md` in both repositories and the website's /security page give `security@aiccertified.cloud` as the address for reporting vulnerabilities. Create it (an alias to Zander is fine), and check that it receives mail from outside before the pages go live.

## 12. Things only a person can sign off

- **The data processing agreement** (`docs/legal/DATA-PROCESSING-AGREEMENT-DRAFT.md`) is a draft. A South African data-protection lawyer needs to review it before it is offered to a client.
- **The website's /security page** states how AIC hosts and protects data. Check every sentence is true of production as it is configured (for example that backups run, that the database is in the region stated, and that MFA is required for staff) before publishing it.
- **The terms of service** now have section 5A on connected systems. The lawyer should read it alongside the DPA.
