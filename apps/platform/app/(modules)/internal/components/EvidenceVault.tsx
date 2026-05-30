'use client';

import { useState } from 'react';
import { ChevronDown, Upload, ArrowRight } from 'lucide-react';
import { Eyebrow, SectionCard, CopperTag } from '@/app/components/ui/Eyebrow';
import { StatusChip } from '@/app/components/ui/StatusChip';
import { UploadModal } from '@/app/components/ui/UploadModal';

type EvidenceStatus = 'verified' | 'partial' | 'flagged' | 'missing';

interface EvidenceItem {
  id: string;
  label: string;
  tier: string;
  status: EvidenceStatus;
  note: string | null;
}

interface AlgorithmicRight {
  id: number;
  tag: string;
  label: string;
  score: number;
  desc: string;
  items: EvidenceItem[];
}

const RIGHTS: AlgorithmicRight[] = [
  {
    id: 1, tag: 'RIGHT 01', label: 'Human Agency', score: 71,
    desc: 'Evidence that a named human reviews, approves, or can override every consequential AI decision.',
    items: [
      { id: 'HU-1', label: 'AI Systems Register',         tier: 'A', status: 'verified', note: 'Pulse SDK — 3 systems active' },
      { id: 'HU-2', label: 'Human Override Records (Q1)', tier: 'B', status: 'verified', note: '47 override events' },
      { id: 'HU-3', label: 'Override Rate Evidence (Q2)', tier: 'B', status: 'flagged',  note: 'Zero overrides Apr — explanation required' },
      { id: 'HU-4', label: 'Accountable Person RACI',     tier: 'C', status: 'partial',  note: 'Awaiting auditor tier review' },
      { id: 'HU-5', label: 'Tier 1 Decision SLA Policy',  tier: 'C', status: 'missing',  note: null },
    ],
  },
  {
    id: 2, tag: 'RIGHT 02', label: 'Explanation', score: 88,
    desc: 'Plain-language explanations available to affected persons for every automated decision.',
    items: [
      { id: 'EX-1', label: 'SHAP Feature Importance Report',   tier: 'A', status: 'verified', note: 'Credit model v2.4' },
      { id: 'EX-2', label: 'Sample Decision Notices (10)',     tier: 'B', status: 'verified', note: 'Plain language confirmed' },
      { id: 'EX-3', label: 'Explanation Mechanism Policy',     tier: 'C', status: 'verified', note: null },
    ],
  },
  {
    id: 3, tag: 'RIGHT 03', label: 'Empathy', score: 54,
    desc: 'Automated communications preserve human dignity — cold bureaucratic rejection is a design failure.',
    items: [
      { id: 'EM-1', label: 'Decline Letter Samples (20)',  tier: 'B', status: 'flagged', note: 'Dignity score 54/100 — below 60 threshold' },
      { id: 'EM-2', label: 'Communication Review Policy', tier: 'C', status: 'partial',  note: 'Appeal language missing' },
      { id: 'EM-3', label: 'Customer Feedback Dataset',   tier: 'A', status: 'missing',  note: null },
    ],
  },
  {
    id: 4, tag: 'RIGHT 04', label: 'Correction', score: 79,
    desc: 'A human-staffed correction pipeline exists and functions — not just documented, but operational.',
    items: [
      { id: 'CO-1', label: 'Correction SLA Policy (≤10 BD)',      tier: 'C', status: 'verified', note: null },
      { id: 'CO-2', label: 'Resolved Correction Case Records',    tier: 'B', status: 'verified', note: 'Avg 7.4 BD resolution' },
      { id: 'CO-3', label: 'Appeal Mechanism Documentation',      tier: 'C', status: 'partial',  note: 'Tier 1 escalation path missing' },
    ],
  },
  {
    id: 5, tag: 'RIGHT 05', label: 'Truth', score: 95,
    desc: 'Clear disclosure that AI is involved — no deception about the role of automated systems.',
    items: [
      { id: 'TR-1', label: 'AI Disclosure Statement (Website)',   tier: 'B', status: 'verified', note: null },
      { id: 'TR-2', label: 'Application-stage AI Notice',         tier: 'B', status: 'verified', note: null },
      { id: 'TR-3', label: 'Decision Communication Disclosure',   tier: 'B', status: 'verified', note: null },
    ],
  },
];

function scoreColor(v: number) {
  return v >= 80 ? '#16a34a' : v >= 60 ? '#c9920a' : '#dc2626';
}

export default function EvidenceVault() {
  const [open, setOpen] = useState<Record<number, boolean>>({ 1: true, 3: true });
  const [uploadLabel, setUploadLabel] = useState<string | null>(null);

  const toggle = (id: number) => setOpen((s) => ({ ...s, [id]: !s[id] }));

  return (
    <>
      {uploadLabel && <UploadModal label={uploadLabel} onClose={() => setUploadLabel(null)} />}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-5 items-start">
        {/* Main vault */}
        <div className="space-y-2">
          <Eyebrow>Phase 2 — Audit Vault</Eyebrow>
          {RIGHTS.map((r) => {
            const isOpen = !!open[r.id];
            const verified = r.items.filter((i) => i.status === 'verified').length;
            const flagged  = r.items.filter((i) => i.status === 'flagged').length;
            const col = scoreColor(r.score);

            return (
              <div
                key={r.id}
                className="bg-white border border-[#e5e7eb] rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(10,22,40,0.05)]"
              >
                {/* Accordion header */}
                <button
                  onClick={() => toggle(r.id)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[#f9fafb] transition-colors"
                >
                  <CopperTag>{r.tag}</CopperTag>
                  <span className="font-serif text-sm font-bold text-[#0f1f3d]">{r.label}</span>
                  {flagged > 0 && (
                    <span className="font-mono text-[8px] font-bold bg-red-50 text-red-600 px-1.5 py-0.5 rounded">
                      {flagged} FLAGGED
                    </span>
                  )}
                  <div className="ml-auto flex items-center gap-3">
                    <span className="font-mono text-[9px] text-[#6b7280]">{verified}/{r.items.length} verified</span>
                    <span className="font-mono text-sm font-bold" style={{ color: col }}>{r.score}</span>
                    <ChevronDown
                      className="w-4 h-4 text-[#9ca3af] transition-transform"
                      style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }}
                    />
                  </div>
                </button>

                {/* Accordion body */}
                {isOpen && (
                  <div className="border-t border-[#e5e7eb] px-3 pb-3">
                    <p className="text-xs text-[#6b7280] px-2 py-3 leading-relaxed">{r.desc}</p>
                    <div className="space-y-1">
                      {r.items.map((item) => {
                        const canUpload = item.status === 'missing' || item.status === 'partial';
                        return (
                          <div
                            key={item.id}
                            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-colors border ${
                              item.status === 'flagged'
                                ? 'bg-red-50/50 border-red-200/60'
                                : 'border-transparent hover:bg-[#f9fafb]'
                            }`}
                          >
                            <span className="font-mono text-[8px] text-[#9ca3af] w-10 flex-shrink-0">{item.id}</span>
                            <CopperTag>TIER {item.tier}</CopperTag>
                            <span
                              className={`flex-1 text-xs font-medium ${
                                item.status === 'missing' ? 'text-[#9ca3af]' : 'text-[#0f1f3d]'
                              }`}
                            >
                              {item.label}
                            </span>
                            {item.note && (
                              <span
                                className={`text-xs text-right max-w-[180px] ${
                                  item.status === 'flagged' ? 'text-red-600' : 'text-[#9ca3af]'
                                }`}
                              >
                                {item.note}
                              </span>
                            )}
                            {canUpload ? (
                              <button
                                onClick={() => setUploadLabel(item.label)}
                                className="flex items-center gap-1.5 text-xs font-mono font-semibold text-[#6b7280] border border-dashed border-[#e5e7eb] rounded-lg px-2.5 py-1 hover:border-[#c9920a] hover:text-[#c9920a] transition-colors flex-shrink-0"
                              >
                                <Upload className="w-3 h-3" /> Upload
                              </button>
                            ) : (
                              <StatusChip status={item.status} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right rail */}
        <div className="space-y-4">
          <SectionCard className="p-4">
            <Eyebrow>Evidence Tier Guide</Eyebrow>
            {[
              ['A', 'Operational / system data', '1.0×'],
              ['B', 'Third-party documents',      '0.8×'],
              ['C', 'Self-certified documents',   '0.6×'],
              ['D', 'Attestation only',           '0.4×'],
            ].map(([t, l, w]) => (
              <div key={t} className="flex items-center gap-2 mb-3">
                <CopperTag>TIER {t}</CopperTag>
                <span className="flex-1 text-xs text-[#0f1f3d]">{l}</span>
                <span className="font-mono text-[9px] text-[#c9920a] font-bold">{w}</span>
              </div>
            ))}
          </SectionCard>

          <SectionCard className="p-4">
            <div className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-2">
              Submission Deadline
            </div>
            <div className="font-serif text-xl font-bold text-red-600 mb-2">14 days</div>
            <p className="text-xs text-[#6b7280] leading-relaxed mb-4">
              All Critical findings resolved before AIC proceeds to Auditor Review.
            </p>
            <button
              onClick={() => setUploadLabel('All Outstanding Evidence')}
              className="w-full inline-flex items-center justify-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.15em] bg-[#c9920a] text-white rounded-full px-4 py-2.5 hover:bg-[#b07d08] transition-colors"
            >
              Submit All <ArrowRight className="w-3 h-3" />
            </button>
          </SectionCard>
        </div>
      </div>
    </>
  );
}
