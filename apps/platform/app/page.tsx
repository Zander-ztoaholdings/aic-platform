'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Shield, CheckCircle2, AlertTriangle, FileText, ArrowRight } from 'lucide-react';
import DashboardShell from './components/DashboardShell';
import { Eyebrow, SectionCard, CopperTag } from './components/ui/Eyebrow';
import { ScoreRing } from './components/ui/ScoreRing';
import { UploadModal } from './components/ui/UploadModal';

const RIGHT_TAGS = ['RIGHT 01', 'RIGHT 02', 'RIGHT 03', 'RIGHT 04', 'RIGHT 05'];

function scoreColor(v: number) {
  return v >= 80 ? '#16a34a' : v >= 60 ? '#c9920a' : '#dc2626';
}

type DashboardData = {
  organization: { name: string; tier: string };
  integrity: { score: number; status: string };
  audit_summary: { total: number; verified: number; flagged: number; pending: number };
  rights_compliance: Record<string, { name: string; score: number; status: string }>;
  overall_rights_score: number;
  recent_logs: Array<{ id: string; action: string; input_type: string; status: string; created_at: string }>;
  action_items: Array<{ title: string; priority: string }>;
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [upload, setUpload] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(d => { if (!d.error) setData(d); })
      .catch(() => {});
  }, []);

  const rights = data
    ? Object.values(data.rights_compliance).map((r, i) => ({
        id: i + 1,
        tag: RIGHT_TAGS[i] ?? `RIGHT 0${i + 1}`,
        label: r.name.replace('Right to ', ''),
        score: r.score,
        flagged: r.status !== 'COMPLIANT' ? 1 : 0,
      }))
    : [];

  const overall = data?.overall_rights_score ?? 0;
  const flagged = data?.audit_summary.flagged ?? 0;
  const met = data?.audit_summary.verified ?? 0;
  const tot = data?.audit_summary.total ?? 0;
  const daysLabel = data ? '—' : '—';

  const actions = data?.action_items.map(a => ({
    label: a.title,
    date: '',
    urgent: a.priority === 'critical',
  })) ?? [];

  const logs = data?.recent_logs.slice(0, 3) ?? [];

  return (
    <DashboardShell>
      {upload && <UploadModal label={upload} onClose={() => setUpload(null)} />}

      <div>
        <Eyebrow>Certification Overview</Eyebrow>

        {/* 4 stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Integrity Score',  value: data ? `${overall}/100`      : '—',           sub: data?.integrity.status ?? 'Loading…', icon: Shield,        color: '#c9920a' },
            { label: 'Evidence Met',     value: data ? `${met}/${tot}`        : '—',           sub: tot > 0 ? `${Math.round(met/tot*100)}% complete` : '—',    icon: CheckCircle2, color: '#16a34a' },
            { label: 'Critical Flags',   value: data ? String(flagged)        : '—',           sub: 'Require resolution',                                       icon: AlertTriangle, color: '#dc2626' },
            { label: 'Days to Deadline', value: daysLabel,                                    sub: 'Evidence submission',                                       icon: FileText,      color: '#b45309' },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <SectionCard key={s.label} className="p-4">
                <div className="flex justify-between items-start mb-2.5">
                  <span className="font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-[#6b7280]">
                    {s.label}
                  </span>
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: s.color }} />
                </div>
                <div className="font-mono text-2xl font-bold leading-none mb-1" style={{ color: s.color }}>
                  {s.value}
                </div>
                <div className="text-xs text-[#6b7280]">{s.sub}</div>
              </SectionCard>
            );
          })}
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
          {/* Left column */}
          <div className="space-y-4">
            {/* Evidence by Algorithmic Right */}
            <SectionCard>
              <div className="flex justify-between items-center mb-3.5">
                <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">
                  Evidence by Algorithmic Right
                </span>
                <Link href="/evidence" className="font-mono text-[9px] font-bold text-[#c9920a] flex items-center gap-1 hover:underline">
                  View All <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              {rights.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#9ca3af]">Loading…</div>
              ) : (
                rights.map((r) => {
                  const col = scoreColor(r.score);
                  return (
                    <div key={r.id} className="flex items-center gap-3 py-2.5 border-b border-[#f3f4f6] last:border-0">
                      <CopperTag>{r.tag}</CopperTag>
                      <span className="flex-1 text-xs font-semibold text-[#0f1f3d]">{r.label}</span>
                      {r.flagged > 0 && (
                        <span className="font-mono text-[8px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                          {r.flagged} FLAGGED
                        </span>
                      )}
                      <div className="w-20 h-1 bg-[#e5e7eb] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${r.score}%`, background: col }} />
                      </div>
                      <span className="font-mono text-[10px] font-bold w-7 text-right" style={{ color: col }}>
                        {r.score}
                      </span>
                    </div>
                  );
                })
              )}
            </SectionCard>

            {/* Recent Audit Activity */}
            <SectionCard>
              <div className="flex justify-between items-center mb-3.5">
                <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">
                  Recent Audit Activity
                </span>
                <Link href="/correspondence" className="font-mono text-[9px] font-bold text-[#c9920a] flex items-center gap-1 hover:underline">
                  View All <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              {logs.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#9ca3af]">
                  {data ? 'No audit activity yet.' : 'Loading…'}
                </div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="flex gap-2.5 py-3 border-b border-[#f3f4f6] last:border-0">
                    <div className="w-8 h-8 rounded-lg bg-[#0f1f3d] flex items-center justify-center font-mono text-[8px] font-bold text-[#c9920a] flex-shrink-0">
                      AIC
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between mb-0.5">
                        <span className="text-xs font-semibold text-[#0f1f3d]">{log.input_type || 'System'}</span>
                        <span className="font-mono text-[8px] text-[#9ca3af]">
                          {new Date(log.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-[#6b7280] leading-relaxed line-clamp-2">
                        {log.action} — {log.status}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </SectionCard>
          </div>

          {/* Right rail */}
          <div className="space-y-3">
            <SectionCard className="text-center p-6">
              <div className="flex justify-center mb-3.5">
                <ScoreRing value={overall} size={100} thickness={6} />
              </div>
              <div className="font-serif text-sm font-bold text-[#0f1f3d] mb-1.5">
                {data?.integrity.status ?? 'Loading…'}
              </div>
              <p className="text-xs text-[#6b7280] leading-relaxed mb-4">
                {data ? `Overall integrity score across all 5 Algorithmic Rights.` : 'Fetching your certification data…'}
              </p>
              <button
                onClick={() => setUpload('All Outstanding Evidence')}
                className="w-full inline-flex items-center justify-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.15em] bg-[#c9920a] text-white rounded-full py-2.5 hover:bg-[#b07d08] transition-colors"
              >
                Submit Evidence <ArrowRight className="w-3 h-3" />
              </button>
            </SectionCard>

            {/* Action items from API */}
            <SectionCard className="p-4">
              <div className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-3">
                Action Items
              </div>
              {actions.length === 0 ? (
                <div className="text-xs text-[#9ca3af] py-2">
                  {data ? 'No pending actions.' : 'Loading…'}
                </div>
              ) : (
                actions.map((a, i) => (
                  <div key={i} className="flex justify-between items-center py-1.5 border-b border-[#f3f4f6] last:border-0">
                    <span className={`text-xs ${a.urgent ? 'font-semibold text-red-600' : 'text-[#0f1f3d]'}`}>
                      {a.label}
                    </span>
                    {a.urgent && (
                      <span className="font-mono text-[9px] font-bold text-red-600">!</span>
                    )}
                  </div>
                ))
              )}
            </SectionCard>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
