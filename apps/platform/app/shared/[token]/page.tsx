import { cookies, headers } from 'next/headers';
import { findShare, maskEmail, readViewerPass, recordView, SHARE_COOKIE } from '@/lib/record-shares';
import { readContinuity } from '@/lib/continuity-store';
import { ContinuityFeed } from '@/app/dashboard/components/ContinuityFeed';
import { ShareGate } from './ShareGate';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Shared continuity record | AIC', robots: { index: false, follow: false } };

const fmt = (d: string | Date) => new Date(typeof d === 'string' && d.length === 10 ? `${d}T00:00:00Z` : d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

function Frame({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-screen bg-[#f5f7f9] text-[#0e1b2c]">
      <header className="border-b border-[#dde2e8] bg-white">
        <div className={`mx-auto flex ${wide ? 'max-w-[1100px]' : 'max-w-xl'} items-center justify-between px-5 py-4`}>
          <span className="text-[17px] font-bold tracking-tight">AIC<span className="text-[#c9920a]">.</span></span>
          <span className="text-[13px] text-[#5e6b7b]">AI Integrity Certification</span>
        </div>
      </header>
      <main className={`mx-auto ${wide ? 'max-w-[1100px]' : 'max-w-xl'} px-5 py-8 sm:py-12`}>{children}</main>
    </div>
  );
}

/**
 * A shared period of a continuity record. Opens only for the named person
 * once they have proved their address (see lib/record-shares). Read live
 * every time, watermarked with who is looking, and logged.
 */
export default async function SharedRecordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const share = await findShare(token).catch(() => null);

  if (!share || share.state !== 'open') {
    return (
      <Frame>
        <h1 className="font-serif text-[28px] font-semibold">This link is not open</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[#5e6b7b]">
          {!share ? 'AIC could not find it. Check the whole link was copied.' : share.state === 'expired' ? `It expired on ${fmt(share.expiresAt)}.` : 'The organisation that shared it has withdrawn it.'}{' '}
          Ask the organisation to share the record with you again. AIC does not send copies of a record as files.
        </p>
      </Frame>
    );
  }

  const viewer = readViewerPass((await cookies()).get(SHARE_COOKIE)?.value, share.id);
  if (!viewer) {
    return (
      <Frame>
        <p className="text-[13px] font-medium text-[#8a6114]">Shared continuity record</p>
        <h1 className="mt-1 font-serif text-[28px] font-semibold leading-tight">{share.orgName}</h1>
        <p className="mt-2 text-[15px] text-[#5e6b7b]">{fmt(share.fromDate)} to {fmt(share.toDate)}</p>
        <div className="mt-6"><ShareGate token={token} hint={maskEmail(share.recipientEmail)} orgName={share.orgName} /></div>
        <p className="mt-5 text-[12.5px] leading-relaxed text-[#8a95a3]">The record stays on the AIC platform and is read live. Every view is recorded and visible to {share.orgName}.</p>
      </Frame>
    );
  }

  const record = await readContinuity(share.orgId, 100_000);
  const start = `${share.fromDate}T00:00:00.000Z`;
  const end = `${share.toDate}T23:59:59.999Z`;
  const events = record.events.filter((e) => e.observedAt >= start && e.observedAt <= end);
  await recordView(share, viewer, (await headers()).get('user-agent')).catch(() => {});
  const now = new Date();
  const mark = `${viewer}  ${now.toISOString().slice(0, 16).replace('T', ' ')} UTC`;

  return (
    <Frame wide>
      {/* Watermark: who is looking, and when, across the whole page. */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-40 overflow-hidden select-none print:fixed">
        <div className="absolute -inset-[50%] flex rotate-[-24deg] flex-wrap content-start gap-x-24 gap-y-28 opacity-[0.07]">
          {Array.from({ length: 160 }).map((_, i) => <span key={i} className="whitespace-nowrap text-[15px] font-semibold text-[#0e1b2c]">{mark}</span>)}
        </div>
      </div>
      <div className="space-y-6">
        <header className="border-b border-[#dde2e8] pb-6">
          <p className="text-[13px] font-medium text-[#8a6114]">Shared continuity record</p>
          <h1 className="mt-1 font-serif text-[30px] font-semibold leading-tight">{share.orgName}</h1>
          <p className="mt-2 text-[15px] text-[#5e6b7b]">
            {fmt(share.fromDate)} to {fmt(share.toDate)}. {events.length} {events.length === 1 ? 'entry' : 'entries'} in this period. Shared with {share.recipientName}{share.purpose ? ` for ${share.purpose}` : ''}; open until {fmt(share.expiresAt)}.
          </p>
        </header>
        <div className={`rounded-2xl border px-5 py-4 ${record.chain.valid ? 'border-[#2e7a57]/20 bg-[#2e7a57]/[0.05]' : 'border-[#b23a35]/30 bg-[#b23a35]/[0.06]'}`}>
          <p className={`text-[13px] font-semibold ${record.chain.valid ? 'text-[#2e7a57]' : 'text-[#b23a35]'}`}>{record.chain.valid ? 'Chain intact' : `Chain broken at #${record.chain.brokenAtSeq}`}</p>
          <p className="mt-1 text-[13px] leading-relaxed text-[#5e6b7b]">
            {record.chain.valid
              ? `AIC recomputed all ${record.total} entries in ${share.orgName}'s record just now, and each matches the one before it. The entries below are those that fall in the shared period; none can have been edited or removed.`
              : `${record.chain.reason}. The record cannot be relied on from that point, and AIC has been told.`}
          </p>
        </div>
        <section className="rounded-2xl border border-[#dde2e8] bg-white">
          <ContinuityFeed events={events} now={now.getTime()} chainOk={record.chain.valid} />
        </section>
        <footer className="border-t border-[#dde2e8] pt-5 text-[12.5px] leading-relaxed text-[#8a95a3]">
          Viewed by {viewer} on {now.toLocaleString('en-GB', { timeZone: 'Africa/Johannesburg' })} (South African time). This view is recorded. AIC does not issue copies of a continuity record as files; a copy, screenshot or printout is not verified by AIC. The record covers what was declared to AIC and what AIC observed, and is not a determination of legal compliance.
        </footer>
      </div>
    </Frame>
  );
}
