import { redirect } from 'next/navigation';

/**
 * Retired along with /roadmap (2026-09). This "Immutable Trust Registry"
 * view was an earlier, simpler audit-log viewer (GET /api/audit-logs only)
 * that /audits has since superseded — /audits covers the same ledger plus
 * verify/privacy/labor exports. Never linked from the sidebar; this is only
 * a safety net for an old bookmark or email link. Could not delete this
 * file outright (device bridge has no delete permission granted), so it's
 * reduced to a redirect instead.
 */
export default function TrustRegistryPage() {
  redirect('/audits');
}
