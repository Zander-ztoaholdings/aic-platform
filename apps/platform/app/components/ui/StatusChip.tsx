'use client';

type ChipStatus =
  | 'verified' | 'partial' | 'flagged' | 'missing'
  | 'active'   | 'expired' | 'signed'  | 'pending'
  | 'critical' | 'significant' | 'resolved';

const STATUS_MAP: Record<ChipStatus, { label: string; bg: string; color: string; dot: string }> = {
  verified:    { label: 'Verified',    bg: 'rgba(34,197,94,.10)',   color: '#16a34a', dot: '#22c55e' },
  partial:     { label: 'Partial',     bg: 'rgba(245,158,11,.10)',  color: '#b45309', dot: '#f59e0b' },
  flagged:     { label: 'Flagged',     bg: 'rgba(239,68,68,.08)',   color: '#dc2626', dot: '#ef4444' },
  missing:     { label: 'Missing',     bg: 'rgba(107,114,128,.08)', color: '#6b7280', dot: '#e5e7eb' },
  active:      { label: 'Active',      bg: 'rgba(34,197,94,.10)',   color: '#16a34a', dot: '#22c55e' },
  expired:     { label: 'Expired',     bg: 'rgba(239,68,68,.08)',   color: '#dc2626', dot: '#ef4444' },
  signed:      { label: 'Signed',      bg: 'rgba(34,197,94,.10)',   color: '#16a34a', dot: '#22c55e' },
  pending:     { label: 'Pending',     bg: 'rgba(245,158,11,.10)',  color: '#b45309', dot: '#f59e0b' },
  critical:    { label: 'Critical',    bg: 'rgba(239,68,68,.08)',   color: '#dc2626', dot: '#ef4444' },
  significant: { label: 'Significant', bg: 'rgba(245,158,11,.10)',  color: '#b45309', dot: '#f59e0b' },
  resolved:    { label: 'Resolved',    bg: 'rgba(34,197,94,.10)',   color: '#16a34a', dot: '#22c55e' },
};

export function StatusChip({ status }: { status: ChipStatus }) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.missing;
  return (
    <span
      className="inline-flex items-center gap-1.5 font-mono text-[8px] font-bold uppercase tracking-[0.15em] px-2 py-1 rounded"
      style={{ background: s.bg, color: s.color }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: s.dot }}
      />
      {s.label}
    </span>
  );
}
