'use client';
import { PathToCertificate } from './PathToCertificate';
import { PageHeader } from '@/app/components/ui/PageHeader';

import { useEffect, useState } from 'react';
import { Download, ExternalLink, Copy, Check } from 'lucide-react';
import DashboardShell from '../components/DashboardShell';
import { SectionCard } from '../components/ui/Eyebrow';

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
      <text x="55" y="148" fontSize="5" fill="#a8772a" textAnchor="middle" letterSpacing="1.5" fontFamily="Space Grotesk,sans-serif" fontWeight="700">AICCERTIFIED.CLOUD</text>
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
    { k: 'Certification status',  v: cert?.status ?? org?.certificationStatus ?? '—' },
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
        <PageHeader eyebrow="AIC Certification" title="My certificate" lede="Your current certification status, and what stands between you and the next stage." />

        {!data ? (
          <SectionCard className="p-5 md:p-8 text-center">
            <p className="text-xs text-[#8a95a3]">Loading certificate data…</p>
          </SectionCard>
        ) : !cert ? (
          <PathToCertificate status={org?.certificationStatus} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4 items-start">
            {/* Certificate card */}
            <SectionCard className="p-0 overflow-hidden">
              <div className="bg-[#0a1628] px-5 md:px-8 py-8 flex flex-col sm:flex-row gap-5 sm:gap-6 sm:items-center">
                <BrandMark size={72} />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-bold first-cap text-[#a8772a] mb-2">
                    Certificate of AI Accountability
                  </div>
                  <h2 className="font-serif text-xl font-bold text-white leading-snug mb-1">
                    {org?.name ?? '—'}
                  </h2>
                </div>
                {/* No number here: the register shows status bands only (Zander,
                    Sep 2026). A certificate carrying a score would invite the
                    one comparison the standard does not make. */}
              </div>

              <div className="p-4 sm:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 border border-[#dde2e8] rounded-xl overflow-hidden mb-5">
                  {certFields.map((r, i) => (
                    <div
                      key={r.k}
                      className="p-3"
                      style={{
                        borderRight:  i % 3 !== 2 ? '1px solid #dde2e8' : undefined,
                        borderBottom: i < 3       ? '1px solid #dde2e8' : undefined,
                      }}
                    >
                      <div className="text-[12px] text-[#8a95a3] first-cap mb-1">{r.k}</div>
                      <div className="text-xs font-semibold text-[#0e1b2c]">{r.v}</div>
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
                      className="inline-flex items-center gap-2 text-[12px] font-bold first-cap bg-[#a8772a] text-white rounded-full px-5 py-2.5 hover:bg-[#b07d08] transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" /> Download PDF
                    </a>
                  ) : (
                    <button disabled className="inline-flex items-center gap-2 text-[12px] font-bold first-cap bg-[#a8772a]/40 text-white rounded-full px-5 py-2.5 cursor-not-allowed">
                      <Download className="w-3.5 h-3.5" /> PDF not ready yet
                    </button>
                  )}
                  <button className="inline-flex items-center gap-2 text-[11.5px] font-bold text-[#5e6b7b] border border-[#dde2e8] rounded-full px-5 py-2.5 hover:border-[#a8772a] hover:text-[#a8772a] transition-colors">
                    <ExternalLink className="w-3.5 h-3.5" /> Public register
                  </button>
                  <button
                    onClick={handleCopy}
                    className="inline-flex items-center gap-2 text-[11.5px] font-bold text-[#5e6b7b] border border-[#dde2e8] rounded-full px-5 py-2.5 hover:border-[#a8772a] hover:text-[#a8772a] transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied' : 'Copy certificate number'}
                  </button>
                </div>
              </div>
            </SectionCard>

            {/* Trust mark rail */}
            <div className="space-y-3">
              <SectionCard className="p-5 text-center">
                <div className="text-[12px] font-bold first-cap text-[#5e6b7b] mb-3">
                  AIC Trust Mark
                </div>
                <div className="bg-[#0a1628] rounded-xl p-5 inline-block mb-3">
                  <BrandMark size={60} />
                </div>
                <p className="text-xs text-[#5e6b7b] leading-relaxed mb-3">
                  Display on your website, RFP responses, and annual reports. Must include certificate number and
                  link to public registry.
                </p>
                <button className="w-full inline-flex items-center justify-center gap-2 text-[11.5px] font-bold text-[#5e6b7b] border border-[#dde2e8] rounded-full py-2.5 hover:border-[#a8772a] hover:text-[#a8772a] transition-colors">
                  <Download className="w-3.5 h-3.5" /> Download SVG
                </button>
              </SectionCard>

              <SectionCard className="p-4">
                <div className="text-[12px] font-bold first-cap text-[#5e6b7b] mb-3">
                  Permitted use
                </div>
                <div className="space-y-2">
                  {permittedWithLink.map((r) => (
                    <div key={r} className="flex gap-2 items-start">
                      <Check className="w-3.5 h-3.5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-xs text-[#5e6b7b] leading-relaxed">{r}</span>
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
