import type { Gap } from '../../lib/org-overview';

/**
 * Shared gap-severity presentation constants. Pulled out of page.tsx so a
 * plain object literal (no React, no client-only deps) can be imported by
 * both the server-rendered gap list and the client-only GapMixChart without
 * either side needing to redeclare it.
 */

export const SEVERITY_DOT: Record<Gap['severity'], string> = {
  BLOCKING: 'bg-red-500',
  MATERIAL: 'bg-aic-gold',
  ADVISORY: 'bg-gray-400',
};

export const SEVERITY_BADGE: Record<Gap['severity'], string> = {
  BLOCKING: 'bg-red-50 text-red-700 border-red-200',
  MATERIAL: 'bg-aic-copper-dim text-aic-navy border-aic-gold/30',
  ADVISORY: 'bg-gray-100 text-gray-600 border-gray-200',
};

export const SEVERITY_LABEL: Record<Gap['severity'], string> = {
  BLOCKING: 'Blocks certification',
  MATERIAL: 'Material',
  ADVISORY: 'Advisory',
};

export const SEVERITY_CHART_COLOR: Record<Gap['severity'], string> = {
  BLOCKING: '#ef4444',
  MATERIAL: '#c9920a',
  ADVISORY: '#94a3b8',
};
