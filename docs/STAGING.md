# Staging and releases

Two copies of each app run in Coolify: **production** (deploys from `main`) and
**staging** (deploys from `staging`). Every change goes to staging first.

## The flow

1. Claude (or anyone) commits to `staging` and pushes.
2. Coolify deploys the staging apps automatically.
3. Zander checks the change on staging:
   - website: https://staging.aiccertified.cloud
   - platform: https://staging-app.aiccertified.cloud
4. If it's right, merge to `main`:
   ```
   git checkout main && git pull
   git merge --ff-only staging
   git push
   ```
   Production deploys from `main`.
5. If it's wrong, fix it on `staging` and repeat. Nothing reaches production
   until step 4.

Database migrations follow the same order: run on the staging database first,
check, then on production, then deploy production.

## Staging settings (Coolify, staging apps only)

| Variable | Value |
|---|---|
| `AIC_ENV` | `staging` (adds a noindex header to every response) |
| `DATABASE_URL` | the staging database, never production |
| `AUTH_SECRET` / `NEXTAUTH_SECRET` | different from production |
| `AUTH_URL` / `NEXTAUTH_URL` | `https://staging-app.aiccertified.cloud` |
| `AIC_WEB_INTERNAL_URL` | the staging website's internal address |
| `PLATFORM_INTERNAL_URL` | the staging platform's internal address |
| `NEXT_PUBLIC_PLATFORM_URL` | `https://staging-app.aiccertified.cloud` |
| `NEXT_PUBLIC_WEB_URL` | `https://staging.aiccertified.cloud` |
| `RESEND_API_KEY` | a separate key, or unset so no email is sent |

Turn on Coolify's basic-auth protection for both staging apps as well; the
noindex header is the backstop if it is ever switched off.

## Data

The staging database holds schema and test data only. Never copy production
client data into it.
