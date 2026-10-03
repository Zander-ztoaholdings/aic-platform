/** Certification stages, shared by client and server components. */

export const PHASES = [
  { id: 0, label: 'Intake',      sub: '& Classification' },
  { id: 1, label: 'Onboarding',  sub: 'Agreements' },
  { id: 2, label: 'Evidence',    sub: 'Submission' },
  { id: 3, label: 'Analysis',    sub: 'Auto Review' },
  { id: 4, label: 'Audit',       sub: 'Auditor Review' },
  { id: 5, label: 'Decision',    sub: 'Certification' },
  { id: 6, label: 'Governance',  sub: 'Continuous' },
];

/**
 * Maps the org's real, stored `certification_status` onto this tracker's
 * seven phases. There is no separate DB flag for "still in intake" or
 * "still onboarding" - any org with a working dashboard session has, by
 * definition, already completed sign-up and its agreements, so those two
 * phases are treated as done rather than tracked separately. Everything
 * from Evidence onward follows the same status values used elsewhere in
 * the app (see app/api/evidence/route.ts's certStep for the same mapping
 * at a coarser grain).
 *
 * This replaces a hardcoded `currentPhase={2}` that showed every org as
 * "Analysis" regardless of where they actually were.
 */
export function phaseFromCertificationStatus(status: string | null | undefined): number {
  switch (status) {
    case 'CERTIFIED':
      return 6; // Governance - certified orgs are in continuous monitoring.
    case 'APPROVED':
      return 5;
    case 'IN_REVIEW':
    case 'UNDER_REVIEW':
      return 4;
    case 'PENDING_REVIEW':
      return 3;
    case 'DRAFT':
    default:
      return 2; // Evidence submission - the default working state.
  }
}

