'use client';

import { Download, Plus, User } from 'lucide-react';
import { Eyebrow, SectionCard, CopperTag } from '@/app/components/ui/Eyebrow';
import { StatusChip } from '@/app/components/ui/StatusChip';

const ORG_FIELDS = [
  { k: 'Registered Name',     v: 'Meridian Financial Group (Pty) Ltd'   },
  { k: 'Registration Number', v: '2024/102938/07'                        },
  { k: 'Industry / Sector',   v: 'Financial Services — FSB Regulated'   },
  { k: 'Number of Employees', v: '340–500'                               },
  { k: 'Assessment Reference',v: 'AIC-2026-MFG-001'                     },
  { k: 'Division',            v: 'Division 2 — Supervised'              },
  { k: 'Assessment Started',  v: 'April 1, 2026'                        },
  { k: 'Certificate Expiry',  v: 'April 12, 2027'                       },
];

const AGREEMENTS = [
  { id: 'DOC-004', name: 'Assessment Agreement',          date: 'Apr 1, 2026' },
  { id: 'DOC-005', name: 'Accountable Person Declaration', date: 'Apr 1, 2026' },
  { id: 'DOC-006', name: 'Data Processing Agreement',     date: 'Apr 1, 2026' },
  { id: 'DOC-007', name: 'Evidence Checklist',            date: 'Apr 3, 2026' },
  { id: 'DOC-008', name: 'Pulse SDK Integration Guide',   date: 'Apr 3, 2026' },
];

const AP_DETAILS = [
  { k: 'Email',              v: 's.chen@meridianfin.co.za' },
  { k: 'Phone',              v: '+27 11 555 0192'          },
  { k: 'Declaration Signed', v: 'Apr 1, 2026 (DOC-005)'   },
  { k: 'Authority Confirmed',v: 'Full override authority'  },
];

const AI_SYSTEMS = [
  { name: 'Credit Scoring v2', tier: 'Tier 1', status: 'active'  as const },
  { name: 'HR Screening',      tier: 'Tier 2', status: 'active'  as const },
  { name: 'Insurance Risk',    tier: 'Tier 2', status: 'partial' as const },
];

export default function OrganisationProfile() {
  return (
    <div className="space-y-5">
      <Eyebrow>Organisation Profile</Eyebrow>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 items-start">
        {/* Left column */}
        <div className="space-y-4">
          {/* Organisation Details */}
          <SectionCard>
            <div className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-4">
              Organisation Details
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ORG_FIELDS.map((r) => (
                <div key={r.k} className="bg-[#f9fafb] rounded-lg px-3 py-2.5">
                  <div className="font-mono text-[8px] text-[#9ca3af] uppercase tracking-[0.1em] mb-1">{r.k}</div>
                  <div className="text-xs font-semibold text-[#0f1f3d]">{r.v}</div>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <button type="button" className="inline-flex items-center gap-2 font-mono text-[9px] font-bold text-[#6b7280] border border-[#e5e7eb] rounded-full px-4 py-2 hover:border-[#c9920a] hover:text-[#c9920a] transition-colors">
                Request Metadata Update
              </button>
            </div>
          </SectionCard>

          {/* Executed Agreements */}
          <SectionCard>
            <div className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-4">
              Executed Agreements
            </div>
            <div className="divide-y divide-[#f3f4f6]">
              {AGREEMENTS.map((a) => (
                <div key={a.id} className="flex items-center gap-3 py-2.5">
                  <CopperTag>{a.id}</CopperTag>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-[#0f1f3d]">{a.name}</div>
                    <div className="font-mono text-[9px] text-[#9ca3af]">Signed {a.date}</div>
                  </div>
                  <StatusChip status="signed" />
                  <button type="button" className="text-[#9ca3af] hover:text-[#c9920a] transition-colors flex-shrink-0">
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        {/* Right rail */}
        <div className="space-y-3">
          {/* Accountable Person */}
          <SectionCard className="p-4">
            <div className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-3">
              Accountable Person
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl bg-[#0f1f3d] flex items-center justify-center font-mono text-sm font-bold text-[#c9920a] flex-shrink-0">
                SC
              </div>
              <div>
                <div className="text-sm font-bold text-[#0f1f3d]">Dr. Sarah Chen</div>
                <div className="font-mono text-[9px] text-[#c9920a]">Chief Risk Officer</div>
              </div>
            </div>
            <div className="divide-y divide-[#f3f4f6]">
              {AP_DETAILS.map((r) => (
                <div key={r.k} className="py-2">
                  <div className="font-mono text-[8px] text-[#9ca3af] uppercase tracking-[0.1em] mb-0.5">{r.k}</div>
                  <div className="text-xs font-medium text-[#0f1f3d]">{r.v}</div>
                </div>
              ))}
            </div>
            <button type="button" className="w-full mt-3 inline-flex items-center justify-center gap-2 font-mono text-[9px] font-bold text-[#6b7280] border border-[#e5e7eb] rounded-full py-2 hover:border-[#c9920a] hover:text-[#c9920a] transition-colors">
              <User className="w-3 h-3" /> Change Accountable Person
            </button>
          </SectionCard>

          {/* AI Systems in Scope */}
          <SectionCard className="p-4">
            <div className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-3">
              AI Systems in Scope
            </div>
            <div className="divide-y divide-[#f3f4f6]">
              {AI_SYSTEMS.map((s) => (
                <div key={s.name} className="flex items-center gap-2.5 py-2">
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-[#0f1f3d]">{s.name}</div>
                    <div className="font-mono text-[8px] text-[#9ca3af]">{s.tier}</div>
                  </div>
                  <StatusChip status={s.status} />
                </div>
              ))}
            </div>
            <button type="button" className="w-full mt-3 inline-flex items-center justify-center gap-2 font-mono text-[9px] font-bold text-[#9ca3af] border border-dashed border-[#e5e7eb] rounded-full py-2 hover:border-[#c9920a] hover:text-[#c9920a] transition-colors">
              <Plus className="w-3 h-3" /> Declare New AI System
            </button>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
