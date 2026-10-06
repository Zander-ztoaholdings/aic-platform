import { Info } from 'lucide-react';

export const STATUS: Record<string, { label: string; tone: string }> = {
  draft: { label: 'Draft', tone: 'bg-[#eef1f5] text-[#5e6b7b]' },
  active: { label: 'On', tone: 'bg-[#2e7a57]/10 text-[#2e7a57]' },
  paused: { label: 'Paused', tone: 'bg-[#b45309]/12 text-[#b45309]' },
};
export const RUN_STATUS: Record<string, { label: string; tone: string }> = {
  running: { label: 'Running', tone: 'bg-[#eef1f5] text-[#0e1b2c]' },
  waiting_for_person: { label: 'Waiting for a person', tone: 'bg-[#b45309]/12 text-[#b45309]' },
  completed: { label: 'Finished', tone: 'bg-[#2e7a57]/10 text-[#2e7a57]' },
  failed: { label: 'Failed', tone: 'bg-[#b23a35]/12 text-[#b23a35]' },
  stopped: { label: 'Stopped', tone: 'bg-[#eef1f5] text-[#5e6b7b]' },
  refused: { label: 'Refused', tone: 'bg-[#b23a35]/12 text-[#b23a35]' },
};

export function ToolsNotice({ text }: { text: string }) {
  return (
    <p className="flex gap-2.5 rounded-xl border border-[#dde2e8] bg-white px-4 py-3 text-[13.5px] leading-relaxed text-[#5e6b7b]">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#a8772a]" />{text}
    </p>
  );
}
