import { redirect } from 'next/navigation';

/**
 * /roadmap is retired (2026-09) — Zander: "/evidence is the one we should
 * build on and remove roadmap, it just sounds better even." The requirements
 * checklist + evidence-submission flow this page used to own now lives in
 * the Evidence Vault (/evidence). Never linked from the sidebar, so this is
 * only a safety net for anyone with an old bookmark or email link.
 */
export default function RoadmapPage() {
  redirect('/evidence');
}
