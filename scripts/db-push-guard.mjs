/**
 * A deliberate obstacle in front of `drizzle-kit push` from this repo.
 *
 * THE PROBLEM. Two repositories point at the same production database with
 * two different Drizzle schema files, and they have drifted:
 *
 *   Zander-ztoaholdings/aic-web   lib/db/schema.ts          (the superset)
 *   Zander-ztoaholdings/aic-platform  packages/db/src/schema.ts  (behind)
 *
 * This repo's schema does not declare `assessments`,
 * `assessment_requirements` or `contact_submissions`. `drizzle-kit push`
 * reconciles the live database against the schema it is run from, which means
 * running it here proposes dropping those three tables — the audited
 * certification assessment records, the per-requirement findings behind every
 * certificate, and every contact-form submission from the marketing site.
 *
 * That is not a hypothetical: it was a two-word npm script, and the sibling
 * repo's own config comment recommends `db:push` as the right tool "for now".
 *
 * WHAT TO DO INSTEAD. Until one repository owns the schema, make schema
 * changes from the repo whose file is the superset (aic-web), or unify the
 * two files first. If you have genuinely reconciled them and know what you
 * are doing, `npm run db:push:unsafe` is still there.
 */

console.error(`
  db:push is disabled in this repository.

  This repo's schema is BEHIND the one in aic-web, and drizzle-kit push drops
  whatever the schema it is run from does not declare. Running it here would
  propose dropping:

    assessments               — audited certification assessments
    assessment_requirements   — per-requirement findings behind certificates
    contact_submissions       — marketing-site contact enquiries

  Make schema changes from the repo that owns the schema, or reconcile the two
  files first. See scripts/db-push-guard.mjs for the full explanation.

  If you have reconciled them and are certain: npm run db:push:unsafe
`);

process.exit(1);
