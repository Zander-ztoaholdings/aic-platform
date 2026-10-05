# Running AIC in production

What has to be switched on, by hand, for the October 2026 professional-standards work to take effect. Each section says what to do, how to check it worked, and what happens if you skip it. Work top to bottom; the order matters for the first three.

Related: `docs/STAGING.md` (staging and releases), `docs/INTEGRATIONS.md` (GitHub, Microsoft 365 and AI providers), `docs/INCIDENT-RESPONSE.md` (when something goes wrong), `docs/legal/DATA-PROCESSING-AGREEMENT-DRAFT.md` (for the lawyer).

## 1. Database migrations 011 to 013

Run each in the aic-platform container terminal, in order. All three are additive and safe to run twice.

```
psql "$DATABASE_URL" -f db/manual/011_integrations.sql
psql "$DATABASE_URL" -f db/manual/012_api_key_lookup.sql
psql "$DATABASE_URL" -f db/manual/013_policies.sql
```

- 011: connected systems and their checks.
- 012: an indexed lookup column for API keys, so a request no longer compares against every key in the database. Existing keys fill it in the first time each is used.
- 013: policies, published versions and acceptances. A trigger refuses any change to a published version, so the record of what people accepted cannot be edited afterwards.

**Check:** `https://app.aiccertified.cloud/api/health` shows `schema: ok, up to date with 013`.

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

**Evidence storage.** Uploaded evidence goes to MinIO (`MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `MINIO_USE_SSL`). The 5 October inventory listed no MinIO resource in Coolify. If those variables are not set on aic-platform, uploads are failing in production and must be fixed before any client relies on the Evidence Vault: add MinIO as a Coolify resource (or point the variables at an S3-compatible bucket), set the variables, and test one upload.

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

`/api/health` shows the engine as unreachable until the platform can reach it by name. In Coolify, on the engine service, add the network alias `aic-engine` (Advanced → Network aliases, or `--network-alias aic-engine` in custom Docker options), then set `ENGINE_URL=http://aic-engine:8000` on aic-platform. Use aliases for Postgres (`aic-db`), Redis and MinIO as well, rather than the generated container names, which change when a service is recreated.

**Check:** HQ → Audit engine shows every row as working.

## 11. The security mailbox

`SECURITY.md` in both repositories and the website's /security page give `security@aiccertified.cloud` as the address for reporting vulnerabilities. Create it (an alias to Zander is fine), and check that it receives mail from outside before the pages go live.

## 12. Things only a person can sign off

- **The data processing agreement** (`docs/legal/DATA-PROCESSING-AGREEMENT-DRAFT.md`) is a draft. A South African data-protection lawyer needs to review it before it is offered to a client.
- **The website's /security page** states how AIC hosts and protects data. Check every sentence is true of production as it is configured (for example that backups run, that the database is in the region stated, and that MFA is required for staff) before publishing it.
- **The terms of service** now have section 5A on connected systems. The lawyer should read it alongside the DPA.
