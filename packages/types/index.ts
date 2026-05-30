/**
 * AIC Pulse - Shared Type Definitions
 * Source of truth for institutional data models across the monorepo.
 */

import { z } from 'zod';

export * from './errors';

export type CertificationTier = 'TIER_1' | 'TIER_2' | 'TIER_3';
export type UserRole = 'ADMIN' | 'COMPLIANCE_OFFICER' | 'AUDITOR' | 'VIEWER';

export const ROLE_HIERARCHY: UserRole[] = ['VIEWER', 'AUDITOR', 'COMPLIANCE_OFFICER', 'ADMIN'];

/**
 * Check if a user has at least the required role
 */
export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY.indexOf(userRole) >= ROLE_HIERARCHY.indexOf(requiredRole);
}

export type IncidentStatus = 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'DISMISSED' | 'CLOSED';
export type ScheduledAuditStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type CorrectionStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED';

export interface Permissions {
  // Audit Permissions
  can_view_audits: boolean;
  can_trigger_audit: boolean;
  can_verify_requirements: boolean;
  
  // Incident Permissions
  can_view_incidents: boolean;
  can_resolve_incidents: boolean;
  can_export_pii: boolean;
  
  // Intelligence Permissions
  can_view_intelligence: boolean;
  can_manage_models: boolean;
  
  // Administrative Permissions
  can_manage_users: boolean;
  can_manage_org: boolean;
  can_access_ledger: boolean;
  
  [key: string]: boolean;
}

export interface Organization {
  id: string;
  name: string;
  tier: CertificationTier;
  integrity_score: number;
  is_alpha: boolean;
  contact_email?: string | null;
  api_key?: string | null;
  auditor_id?: string | null;
  created_at: Date | string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  org_id?: string | null;
  is_active: boolean;
  email_verified: boolean;
  is_super_admin: boolean;
  permissions: Permissions;
  last_login?: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

/**
 * Institutional Session User (Strictly Typed)
 */
export interface AICSessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  orgId: string;
  orgName: string;
  tier: CertificationTier;
  isSuperAdmin: boolean;
  permissions: Permissions;
}

// --- API Schemas (Directive A) ---

export const StatsResponseSchema = z.object({
  orgName: z.string(),
  orgId: z.string().uuid(),
  tier: z.string(), // Could be TIER_1 | TIER_2 | TIER_3
  score: z.number().min(0).max(100),
  openIncidents: z.number().min(0),
  totalRequirements: z.number().min(0),
  verifiedRequirements: z.number().min(0),
  velocityData: z.array(z.object({
    month: z.string(),
    score: z.number().min(0).max(100)
  })),
  radarData: z.array(z.object({
    subject: z.string(),
    A: z.number().min(0).max(100),
    fullMark: z.number()
  })),
  lastAuditAt: z.string().optional().nullable(),
  nextRenewalDate: z.string().optional().nullable(),
  status: z.string()
});

export type StatsResponse = z.infer<typeof StatsResponseSchema>;

// --- Other Data Models ---

export interface AuditLog {
  id: string;
  org_id: string;
  system_name: string;
  event_type: string;
  details: Record<string, unknown>;
  status: string;
  metadata: Record<string, unknown>;
  integrity_hash: string;
  previous_hash?: string | null;
  sequence_number: number;
  signature?: string | null;
  created_at: Date | string;
}

export interface Incident {
  id: string;
  org_id: string;
  citizen_email: string;
  system_name?: string | null;
  description: string;
  status: IncidentStatus;
  resolution_details?: string | null;
  human_reviewer_id?: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

// --- Engine Analysis Results (Task 12) ---

export type EngineAnalysisType = 
  | 'DISPARATE_IMPACT' 
  | 'EQUALIZED_ODDS' 
  | 'INTERSECTIONAL' 
  | 'EXPLANATION_SHAP' 
  | 'EXPLANATION_LIME';

export const BaseEngineResultSchema = z.object({
  right_enforced: z.string(),
  audit_hash: z.string(),
  previous_hash: z.string().optional().nullable(),
  timestamp: z.string(),
  popia_compliance: z.boolean(),
  signature: z.string().optional(),
  error: z.string().optional(),
  status: z.string().optional(),
  fallback: z.boolean().optional(),
});

export const DisparateImpactResultSchema = BaseEngineResultSchema.extend({
  overall_status: z.enum(['FAIR', 'WARNING', 'BIASED']),
  methodology: z.string(),
  reference_group: z.string(),
  reference_rate: z.number(),
  flags: z.array(z.string()),
  detailed_analysis: z.record(z.object({
    selection_rate: z.number(),
    disparate_impact_ratio: z.number(),
    status: z.string(),
    sample_size: z.number(),
    selected_count: z.number(),
    is_reference_group: z.boolean()
  })),
  recommendations: z.array(z.string())
});

export const EqualizedOddsResultSchema = BaseEngineResultSchema.extend({
  overall_status: z.enum(['PASS', 'FAIL']),
  methodology: z.string(),
  tpr_parity: z.boolean(),
  fpr_parity: z.boolean(),
  tpr_difference: z.number(),
  fpr_difference: z.number(),
  threshold: z.number(),
  flags: z.array(z.string()),
  detailed_analysis: z.record(z.any())
});

export const IntersectionalResultSchema = BaseEngineResultSchema.extend({
  overall_status: z.enum(['FAIR', 'BIASED']),
  methodology: z.string(),
  attributes_analyzed: z.array(z.string()),
  groups_analyzed: z.number(),
  reference_group: z.string(),
  flags: z.array(z.string()),
  detailed_analysis: z.record(z.any())
});

export const ExplanationResultSchema = BaseEngineResultSchema.extend({
  method: z.string(),
  instances_explained: z.number(),
  n_features: z.number(),
  feature_importance: z.array(z.object({ 
    feature: z.string(), 
    mean_abs_shap: z.number() 
  })),
  base_value: z.union([z.number(), z.array(z.number())]),
  shap_values: z.any().optional(),
  instance_explanations: z.array(z.object({
    instance_index: z.number(),
    feature_contributions: z.array(z.object({ 
        feature: z.string(), 
        shap_value: z.number() 
    })),
    prediction_explanation: z.string()
  }))
});

export const EngineAnalysisResultSchema = z.union([
  DisparateImpactResultSchema,
  EqualizedOddsResultSchema,
  IntersectionalResultSchema,
  ExplanationResultSchema
]);

export type BaseEngineResult = z.infer<typeof BaseEngineResultSchema>;
export type DisparateImpactResult = z.infer<typeof DisparateImpactResultSchema>;
export type EqualizedOddsResult = z.infer<typeof EqualizedOddsResultSchema>;
export type IntersectionalResult = z.infer<typeof IntersectionalResultSchema>;
export type ExplanationResult = z.infer<typeof ExplanationResultSchema>;
export type EngineAnalysisResult = z.infer<typeof EngineAnalysisResultSchema>;

export const EngineErrorResultSchema = z.object({
  error: z.string(),
  details: z.any().optional()
});

export type EngineErrorResult = z.infer<typeof EngineErrorResultSchema>;

// Additional Engine Result Types

export interface DecisionExplanation {
  right_enforced: string;
  audit_hash: string;
  timestamp: string;
  popia_compliance: boolean;
  explanation: string;
  plain_language_summary: string;
  feature_contributions: Array<{ feature: string; impact: string; direction: 'positive' | 'negative' | 'neutral' }>;
  confidence_breakdown?: string;
  signature?: string;
  error?: string;
  status?: string;
  fallback?: boolean;
}

export interface EmpathyAnalysisResult {
  right_enforced: string;
  audit_hash: string;
  timestamp: string;
  popia_compliance: boolean;
  sentiment_score: number;
  sentiment_label: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  empathy_score: number;
  tone_flags: string[];
  recommendations: string[];
  signature?: string;
  error?: string;
  status?: string;
  fallback?: boolean;
}

export interface TaskStatusResult {
  task_id: string;
  status: 'PENDING' | 'STARTED' | 'SUCCESS' | 'FAILURE' | 'REVOKED';
  result?: Record<string, unknown>;
  error?: string;
}
