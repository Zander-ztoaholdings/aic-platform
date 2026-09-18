# Tenant isolation: what was wrong, and how to switch it on

This is an operational runbook for `db/manual/008_tenant_isolation.sql`. It
needs a person with production database access and Coolify access. Read it
through before starting; the verification steps matter more than the change.

## The finding

`getTenantDb(orgId)` opens a transaction, sets `app.current_org_id`, and runs
the query. Twenty-one tables have `ENABLE ROW LEVEL SECURITY` and an isolation
policy reading that setting. It looks like defence in depth.

It has not been working. PostgreSQL exempts a table's **owner** from `ENABLE
ROW LEVEL SECURITY`, and the application connects with a single `DATABASE_URL`
whose role owns the schema. Every policy has been skipped on every query.
`db/manual/004_continuity_record.sql` documents the same conclusion, says it
was verified against a live Postgres, forced the two tables it introduced, and
left the rest as an outstanding audit.

Separately, thirteen tables carrying `org_id` had no working policy at all. Two
of them — `audit_documents` and `issued_certifications` — carry a `CREATE
POLICY` with no `ENABLE` anywhere, which does nothing: a policy on a table
without RLS enabled is never consulted.

What has actually been separating one client's data from another is the
`WHERE org_id = ...` clause in each query. Those are largely correct. But they
are the only layer, and a single forgotten clause in a future route is a
cross-tenant disclosure with nothing underneath it.

## Confirm it on your own database first

Do not take the above on trust. Run this against production:

```sql
SELECT current_user,
       (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS is_superuser;

SELECT c.relname,
       c.relrowsecurity  AS rls_enabled,
       c.relforcerowsecurity AS rls_forced,
       pg_get_userbyid(c.relowner) AS owner
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname;
```

If `owner` equals `current_user` on the RLS-enabled rows and `rls_forced` is
false, the policies are decorative today and the rest of this applies.

## What the migration does

Two things, neither of which changes application behaviour when applied:

1. Creates a role `aic_tenant` — `LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
   NOBYPASSRLS`, owning nothing — and grants it DML on the existing tables and
   sequences, plus default privileges so future tables are covered.
2. Enables RLS and adds the standard isolation policy to the thirteen
   uncovered tables.

Applying it is inert. The application keeps connecting as the owner, and the
owner bypasses all of it. **The switch is the environment variable**, which is
why this can be applied during business hours and enabled during a quiet one.

It deliberately does *not* use `FORCE ROW LEVEL SECURITY`. Force applies to the
owner too, and the owner is what `getSystemDb()` uses for work that is
legitimately cross-organisation: registration, auth callbacks, the public
register, admin tooling. Registration would fail on its first `INSERT`, because
a policy with `USING` and no `WITH CHECK` applies its `USING` expression to
inserts, and `app.current_org_id` is not set while the organisation being
created does not yet exist.

## Procedure

**1. Apply the migration.** From the repo root, against production:

```
DATABASE_URL='<from Coolify>' node scripts/apply-sql.mjs db/manual/008_tenant_isolation.sql
```

Nothing should change. The application is still on the owning role.

**2. Give the role a password.** It is created without one on purpose — a
credential does not belong in version control.

```sql
ALTER ROLE aic_tenant WITH PASSWORD '<generate 32+ random characters>';
```

**3. Prove isolation works before pointing the app at it.** Connect *as
`aic_tenant`* and run:

```sql
-- Expect: 0 rows. No org context set, so nothing is visible.
SELECT count(*) FROM decision_records;

-- Expect: only that organisation's rows.
BEGIN;
SELECT set_config('app.current_org_id', '<a real org uuid>', true);
SELECT count(*) FROM decision_records;
SELECT count(DISTINCT org_id) FROM decision_records;  -- expect 1
COMMIT;
```

If the first query returns rows, stop. Either the migration did not apply or
`aic_tenant` has privileges it should not — check `rolbypassrls` and whether it
somehow owns anything.

**4. Set `TENANT_DATABASE_URL` in Coolify** — the same connection string as
`DATABASE_URL` with user and password swapped for `aic_tenant`. Redeploy.

**5. Watch the boot log.** The warning

```
[SECURITY] TENANT_DATABASE_URL is not set...
```

should be gone. `getTenantIsolationStatus()` now reports `enforced: true`.

**6. Exercise the client path.** Sign in as a client user and load the
dashboard, evidence vault, decision log, reports and settings. A missing
`GRANT` surfaces as `permission denied for table ...`; a missing policy
surfaces as a page that renders with nothing in it. Both are visible
immediately, which is why this step is done with a person watching rather than
on a Friday evening.

## Rollback

Unset `TENANT_DATABASE_URL` and redeploy. The application returns to the owning
connection. No migration needs reversing, and no data is affected.

## What this still does not fix

- **Tables without `org_id`** — `system_ledger`, `roles`, `capabilities`,
  `hitl_logs` and others are global by design. Their protection is the
  capability check in front of the route, not a row policy. `hitl_logs` is
  worth revisiting on its own merits: it records a human override with no
  `org_id` column at all, and a human-oversight record that cannot be attributed
  to an organisation is difficult to produce as evidence for one.
- **Auditor scope** — `view_all_orgs` is currently the entire register rather
  than an assignment list. `organizations.auditor_id` already exists to support
  narrowing it. Worth doing before there is a second auditor on staff.
- **Query-level filters remain the first line.** RLS is the backstop, not a
  licence to drop `WHERE org_id`. Both layers, or neither is trustworthy.
