'use client';
import { PageHeader } from '@/app/components/ui/PageHeader';

import { useEffect, useState } from 'react';
import { Eye, Download, Info } from 'lucide-react';
import DashboardShell from '../components/DashboardShell';
import { SectionCard, CopperTag } from '../components/ui/Eyebrow';
import { ScoreRing } from '../components/ui/ScoreRing';

type Report = {
  id: string;
  title: string;
  period: string;
  overallScore: number;
  findingsCount: number;
  status: string;
  generatedAt: string | null;
  createdAt: string;
};

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/reports')
      .then(r => r.json())
      .then(d => { setReports(d.reports ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <DashboardShell>
      <div className="space-y-5">
        <PageHeader eyebrow="Compliance tracking" title="Reports" lede="Monthly reports generated from your record on the 1st of each month." />

        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex gap-2.5 items-start">
          <Info className="w-4 h-4 text-[#a8772a] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-[#0e1b2c] leading-relaxed">
            Monthly reports (DOC-023) are auto-generated from Pulse telemetry on the 1st of each month. They are
            part of the continuous governance evidence chain required for certification maintenance.
          </p>
        </div>

        <div className="space-y-3">
          {loading ? (
            <SectionCard className="p-5 md:p-8 text-center">
              <p className="text-xs text-[#8a95a3]">Loading reports…</p>
            </SectionCard>
          ) : reports.length === 0 ? (
            <SectionCard className="p-5 md:p-8 text-center">
              <p className="text-xs text-[#8a95a3]">No reports generated yet. Reports are created automatically on the 1st of each month.</p>
            </SectionCard>
          ) : (
            reports.map((r, i) => {
              const isFirst = i === 0;
              const label = r.period || new Date(r.createdAt).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });
              return (
                <SectionCard key={r.id} className="flex items-center gap-4 p-4">
                  <div className="flex-shrink-0">
                    <ScoreRing value={r.overallScore ?? 0} size={52} thickness={4} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <span className="font-serif text-sm font-bold text-[#0e1b2c]">{label}</span>
                      {isFirst && <CopperTag>Current</CopperTag>}
                      <span className="text-[11px] font-bold text-[#5e6b7b]">{r.status}</span>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {r.findingsCount > 0 && (
                        <span className="text-[11px] text-[#8a95a3] bg-[#f5f7f9] border border-[#dde2e8] rounded px-2 py-0.5">
                          {r.findingsCount} finding{r.findingsCount !== 1 ? 's' : ''}
                        </span>
                      )}
                      {r.title && (
                        <span className="text-[11px] text-[#8a95a3] bg-[#f5f7f9] border border-[#dde2e8] rounded px-2 py-0.5">
                          {r.title}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <a
                      href={`/api/reports/${r.id}?mode=inline`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#5e6b7b] border border-[#dde2e8] rounded-full px-3 py-1.5 hover:border-[#a8772a] hover:text-[#a8772a] transition-colors"
                    >
                      <Eye className="w-3 h-3" /> View
                    </a>
                    <a
                      href={`/api/reports/${r.id}`}
                      className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#5e6b7b] border border-[#dde2e8] rounded-full px-3 py-1.5 hover:border-[#a8772a] hover:text-[#a8772a] transition-colors"
                    >
                      <Download className="w-3 h-3" /> PDF
                    </a>
                  </div>
                </SectionCard>
              );
            })
          )}
        </div>

        <SectionCard className="bg-[#f5f7f9] p-4">
          <div className="text-[12px] font-bold first-cap text-[#5e6b7b] mb-1.5">
            Report frequency
          </div>
          <p className="text-xs text-[#5e6b7b] leading-relaxed">
            Generated automatically on the 1st of each month from Pulse telemetry. If Pulse integration is inactive,
            reports are generated from manually submitted evidence. Certificate renewal is conditional on all 12
            monthly reports being present.
          </p>
        </SectionCard>
      </div>
    </DashboardShell>
  );
}
