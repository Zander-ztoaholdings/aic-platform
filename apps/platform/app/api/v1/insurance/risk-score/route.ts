import { NextResponse } from 'next/server';

/**
 * REMOVED 11 September 2026. Retained as a 410 so any integration fails loudly
 * rather than silently, and so the removal is visible in the route table.
 *
 * WHAT WAS HERE AND WHY IT IS GONE.
 *
 * A mock underwriting endpoint with four separate faults, three of them
 * serious:
 *
 *   1. A HARDCODED API KEY compiled into the source — `mock_insurance_key_2026`
 *      — in a repository that has been public. That is a published credential.
 *   2. NO TENANT SCOPING. It took `orgId` from the query string and queried via
 *      getSystemDb(), which bypasses row-level security. Anyone holding the
 *      string above could read any organisation's decision records and
 *      certification state. This is the part to treat as an incident, not a
 *      bug: assume it was reachable, check the access logs, and record the
 *      finding whether or not anything was taken.
 *   3. A FABRICATED INTEGRITY HASH — `dataIntegrityHash: "0x8842...f92c"`,
 *      commented "Demo hash" — returned in a payload whose entire purpose is to
 *      demonstrate that AIC's records are tamper-evident. A made-up
 *      verification artefact is the single worst thing this codebase could have
 *      emitted, and it would have been emitted to an underwriter.
 *   4. It reported an `actuarialRiskScore`, a HIGH/MODERATE/LOW category and
 *      "Eligible for Standard Cyber/AI Policy". AIC is not an actuary and does
 *      not decide eligibility.
 *
 * The supported endpoint is /api/insurance/risk-score: API-key authenticated
 * against the apiKeys table, tenant-scoped through getTenantDb, observations
 * only, no rating and no recommendation.
 */
export async function GET() {
  return NextResponse.json(
    {
      error: 'Gone',
      detail:
        'This endpoint was removed on 11 September 2026. Use /api/insurance/risk-score with a Bearer API key issued from Settings → Keys.',
    },
    { status: 410 }
  );
}
