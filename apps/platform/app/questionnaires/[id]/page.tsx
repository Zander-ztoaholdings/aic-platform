'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Download, CheckCircle2 } from 'lucide-react';
import DashboardShell from '../../components/DashboardShell';
import { PageHeader } from '@/app/components/ui/PageHeader';

type Item = {
  id: string; position: number; question: string; draft: string | null; answer: string | null; topic: string | null;
  sources: { label: string; href: string }[]; status: 'draft' | 'needs_input' | 'approved'; approvedAt: string | null; approvedBy: string | null;
};
type Data = { questionnaire: { id: string; title: string; requester: string | null }; items: Item[]; canManage: boolean };
type Filter = 'all' | 'needs_input' | 'draft' | 'approved';

const CHIP: Record<Item['status'], { t: string; c: string }> = {
  draft: { t: 'Draft', c: 'bg-[#eef1f5] text-[#5e6b7b]' },
  needs_input: { t: 'Needs input', c: 'bg-[#b45309]/10 text-[#b45309]' },
  approved: { t: 'Approved', c: 'bg-[#2f7d4f]/10 text-[#2f7d4f]' },
};
const date = (v: string | null) => (v ? new Date(v).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

function ItemCard({ item, qid, onChange }: { item: Item; qid: string; onChange: () => void }) {
  const [text, setText] = useState(item.answer ?? item.draft ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { setText(item.answer ?? item.draft ?? ''); }, [item.answer, item.draft]);

  async function act(action: string, withText = true) {
    setBusy(true); setErr('');
    const r = await fetch(`/api/questionnaires/${qid}/items/${item.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...(withText ? { answer: text } : {}) }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(j.error ?? 'Could not save.'); return; }
    onChange();
  }

  const approved = item.status === 'approved';
  return (
    <li className="rounded-xl border border-[#dde2e8] bg-white p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium leading-relaxed text-[#0e1b2c]"><span className="text-[#8a95a3]">{item.position}.</span> {item.question}</p>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-medium ${CHIP[item.status].c}`}>{CHIP[item.status].t}</span>
      </div>
      {approved ? (
        <>
          <p className="mt-3 whitespace-pre-line rounded-xl bg-[#f5f7f9] px-4 py-3 text-sm leading-relaxed text-[#0e1b2c]">{item.answer}</p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-[#5e6b7b]">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-[#2f7d4f]" />Approved by {item.approvedBy ?? 'a team member'} on {date(item.approvedAt)}</span>
            <button onClick={() => act('reopen', false)} disabled={busy} className="inline-flex h-9 items-center rounded-full border border-[#dde2e8] bg-white px-4 text-[13px] font-medium text-[#0e1b2c] hover:border-[#a8772a]">Edit again</button>
          </div>
        </>
      ) : (
        <>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={Math.min(10, Math.max(4, Math.ceil(text.length / 90)))} className="mt-3 w-full rounded-xl border border-[#dde2e8] bg-white px-3.5 py-3 text-sm leading-relaxed text-[#0e1b2c] outline-none focus:border-[#a8772a] focus:ring-2 focus:ring-[#a8772a]/15" />
          {item.sources.length > 0 && (
            <p className="mt-2 text-[12px] text-[#5e6b7b]">Drafted from: {item.sources.map((s, i) => (
              <span key={s.href}>{i > 0 && ', '}<Link href={s.href} className="text-[#8a6a1f] hover:underline underline-offset-2">{s.label}</Link></span>
            ))}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button onClick={() => act('approve')} disabled={busy || !text.trim()} className="inline-flex h-10 items-center rounded-full bg-[#0e1b2c] px-4 text-[13px] font-medium text-white hover:bg-[#22344a] disabled:opacity-40">Approve answer</button>
            <button onClick={() => act('save')} disabled={busy} className="inline-flex h-10 items-center rounded-full border border-[#dde2e8] bg-white px-4 text-[13px] font-medium text-[#0e1b2c] hover:border-[#a8772a]">Save</button>
            {item.status !== 'needs_input' && <button onClick={() => act('needs_input', false)} disabled={busy} className="inline-flex h-10 items-center rounded-full border border-[#dde2e8] bg-white px-4 text-[13px] font-medium text-[#5e6b7b] hover:border-[#a8772a]">Needs input</button>}
            <button onClick={() => act('redraft', false)} disabled={busy} className="inline-flex h-10 items-center rounded-full px-3 text-[13px] font-medium text-[#8a6a1f] hover:underline underline-offset-2">Redraft from the record</button>
            {err && <span className="text-[13px] text-[#b42318]">{err}</span>}
          </div>
        </>
      )}
    </li>
  );
}

export default function QuestionnairePage() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<Data | null>(null);
  const [missing, setMissing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(() => {
    fetch(`/api/questionnaires/${id}`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : Promise.reject())).then(setD).catch(() => setMissing(true));
  }, [id]);
  useEffect(load, [load]);

  const counts = d ? { all: d.items.length, needs_input: d.items.filter((i) => i.status === 'needs_input').length, draft: d.items.filter((i) => i.status === 'draft').length, approved: d.items.filter((i) => i.status === 'approved').length } : null;
  const items = d ? d.items.filter((i) => filter === 'all' || i.status === filter) : [];

  return (
    <DashboardShell>
      <div className="max-w-4xl">
        {missing && <p className="text-sm text-[#5e6b7b]">This questionnaire doesn&apos;t exist. <Link href="/questionnaires" className="text-[#8a6a1f]">Back to questionnaires</Link></p>}
        {!d && !missing && <p className="text-sm text-[#5e6b7b]">Loading…</p>}
        {d && counts && (
          <>
            <PageHeader
              eyebrow={<Link href="/questionnaires" className="hover:underline underline-offset-2">Questionnaires</Link>}
              title={d.questionnaire.title}
              lede={`${counts.approved} of ${counts.all} answers approved${d.questionnaire.requester ? ` · for ${d.questionnaire.requester}` : ''}. Only approved answers go into the download.`}
              actions={
                <a href={`/api/questionnaires/${id}/export`} className="inline-flex h-11 items-center gap-2 rounded-full bg-[#0e1b2c] px-5 text-sm font-medium text-white hover:bg-[#22344a]">
                  <Download className="h-4 w-4" /> Download CSV
                </a>
              }
            />
            <div className="mb-2 h-1.5 rounded-full bg-[#eef1f5]"><div className="h-1.5 rounded-full bg-[#a8772a] transition-[width] duration-500" style={{ width: `${counts.all ? (counts.approved / counts.all) * 100 : 0}%` }} /></div>
            <div className="mb-5 mt-4 flex max-w-full overflow-x-auto">
              <div className="inline-flex rounded-full border border-[#dde2e8] bg-white p-1">
                {([['all', 'All'], ['needs_input', 'Needs input'], ['draft', 'Drafts'], ['approved', 'Approved']] as [Filter, string][]).map(([k, l]) => (
                  <button key={k} onClick={() => setFilter(k)} className={`h-9 whitespace-nowrap rounded-full px-4 text-sm font-medium ${filter === k ? 'bg-[#0e1b2c] text-white' : 'text-[#5e6b7b] hover:text-[#0e1b2c]'}`}>{l} <span className="opacity-60">{counts[k]}</span></button>
                ))}
              </div>
            </div>
            <ul className="space-y-3">
              {items.map((i) => <ItemCard key={i.id} item={i} qid={id} onChange={load} />)}
              {items.length === 0 && <li className="rounded-xl border border-[#dde2e8] bg-white p-5 text-sm text-[#5e6b7b]">Nothing here.</li>}
            </ul>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
