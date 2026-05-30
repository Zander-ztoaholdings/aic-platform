'use client';

import { useEffect, useState } from 'react';
import { Download, ExternalLink, Copy, Check } from 'lucide-react';
import DashboardShell from '../components/DashboardShell';
import { Eyebrow, SectionCard } from '../components/ui/Eyebrow';

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

const PERMITTED = [
  'Organisation website (homepage)',
  'Email signatures — Accountable Person',
  'RFP and tender responses',
  'Annual reports and ESG disclosures',
];

type CertData = {
  organization: {
    name: string;
    tier: string | null;
    integrityScore: number;
    primaryAiOfficer: string | null;
    certificationStatus: string | null;
  };
  certificate: {
    certNumber: string;
    standard: string | null;
    status: string | null;
    issueDate: string | null;
    expiryDate: string | null;
    pdfUrl: string | null;
    verificationCode: string | null;
  } | null;
};

function fmt(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function CertificatePage() {
  const [data, setData] = useState<CertData | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/certificate')
      .then(r => r.json())
      .then(d => { if (!d.error) setData(d); })
      .catch(() => {});
  }, []);

  const cert = data?.certificate;
  const org = data?.organization;
  const certNum = cert?.certNumber ?? '—';

  const handleCopy = () => {
    if (!certNum || certNum === '—') return;
    navigator.clipboard?.writeText(certNum).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const certFields = [
    { k: 'Standard',              v: cert?.standard ?? '—' },
    { k: 'Certification Status',  v: cert?.status ?? org?.certificationStatus ?? '—' },
    { k: 'Accountable Person',    v: org?.primaryAiOfficer ?? '—' },
    { k: 'Certificate No.',       v: certNum },
    { k: 'Date of Issue',         v: fmt(cert?.issueDate ?? null) },
    { k: 'Date of Expiry',        v: fmt(cert?.expiryDate ?? null) },
  ];

  const permittedWithLink = cert?.verificationCode
    ? [...PERMITTED, `Must link to: aiccertified.cloud/registry/${certNum}`]
    : PERMITTED;

  return (
    <DashboardShell>
      <div className="space-y-5">
        <Eyebrow>My Certificate</Eyebrow>

        {!data ? (
          <SectionCard className="p-8 text-center">
            <p className="text-xs text-[#9ca3af]">Loading certificate data…</p>
          </SectionCard>
        ) : !cert ? (
          <SectionCard className="p-8 text-center">
            <p className="text-sm font-semibold text-[#0f1f3d] mb-2">Certificate Not Yet Issued</p>
            <p className="text-xs text-[#9ca3af]">
              Your certificate will appear here once the AIC audit process is complete.
              Continue submitting evidence to progress toward certification.
            </p>
          </SectionCard>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 items-start">
            {/* Certificate card */}
            <SectionCard className="p-0 overflow-hidden">
              <div className="bg-[#0a1628] px-8 py-8 flex gap-6 items-center">
                <BrandMark size={72} />
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-[9px] font-bold uppercase tracking-[0.3em] text-[#c9920a] mb-2">
                    Certificate of AI Accountability
                  </div>
                  <h2 className="font-serif text-xl font-bold text-white leading-snug mb-1">
                    {org?.name ?? '—'}
                  </h2>
                </div>
                <div className="ml-auto text-right flex-shrink-0">
                  <div className="font-mono text-3xl font-bold text-[#c9920a] leading-none">
                    {org?.integrityScore ?? 0}
                  </div>
                  <div className="font-mono text-[9px] text-white/40 tracking-[0.15em] mt-1">INTEGRITY SCORE</div>
                </div>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-3 border border-[#e5e7eb] rounded-xl overflow-hidden mb-5">
                  {certFields.map((r, i) => (
                    <div
                      key={r.k}
                      className="p-3"
                      style={{
                        borderRight:  i % 3 !== 2 ? '1px solid #e5e7eb' : undefined,
                        borderBottom: i < 3       ? '1px solid #e5e7eb' : undefined,
                      }}
                    >
                      <div className="font-mono text-[8px] text-[#9ca3af] uppercase tracking-[0.1em] mb-1">{r.k}</div>
                      <div className="text-xs font-semibold text-[#0f1f3d]">{r.v}</div>
                    </div>
                  ))}
                </div>

                {cert.status === 'PROVISIONAL' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-5">
                    <p className="text-xs text-amber-800 leading-relaxed">
                      <strong>Provisional Status:</strong> Certification is active but open findings remain.
                      Full "Active" status requires all Critical findings to be resolved.
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2.5">
                  {cert.pdfUrl ? (
                    <a
                      href={cert.pdfUrl}
                      className="inline-flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.15em] bg-[#c9920a] text-white rounded-full px-5 py-2.5 hover:bg-[#b07d08] transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" /> Download PDF
                    </a>
                  ) : (
                    <button disabled className="inline-flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.15em] bg-[#c9920a]/40 text-white rounded-full px-5 py-2.5 cursor-not-allowed">
                      <Download className="w-3.5 h-3.5" /> PDF Pending
                    </button>
                  )}
                  <button className="inline-flex items-center gap-2 font-mono text-[10px] font-bold text-[#6b7280] border border-[#e5e7eb] rounded-full px-5 py-2.5 hover:border-[#c9920a] hover:text-[#c9920a] transition-colors">
                    <ExternalLink className="w-3.5 h-3.5" /> Public Registry
                  </button>
                  <button
                    onClick={handleCopy}
                    className="inline-flex items-center gap-2 font-mono text-[10px] font-bold text-[#6b7280] border border-[#e5e7eb] rounded-full px-5 py-2.5 hover:border-[#c9920a] hover:text-[#c9920a] transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied!' : 'Copy Cert No.'}
                  </button>
                </div>
              </div>
            </SectionCard>

            {/* Trust mark rail */}
            <div className="space-y-3">
              <SectionCard className="p-5 text-center">
                <div className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-3">
                  AIC Trust Mark
                </div>
                <div className="bg-[#0a1628] rounded-xl p-5 inline-block mb-3">
                  <BrandMark size={60} />
                </div>
                <p className="text-xs text-[#6b7280] leading-relaxed mb-3">
                  Display on your website, RFP responses, and annual reports. Must include certificate number and
                  link to public registry.
                </p>
                <button className="w-full inline-flex items-center justify-center gap-2 font-mono text-[10px] font-bold text-[#6b7280] border border-[#e5e7eb] rounded-full py-2.5 hover:border-[#c9920a] hover:text-[#c9920a] transition-colors">
                  <Download className="w-3.5 h-3.5" /> Download SVG
                </button>
              </SectionCard>

              <SectionCard className="p-4">
                <div className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-3">
                  Permitted Usage
                </div>
                <div className="space-y-2">
                  {permittedWithLink.map((r) => (
                    <div key={r} className="flex gap-2 items-start">
                      <Check className="w-3.5 h-3.5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-xs text-[#6b7280] leading-relaxed">{r}</span>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
