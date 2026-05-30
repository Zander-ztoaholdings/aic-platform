'use client';

import { useEffect, useState } from 'react';
import { Upload, Clock } from 'lucide-react';
import { Eyebrow, SectionCard, CopperTag } from '@/app/components/ui/Eyebrow';
import { StatusChip } from '@/app/components/ui/StatusChip';
import { UploadModal } from '@/app/components/ui/UploadModal';

type Severity = 'critical' | 'significant';

interface Finding {
  id: string;
  severity: Severity;
  right?: string;
  title: string;
  findings: string | null;
  description: string | null;
  category: string | null;
  status: string;
  deadline?: string;
  updatedAt: string;
}

const SEV_STYLES: Record<Severity, { border: string; bg: string; color: string }> = {
  critical:    { border: '#dc2626', bg: 'rgba(239,68,68,.08)',  color: '#dc2626' },
  significant: { border: '#b45309', bg: 'rgba(245,158,11,.08)', color: '#b45309' },
};

function guessSeverity(f: Finding): Severity {
  const text = `${f.title} ${f.findings ?? ''} ${f.category ?? ''}`.toLowerCase();
  if (text.includes('critical') || f.status === 'FLAGGED') return 'critical';
  return 'significant';
}

export default function AuditorFindings() {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadLabel, setUploadLabel] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/findings')
      .then(r => r.json())
      .then(d => { setFindings(d.findings ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const mapped = findings.map(f => ({
    ...f,
    severity: guessSeverity(f),
  }));

  const critical    = mapped.filter(f => f.severity === 'critical').length;
  const significant = mapped.filter(f => f.severity === 'significant').length;

  return (
    <>
      {uploadLabel && <UploadModal label={uploadLabel} onClose={() => setUploadLabel(null)} />}

      <div className="space-y-5">
        <Eyebrow>Auditor Findings</Eyebrow>

        <div className="flex flex-wrap gap-3 items-center">
          {[
            { label: 'Critical Findings',    count: critical,    color: '#dc2626', bg: 'rgba(239,68,68,.08)' },
            { label: 'Significant Findings', count: significant, color: '#b45309', bg: 'rgba(245,158,11,.08)' },
            { label: 'Observations',         count: 0,           color: '#6b7280', bg: 'rgba(107,114,128,.08)' },
          ].map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg border"
              style={{ background: s.bg, borderColor: `${s.color}30` }}
            >
              <span className="font-mono text-xl font-bold" style={{ color: s.color }}>{s.count}</span>
              <span className="font-mono text-[9px] font-bold uppercase tracking-[0.1em]" style={{ color: s.color }}>
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {loading ? (
          <SectionCard className="p-8 text-center">
            <p className="text-xs text-[#9ca3af]">Loading findings…</p>
          </SectionCard>
        ) : findings.length === 0 ? (
          <SectionCard className="p-8 text-center">
            <p className="text-sm font-semibold text-[#0f1f3d] mb-2">No Open Findings</p>
            <p className="text-xs text-[#9ca3af]">All audit requirements are currently satisfied.</p>
          </SectionCard>
        ) : (
          <div className="space-y-3">
            {mapped.map((f) => {
              const s = SEV_STYLES[f.severity];
              return (
                <div
                  key={f.id}
                  className="bg-white border border-[#e5e7eb] rounded-xl p-5 shadow-[0_1px_3px_rgba(10,22,40,0.05)]"
                  style={{ borderLeft: `3px solid ${s.border}` }}
                >
                  <div className="flex flex-wrap items-center gap-2.5 mb-3">
                    <span
                      className="font-mono text-[9px] font-bold px-2 py-1 rounded"
                      style={{ background: s.bg, color: s.color }}
                    >
                      {f.id.slice(0, 8).toUpperCase()}
                    </span>
                    <StatusChip status={f.severity} />
                    {f.category && (
                      <CopperTag>{f.category}</CopperTag>
                    )}
                    <div className="ml-auto">
                      <StatusChip status={f.status === 'PENDING' ? 'flagged' : f.status === 'RESOLVED' ? 'active' : 'partial'} />
                    </div>
                  </div>

                  <h3 className="font-serif text-sm font-bold text-[#0f1f3d] mb-4">{f.title}</h3>

                  {(f.description || f.findings) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                      {f.description && (
                        <div>
                          <div className="font-mono text-[8px] font-bold uppercase tracking-[0.15em] text-[#9ca3af] mb-2">
                            Requirement
                          </div>
                          <p className="text-xs text-[#0f1f3d] leading-relaxed">{f.description}</p>
                        </div>
                      )}
                      {f.findings && (
                        <div>
                          <div className="font-mono text-[8px] font-bold uppercase tracking-[0.15em] text-[#9ca3af] mb-2">
                            Finding
                          </div>
                          <p className="text-xs text-[#0f1f3d] leading-relaxed">{f.findings}</p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-[#f3f4f6]">
                    <Clock className="w-3.5 h-3.5 text-[#9ca3af]" />
                    <span className="font-mono text-[9px] text-[#9ca3af]">
                      Updated: {new Date(f.updatedAt).toLocaleDateString()}
                    </span>
                    <div className="ml-auto flex gap-2">
                      <button className="inline-flex items-center gap-1.5 font-mono text-[9px] font-bold text-[#6b7280] border border-[#e5e7eb] rounded-full px-3 py-1.5 hover:border-[#c9920a] hover:text-[#c9920a] transition-colors">
                        Request Extension
                      </button>
                      <button
                        onClick={() => setUploadLabel(f.title)}
                        className="inline-flex items-center gap-1.5 font-mono text-[9px] font-bold bg-[#c9920a] text-white rounded-full px-3 py-1.5 hover:bg-[#b07d08] transition-colors"
                      >
                        <Upload className="w-3 h-3" /> Submit Remediation
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
