#!/usr/bin/env node
/**
 * Refreshes the pinned copy of the published standard.
 *
 * The platform fetches the standard live from aic-web, which is correct: one
 * source of truth, always current. But it made registration depend on aic-web
 * being reachable at the exact moment someone signs up — and on 9 Sep 2026 that
 * turned out not to be a hypothetical. The platform container cannot reach
 * aiccertified.cloud at all: the hostname resolves to the same VPS the
 * container runs on, and it cannot route back in through its own public IP.
 * Every signup returned 503.
 *
 * So the live fetch stays first, and this snapshot is what happens when it
 * fails. It is not a competing definition of the standard — it is the published
 * standard, pinned, with the version and the date it was captured recorded in
 * it. An organisation seeded from it stores the same standard_version it would
 * have stored from the live fetch, so an assessment remains traceable either
 * way, and /api/health reports which source was actually used.
 *
 * Run after any change to the standard:
 *   node scripts/refresh-standard-snapshot.mjs
 */
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE = process.env.STANDARD_SOURCE_URL ?? 'https://aiccertified.cloud/api/standard';
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../apps/platform/lib/standard-snapshot.json');

const res = await fetch(SOURCE, { headers: { accept: 'application/json' } });
if (!res.ok) {
  console.error(`✗ ${SOURCE} returned ${res.status}`);
  process.exit(1);
}
const data = await res.json();
if (!data?.version || !Array.isArray(data.requirements) || data.requirements.length === 0) {
  console.error('✗ response carried no requirements — refusing to write an empty snapshot');
  process.exit(1);
}

const snapshot = { ...data, _snapshot: { source: SOURCE, capturedAt: new Date().toISOString() } };
writeFileSync(OUT, JSON.stringify(snapshot, null, 2) + '\n');
console.log(`✓ standard v${data.version} (${data.requirements.length} requirements) → apps/platform/lib/standard-snapshot.json`);
