#!/usr/bin/env node
/**
 * A claims-triage agent that records what it decides.
 *
 * This exists to be read aloud in a room. It is deliberately the whole
 * integration: one POST per decision, no SDK, no agent framework, nothing that
 * has to be installed. If it takes more than a screen to explain, the pitch
 * that "recording what your AI does is one call" is not true.
 *
 *   AIC_API_KEY=aic_live_... node scripts/demo/claims-agent.mjs
 *   AIC_API_KEY=... AIC_BASE=http://localhost:3001 node scripts/demo/claims-agent.mjs --override
 */

const BASE = process.env.AIC_BASE || 'https://app.aiccertified.cloud';
const KEY = process.env.AIC_API_KEY;

if (!KEY) {
  console.error('Set AIC_API_KEY (an aic_live_... key from Settings → API & Access Keys).');
  process.exit(1);
}

// The system name is what AIC diffs against the declared inventory. Using a
// name that is NOT yet on the register is the point of the demo: within one
// observation it surfaces as HU-3-UNDECLARED-SYSTEM, blocking.
const SYSTEM = process.env.AIC_SYSTEM || 'claims-triage-agent';

const CLAIMS = [
  { claim_ref: 'CLM-2026-4471', peril: 'motor collision', amount_zar: 84500, policy_age_months: 31, prior_claims: 0 },
  { claim_ref: 'CLM-2026-4472', peril: 'geyser burst',    amount_zar: 19200, policy_age_months: 4,  prior_claims: 2 },
  { claim_ref: 'CLM-2026-4473', peril: 'theft',           amount_zar: 61000, policy_age_months: 11, prior_claims: 1 },
];

// Stands in for whatever the real model is. The shape of the integration does
// not change when this becomes a call to a model endpoint.
function triage(claim) {
  if (claim.prior_claims >= 2 && claim.policy_age_months < 6) {
    return {
      decision: 'REFER_TO_INVESTIGATION',
      confidence: 0.81,
      explanation:
        'Two prior claims within four months of inception. Referred for review rather than ' +
        'declined; no adverse outcome is applied automatically.',
    };
  }
  if (claim.amount_zar > 75000) {
    return {
      decision: 'REFER_TO_ASSESSOR',
      confidence: 0.74,
      explanation: 'Value above the automatic-settlement threshold. Routed to a human assessor.',
    };
  }
  return {
    decision: 'SETTLE',
    confidence: 0.93,
    explanation: 'Within threshold, no prior-claim signal, policy in good standing.',
  };
}

async function record(claim, result, override) {
  const res = await fetch(`${BASE}/api/decisions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      system_name: SYSTEM,
      input_params: claim,
      outcome: { decision: result.decision, confidence: result.confidence },
      explanation: result.explanation,
      ...(override ? { isHumanOverride: true, overrideReason: 'Assessor disagreed with referral' } : {}),
    }),
  });

  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

const override = process.argv.includes('--override');

for (const claim of CLAIMS) {
  const result = triage(claim);
  const { status, body } = await record(claim, result, override);

  if (status === 201) {
    console.log(`  ${claim.claim_ref}  ${result.decision.padEnd(24)} recorded (${body.recorded_via})`);
  } else {
    // The override refusal lands here on purpose when --override is passed with
    // a key: a machine cannot assert that a human reviewed something.
    console.log(`  ${claim.claim_ref}  ${status} — ${body.error}`);
    if (body.reason) console.log(`      ${body.reason}`);
  }
}

console.log(`\nRecorded as "${SYSTEM}". If that name is not on the AI inventory, AIC will say so.`);
