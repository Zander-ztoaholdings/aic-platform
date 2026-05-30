'use client';

import { ArrowRight } from 'lucide-react';
import DashboardShell from '../components/DashboardShell';
import { Eyebrow, SectionCard, CopperTag } from '../components/ui/Eyebrow';

function BrandMark({ size = 60 }: { size?: number }) {
  return (
    <svg viewBox="0 0 110 180" style={{ height: size, width: 'auto', flexShrink: 0 }}>
      <path d="M36,1 L1,1 L1,179 L36,179" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="square"/>
      <path d="M74,1 L109,1 L109,179 L74,179" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="square"/>
      <text x="55" y="20" fontSize="7" fill="#fff" textAnchor="middle" letterSpacing="2.5" fontFamily="Space Grotesk,sans-serif" fontWeight="700">METHODOLOGY</text>
      <text x="55" y="31" fontSize="7" fill="#fff" textAnchor="middle" letterSpacing="2.5" fontFamily="Space Grotesk,sans-serif" fontWeight="700">ASSESSED</text>
      <line x1="8" y1="41" x2="102" y2="41" stroke="#fff" strokeWidth="1" opacity="0.3"/>
      <text x="55" y="100" fontSize="40" fontWeight="700" fill="#fff" textAnchor="middle" letterSpacing="5" fontFamily="Space Grotesk,sans-serif">AIC</text>
      <line x1="8" y1="122" x2="102" y2="122" stroke="#fff" strokeWidth="1" opacity="0.3"/>
      <text x="55" y="148" fontSize="5" fill="#c9920a" textAnchor="middle" letterSpacing="1.5" fontFamily="Space Grotesk,sans-serif" fontWeight="700">AICCERTIFIED.CLOUD</text>
    </svg>
  );
}

const DOMAINS = [
  { d: 'Domain 1', t: 'Human Agency in AI Systems',    desc: 'Design and evaluate human oversight processes. Detect theatrical oversight.' },
  { d: 'Domain 2', t: 'Explainability & Transparency', desc: 'Evaluate AI explanations for affected persons. Apply SHAP/LIME principles.' },
  { d: 'Domain 3', t: 'Empathy & Dignity',             desc: 'Apply the AIC Empathy Engine rubric. Identify dignity failures in automated comms.' },
  { d: 'Domain 4', t: 'Correction & Appeal',           desc: 'Design functioning correction pipelines. Conduct adverse scenario testing.' },
  { d: 'Domain 5', t: 'Disclosure & Truth',            desc: 'Assess AI disclosure compliance. Identify AI washing.' },
];

const EXAM_PARTS = [
  { part: 'Part A', title: 'Knowledge Assessment',  detail: '80 MCQ + 20 short answer · 3 hours · Closed-book · Pass mark: 65%' },
  { part: 'Part B', title: 'Applied Simulation',    detail: 'Full audit simulation · 4 hours · Open-book · Assessed: Satisfactory' },
];

const FEES = [
  { l: 'Enrolment (incl. study pack)', v: 'R 5,000'   },
  { l: 'Part A Examination',           v: 'R 3,500'   },
  { l: 'Part B Examination',           v: 'R 6,500'   },
  { l: 'Annual CPD Maintenance',       v: 'R 3,500/yr' },
];

export default function PractitionerPage() {
  return (
    <DashboardShell>
      <div className="space-y-5">
        <Eyebrow>Practitioner Certification — CAAP</Eyebrow>

        {/* Hero banner */}
        <div className="bg-[#0a1628] rounded-2xl px-8 py-8 flex gap-6 items-center">
          <BrandMark size={60} />
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-[#c9920a] mb-2">
              Certified AI Accountability Professional
            </div>
            <h2 className="font-serif text-xl font-bold text-white leading-snug mb-1.5">The CAAP Credential</h2>
            <p className="text-sm text-white/60 leading-relaxed max-w-xl">
              CAAP is to AI accountability what CA(SA) is to accounting — a professional designation proving that
              an individual has the knowledge and commitment to manage AI governance responsibly.
            </p>
          </div>
          <div className="ml-auto flex-shrink-0 text-right">
            <div className="font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-white/40 mb-1">Launching</div>
            <div className="font-serif text-xl font-bold text-[#c9920a]">Q3 2027</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 items-start">
          {/* Left */}
          <div className="space-y-4">
            {/* 5 Competency Domains */}
            <SectionCard>
              <div className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-4">
                5 Competency Domains
              </div>
              <div className="divide-y divide-[#f3f4f6]">
                {DOMAINS.map((d) => (
                  <div key={d.d} className="flex gap-3 py-3">
                    <CopperTag>{d.d}</CopperTag>
                    <div>
                      <div className="text-xs font-semibold text-[#0f1f3d] mb-0.5">{d.t}</div>
                      <div className="text-xs text-[#6b7280] leading-relaxed">{d.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* Examination Structure */}
            <SectionCard>
              <div className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-4">
                Examination Structure
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {EXAM_PARTS.map((p) => (
                  <div key={p.part} className="bg-[#f9fafb] rounded-xl p-4">
                    <CopperTag>{p.part}</CopperTag>
                    <div className="text-xs font-bold text-[#0f1f3d] mt-2 mb-1">{p.title}</div>
                    <div className="text-xs text-[#6b7280] leading-relaxed">{p.detail}</div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>

          {/* Right rail */}
          <div className="space-y-3">
            <SectionCard className="p-4">
              <div className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-3">
                Fee Structure (ZAR)
              </div>
              <div className="divide-y divide-[#f3f4f6]">
                {FEES.map((f) => (
                  <div key={f.l} className="flex justify-between py-2">
                    <span className="text-xs text-[#6b7280]">{f.l}</span>
                    <span className="font-mono text-xs font-bold text-[#0f1f3d]">{f.v}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 bg-amber-50 border border-amber-200/80 rounded-lg px-3 py-2">
                <span className="font-mono text-[9px] text-[#c9920a] font-bold">
                  Founding Partner discount: 30% off all fees for Meridian Financial staff
                </span>
              </div>
            </SectionCard>

            <SectionCard className="p-4">
              <div className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-2">
                Register Interest
              </div>
              <p className="text-xs text-[#6b7280] leading-relaxed mb-4">
                CAAP launches Q3 2027. Register now to be notified when enrolment opens and to secure Founding
                Partner pricing.
              </p>
              <button type="button" className="w-full inline-flex items-center justify-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.15em] bg-[#c9920a] text-white rounded-full py-2.5 hover:bg-[#b07d08] transition-colors">
                Register Interest <ArrowRight className="w-3 h-3" />
              </button>
            </SectionCard>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
