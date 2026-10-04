# Connected systems: GitHub and AI providers

The Vanta-style part of the platform. An organisation connects GitHub and/or an AI provider. AIC reads them every night (or when someone presses **Check now**), runs its automated checks, and stores the latest result of each. Whenever a check goes from passing to failing, or back again, AIC writes an event to the organisation's continuity record, but only for an organisation that has already begun that record.

Where things live:

| What | Where |
|---|---|
| Check definitions (why, fix, controls) | `apps/platform/lib/integrations/catalog.ts` |
| GitHub App auth and reads | `lib/integrations/github.ts` |
| GitHub check rules (pure, tested) | `lib/integrations/github-checks.ts` |
| OpenAI / Anthropic pull and mapping | `lib/integrations/providers.ts` |
| AI provider check rules (pure, tested) | `lib/integrations/provider-checks.ts` |
| One sync of one organisation | `lib/integrations/sync.ts` |
| Pages | `/integrations` (Connected systems), `/checks` (Automated checks) |
| Exporter clients run themselves | `apps/platform/public/exporter/aic-usage-exporter.mjs` |
| Tables | `integrations`, `integration_checks` (`db/manual/011_integrations.sql`) |
| Tests | `__tests__/lib/integrations.test.ts` |

## How AIC gets access

**GitHub** works through a GitHub App that belongs to AIC. The client installs it on the repositories they choose, and every permission it asks for is read-only. AIC never holds a password or token belonging to the client. Each time it reads, it signs a short JWT with its own App key and exchanges it for an installation token that lasts one hour. Uninstalling the App on GitHub cuts off access immediately, and the next sync marks the connection as disconnected.

**AI providers** can be connected in one of two ways, and the client picks which (decided by Zander in October 2026):

- **Exporter (the default).** The client runs `aic-usage-exporter.mjs` on their own side, usually as a nightly GitHub Action, with their own admin key. It POSTs daily totals per model to `/api/usage` using an `aic_live_` key. AIC never sees the provider key.
- **Read-only key (opt-in).** The client pastes an OpenAI admin key (`sk-admin-…`) or an Anthropic Admin API key (`sk-ant-admin…`). AIC first test-reads usage with it, then stores it encrypted with `ENCRYPTION_KEY` and pulls the figures itself. Disconnecting deletes the key.

## One-time setup (Zander)

### 1. Run the migration

Run this in the platform container's terminal, the same way as 006–010:

```
psql "$DATABASE_URL" -f db/manual/011_integrations.sql
```

It is additive and safe to run more than once.

### 2. Register the GitHub App

Do this under the AIC GitHub organisation, at **Settings → Developer settings → GitHub Apps → New GitHub App**.

1. Fill in the basic details:
   - **Name:** for example `AIC Compliance`. The URL name GitHub derives from it becomes `GITHUB_APP_SLUG`.
   - **Homepage URL:** `https://aiccertified.cloud`
   - **Callback URL:** leave it empty. AIC does not sign users in with GitHub.
   - **Setup URL:** `https://app.aiccertified.cloud/api/integrations/github/callback`
   - Tick **Redirect on update**.
2. **Webhook:** untick **Active**. AIC does not use webhooks yet.
3. **Repository permissions.** Set each of these to Read-only; leave everything else at No access:
   - Administration
   - Contents
   - Dependabot alerts
   - Metadata
   - Pull requests
   - Secret scanning alerts
4. **Organisation permissions:** set Administration to Read-only. This is only needed for the two-factor check.
5. **Where can this App be installed:** Any account.
6. Create the App. Copy the **App ID**, then **Generate a private key**, which downloads a `.pem` file.

A permission the client declines makes the affected check show "Could not check". It never passes silently.

### 3. Environment variables on aic-platform (Coolify)

| Variable | Value |
|---|---|
| `GITHUB_APP_ID` | the App ID |
| `GITHUB_APP_SLUG` | the App's URL name, e.g. `aic-compliance` |
| `GITHUB_APP_PRIVATE_KEY` | contents of the `.pem` (multi-line is fine; `\n` sequences also work) |
| `INTEGRATIONS_STATE_SECRET` | `openssl rand -hex 32` |
| `CRON_SECRET` | `openssl rand -hex 32` (at least 24 characters, or the nightly job refuses) |
| `ENCRYPTION_KEY` | must already be set. In production the app refuses to store a provider key without it |

Redeploy after setting them. Until the three `GITHUB_APP_*` variables are present, the GitHub row shows "GitHub connections are not switched on for this AIC server yet" and nothing breaks.

### 4. The nightly job (Coolify → aic-platform → Scheduled tasks)

- **Command:** `wget -qO- --post-data='' --header="Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3001/api/cron/integrations`
- **Frequency:** `0 2 * * *`. That is 02:00 UTC, which is 04:00 in South Africa.

## The checks

**GitHub, per repository**

| Check | What it looks at |
|---|---|
| Main branch is protected | Branch protection, or a ruleset. |
| Changes need an approving review | Whether at least one approval is required. |
| Recent changes were reviewed by someone else | Every pull request merged in the last 30 days had an approval from someone other than its author. Bots don't count as reviewers. |
| AI-written changes were reviewed by a person | Pull requests opened by AI agents (Copilot, Devin, Codex and others), or whose description says they were AI-generated or co-authored (Claude Code, Copilot and others), had a human approval. |
| No open critical or high vulnerability alerts | Dependabot. |
| No open leaked-secret alerts | Secret scanning. |
| AI libraries in code match the declared inventory | The repository depends on an AI or ML library. It passes once it is linked to a declared AI system, or marked as not making automated decisions. |

**GitHub, per GitHub organisation**

| Check | What it looks at |
|---|---|
| Two-factor sign-in is required | The organisation's security setting. |

**AI providers, per provider**

| Check | What it looks at |
|---|---|
| Usage is reaching AIC | The newest usage is no more than 3 days old. |
| Models in use are covered by a declared system | Each model used in the last 30 days is either attributed to a declared system by the exporter, or linked to one on the checks page. |

## Not verified against the real services yet

Everything above was tested against a local mock of GitHub, OpenAI and Anthropic. The mock is built from the published API shapes. Before you tell a client it works, check these three things on a real account:

1. **Anthropic cost unit.** The cost report's `amount` is treated as cents: `ANTHROPIC_AMOUNT_DIVISOR` in `providers.ts`, and the `/ 100` in the exporter. Compare one day against the Console.
2. **GitHub `state` round-trip.** The install link carries a signed `state` parameter, and GitHub should hand it back to the Setup URL. If the callback ever lands on `?error=state`, this is where to look.
3. **OpenAI `group_by`.** The exporter sends `group_by` twice (once for model, once for project). If OpenAI rejects that, send only `group_by=model`; you lose per-project attribution.
