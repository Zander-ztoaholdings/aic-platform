export type CertificationStatus = 'ADVISORY' | 'READINESS' | 'STAGE_1_DOCS' | 'STAGE_2_TECHNICAL' | 'CERTIFIED' | 'SUSPENDED' | 'DRAFT' | 'PENDING_REVIEW' | 'REVISION_REQUIRED' | 'APPROVED';

export const CERTIFICATION_LIFECYCLE: Record<CertificationStatus, CertificationStatus[]> = {
  // Legacy / Application States
  'DRAFT': ['PENDING_REVIEW'],
  'PENDING_REVIEW': ['REVISION_REQUIRED', 'APPROVED'],
  'REVISION_REQUIRED': ['PENDING_REVIEW'],
  'APPROVED': ['CERTIFIED'],
  
  // ISO/IEC 42001 AIMS Journey (The 5 Stages)
  'ADVISORY': ['READINESS', 'SUSPENDED'],
  'READINESS': ['ADVISORY', 'STAGE_1_DOCS', 'SUSPENDED'],
  'STAGE_1_DOCS': ['READINESS', 'STAGE_2_TECHNICAL', 'SUSPENDED'],
  'STAGE_2_TECHNICAL': ['STAGE_1_DOCS', 'CERTIFIED', 'SUSPENDED'],
  'CERTIFIED': ['STAGE_2_TECHNICAL', 'SUSPENDED'],
  'SUSPENDED': ['ADVISORY', 'READINESS', 'STAGE_1_DOCS', 'STAGE_2_TECHNICAL']
};

export function isValidTransition(current: CertificationStatus, next: CertificationStatus): boolean {
  const allowed = CERTIFICATION_LIFECYCLE[current];
  return allowed ? allowed.includes(next) : false;
}

export const STATUS_LABELS: Record<CertificationStatus, string> = {
  'DRAFT': 'Application In-Progress',
  'PENDING_REVIEW': 'Under Review by AIC',
  'REVISION_REQUIRED': 'Revisions Requested',
  'APPROVED': 'Awaiting Final Issuance',
  
  // AIMS Journey
  'ADVISORY': 'Advisory Phase (Initial Engagement)',
  'READINESS': 'Readiness Assessment (Gap Analysis)',
  'STAGE_1_DOCS': 'Stage 1: Documentation Audit',
  'STAGE_2_TECHNICAL': 'Stage 2: Technical Verification',
  'CERTIFIED': 'Institutional Certification Active',
  'SUSPENDED': 'Certification Suspended'
};
