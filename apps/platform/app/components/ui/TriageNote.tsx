import { Sparkles } from 'lucide-react';
import type { Triage } from '@/lib/ai/triage-shared';

const LABEL: Record<Triage['verdict'], string> = {
  looks_right: 'Looks like the right evidence',
  partly: 'Partly there',
  not_relevant: 'Does not look like evidence of this',
  unreadable: 'AIC could not read it',
};
const TONE: Record<Triage['verdict'], string> = {
  looks_right: 'border-[#2e7a57]/25 bg-[#2e7a57]/[0.05]',
  partly: 'border-[#a8772a]/30 bg-[#a8772a]/[0.06]',
  not_relevant: 'border-[#b45309]/30 bg-[#b45309]/[0.06]',
  unreadable: 'border-[#dde2e8] bg-[#f5f7f9]',
};

/** AIC's first read of a filed document. Labelled as such: it is never the assessor's decision. */
export function TriageNote({ triage, filename, compact = false }: { triage: Triage; filename?: string; compact?: boolean }) {
  return (
    <div className={`rounded-xl border ${TONE[triage.verdict]} ${compact ? 'px-3 py-2' : 'px-4 py-3'} text-left`}>
      <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[#0e1b2c]">
        <Sparkles className="h-3.5 w-3.5 text-[#8a6a1f]" />{LABEL[triage.verdict]}{filename ? <span className="font-normal text-[#5e6b7b]"> · {filename}</span> : null}
      </p>
      {triage.summary && <p className="mt-1 text-[13px] leading-relaxed text-[#5e6b7b]">{triage.summary}</p>}
      {triage.missing.length > 0 && (
        <ul className="mt-1 list-disc pl-5 text-[13px] leading-relaxed text-[#5e6b7b]">
          {triage.missing.map((m) => <li key={m}>{m}</li>)}
        </ul>
      )}
      <p className="mt-1 text-[11.5px] text-[#8a95a3]">AIC&apos;s first read{triage.documentDate ? `; the document is dated ${triage.documentDate}` : ''}. Not the assessor&apos;s decision.</p>
    </div>
  );
}
