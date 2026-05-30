'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, CheckCircle, AlertTriangle, Clock, ArrowRight } from 'lucide-react';
import { ScoreRing } from '@/app/components/ui/ScoreRing';
import { Eyebrow, SectionCard, CopperTag } from '@/app/components/ui/Eyebrow';
import { UploadModal } from '@/app/components/ui/UploadModal';

/* ── Static design data (replace with /api/dashboard when ready) ── */
const RIGHTS = [
  { id: 1, tag: 'RIGHT 01', label: 'Human Agency',  score: 71, flagged: 1 },
  { id: 2, tag: 'RIGHT 02', label: 'Explanation',   score: 88, flagged: 0 },
  { id: 3, tag: 'RIGHT 03', label: 'Empathy',        score: 54, flagged: 1 },
  { id: 4, tag: 'RIGHT 04', label: 'Correction',     score: 79, flagged: 0 },
  { id: 5, tag: 'RIGHT 05', label: 'Truth',          score: 95, flagged: 0 },
];

const UPCOMING = [
  { label: 'Remediation deadline',  date: 'May 2, 2026',   urgent: true  },
  { label: 'Walk-Me-Through call',  date: 'May 8, 2026',   urgent: false },
  { label: 'Auditor review begins', date: 'May 12, 2026',  urgent: false },
  { label: 'Certificate renewal',   date: 'Apr 12, 2027',  urgent: false },
];

const MSGS = [
  { id: 1, author: 'System Auditor', time: '2 hours ago', unread: true,
    text: 'Right 3 (Empathy): the batch of 20 decline letters scored 54/100 — below the certification threshold of 60. Please submit revised templates with a clear next-steps section and plain-language appeal instruction before the remediation deadline.' },
  { id: 2, author: 'System Auditor', time: 'Yesterday',   unread: false,
    text: 'Right 1 (Human Agency): zero override events logged in April across 15,421 decisions. Please provide a written explanation from the Accountable Person before we classify this as a Critical Finding.' },
];

interface DashboardData {
  stats: { pendingApplications: number; activeCertifications: number; totalLeads: number; auditsTotal: number };
  activeOrgs: Array<{ name: string; integrity_score: number; tier: string }>;
}

function scoreColor(v: number) {
  return v >= 80 ? '#16a34a' : v >= 60 ? '#c9920a' : '#dc2626';
}

export default function InternalDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [uploadLabel, setUploadLabel] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    fetch('/api/dashboard')
      .then((r) => r.json())
      .then((d: DashboardData) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (!mounted || loading) {
    return (
      <div className="flex items-center justify-center h-64 text-[#6b7280] font-serif italic text-sm">
        Syncing with institutional registry…
      </div>
    );
  }

  const overall = Math.round(RIGHTS.reduce((a, r) => a + r.score, 0) / RIGHTS.length);
  const totalFlagged = RIGHTS.reduce((a, r) => a + r.flagged, 0);

  const stats = [
    { label: 'Integrity Score',  value: `${overall}/100`, sub: 'Provisional Pass',       color: '#c9920a', Icon: Shield        },
    { label: 'Evidence Met',     value: `11/15`,          sub: '73% complete',            color: '#16a34a', Icon: CheckCircle   },
    { label: 'Critical Flags',   value: String(totalFlagged), sub: 'Require resolution',  color: '#dc2626', Icon: AlertTriangle },
    { label: 'Days to Deadline', value: '14',             sub: 'Evidence submission',      color: '#b45309', Icon: Clock         },
  ];

  return (
    <>
      {uploadLabel && (
        <UploadModal label={uploadLabel} onClose={() => setUploadLabel(null)} />
      )}

      <div className="space-y-5">
        <Eyebrow>Certification Overview</Eyebrow>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <SectionCard className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <span className="font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-[#6b7280]">
                    {s.label}
                  </span>
                  <s.Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: s.color }} />
                </div>
                <div className="font-mono text-2xl font-bold leading-none mb-1.5" style={{ color: s.color }}>
                  {s.value}
                </div>
                <div className="text-xs text-[#6b7280]">{s.sub}</div>
              </SectionCard>
            </motion.div>
          ))}
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">

          {/* Left column */}
          <div className="space-y-4">

            {/* Evidence by Algorithmic Right */}
            <SectionCard>
              <div className="flex justify-between items-center mb-4">
                <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">
                  Evidence by Algorithmic Right
                </span>
                <a
                  href="/evidence"
                  className="font-mono text-[9px] font-bold text-[#c9920a] flex items-center gap-1 hover:underline"
                >
                  View All <ArrowRight className="w-3 h-3" />
                </a>
              </div>
              <div className="divide-y divide-[#f3f4f6]">
                {RIGHTS.map((r) => {
                  const col = scoreColor(r.score);
                  return (
                    <div key={r.id} className="flex items-center gap-3 py-2.5">
                      <CopperTag>{r.tag}</CopperTag>
                      <span className="flex-1 text-xs font-semibold text-[#0f1f3d]">{r.label}</span>
                      {r.flagged > 0 && (
                        <span className="font-mono text-[8px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                          {r.flagged} FLAGGED
                        </span>
                      )}
                      <div className="w-20 h-1.5 bg-[#e5e7eb] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${r.score}%`, background: col }}
                        />
                      </div>
                      <span
                        className="font-mono text-xs font-bold w-7 text-right"
                        style={{ color: col }}
                      >
                        {r.score}
                      </span>
                    </div>
                  );
                })}
              </div>
            </SectionCard>

            {/* Recent Correspondence */}
            <SectionCard>
              <div className="flex justify-between items-center mb-4">
                <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">
                  Recent Correspondence
                </span>
                <a
                  href="/correspondence"
                  className="font-mono text-[9px] font-bold text-[#c9920a] flex items-center gap-1 hover:underline"
                >
                  View All <ArrowRight className="w-3 h-3" />
                </a>
              </div>
              <div className="divide-y divide-[#f3f4f6]">
                {MSGS.map((m) => (
                  <div key={m.id} className="flex gap-3 py-3">
                    <div className="w-8 h-8 rounded-lg bg-[#f0f4f8] flex items-center justify-center font-mono text-[9px] font-bold text-[#c9920a] flex-shrink-0">
                      AIC
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between mb-1">
                        <span className="text-xs font-semibold text-[#0f1f3d]">{m.author}</span>
                        <div className="flex items-center gap-2">
                          {m.unread && (
                            <span className="font-mono text-[8px] font-bold text-[#c9920a] bg-amber-50 px-1.5 py-0.5 rounded">
                              UNREAD
                            </span>
                          )}
                          <span className="font-mono text-[8px] text-[#9ca3af]">{m.time}</span>
                        </div>
                      </div>
                      <p className="text-xs text-[#6b7280] leading-relaxed line-clamp-2">{m.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* Pipeline (from live API) */}
            {data?.activeOrgs && data.activeOrgs.length > 0 && (
              <SectionCard>
                <Eyebrow>Certification Pipeline</Eyebrow>
                <div className="space-y-4">
                  {data.activeOrgs.map((org, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-xs font-mono mb-1.5">
                        <span className="font-bold text-[#0f1f3d] uppercase tracking-wide">{org.name}</span>
                        <span className="text-[#6b7280]">{org.tier} — {org.integrity_score}%</span>
                      </div>
                      <div className="h-1 w-full bg-[#f0f4f8] rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${org.integrity_score}%` }}
                          transition={{ duration: 0.8, delay: i * 0.1 }}
                          className="h-full rounded-full"
                          style={{ background: org.integrity_score === 100 ? '#22c55e' : '#c9920a' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}
          </div>

          {/* Right rail */}
          <div className="space-y-4">
            {/* Score ring card */}
            <SectionCard className="text-center p-6">
              <div className="flex justify-center mb-4">
                <ScoreRing value={overall} size={100} thickness={6} />
              </div>
              <div className="font-serif text-sm font-bold text-[#0f1f3d] mb-1">Provisional Pass</div>
              <p className="text-xs text-[#6b7280] mb-5 leading-relaxed">
                Right 3 (Empathy) is the primary risk to full certification.
              </p>
              <button
                onClick={() => setUploadLabel('All Outstanding Evidence')}
                className="w-full inline-flex items-center justify-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.15em] bg-[#c9920a] text-white rounded-full px-5 py-2.5 hover:bg-[#b07d08] transition-colors shadow-lg shadow-amber-500/20"
              >
                Submit Evidence <ArrowRight className="w-3 h-3" />
              </button>
            </SectionCard>

            {/* Upcoming actions */}
            <SectionCard className="p-4">
              <div className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-3">
                Upcoming Actions
              </div>
              <div className="divide-y divide-[#f3f4f6]">
                {UPCOMING.map((a) => (
                  <div key={a.label} className="flex justify-between items-center py-2">
                    <span
                      className={`text-xs ${a.urgent ? 'text-red-600 font-semibold' : 'text-[#0f1f3d]'}`}
                    >
                      {a.label}
                    </span>
                    <span
                      className={`font-mono text-[9px] font-bold ${
                        a.urgent ? 'text-red-600' : 'text-[#9ca3af]'
                      }`}
                    >
                      {a.date}
                    </span>
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* Live API stats */}
            {data?.stats && (
              <SectionCard className="p-4">
                <div className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-3">
                  Registry
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { l: 'Pending Apps',  v: data.stats.pendingApplications },
                    { l: 'Active Certs',  v: data.stats.activeCertifications },
                    { l: 'Total Leads',   v: data.stats.totalLeads },
                    { l: 'Audits Ran',    v: data.stats.auditsTotal },
                  ].map((s) => (
                    <div key={s.l}>
                      <div className="font-mono text-[8px] text-[#9ca3af] uppercase tracking-wide mb-0.5">{s.l}</div>
                      <div className="font-mono text-lg font-bold text-[#0f1f3d]">{s.v}</div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
