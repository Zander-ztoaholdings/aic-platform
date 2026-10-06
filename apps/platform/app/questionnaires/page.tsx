'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import DashboardShell from '../components/DashboardShell';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { SectionCard } from '@/app/components/ui/Eyebrow';

type Row = { id: string; title: string; requester: string | null; createdAt: string; total: number; approved: number; needsInput: number };
const field = 'w-full rounded-xl border border-[#dde2e8] bg-white px-3.5 text-sm text-[#0e1b2c] outline-none focus:border-[#a8772a] focus:ring-2 focus:ring-[#a8772a]/15';

export default function QuestionnairesPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [title, setTitle] = useState('');
  const [requester, setRequester] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch('/api/questionnaires', { cache: 'no-store' }).then((r) => r.json()).then((d) => setRows(d.questionnaires ?? [])).catch(() => setRows([]));
  }, []);

  async function create() {
    setBusy(true); setErr('');
    const r = await fetch('/api/questionnaires', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, requester, text }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(j.error ?? 'Could not start it.'); return; }
    router.push(`/questionnaires/${j.id}`);
  }

  const count = text.split('\n').filter((l) => l.trim().length >= 8).length;

  return (
    <DashboardShell>
      <div className="">
        <PageHeader
          eyebrow="AIC Certification"
          title="Questionnaires"
          lede="Paste a customer's security or AI questionnaire. AIC drafts each answer from your own record, says where it can't, and flags anything your systems contradict. A named person approves every answer before it goes out; the answers are yours, not AIC's."
        />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
          <SectionCard>
            <h2 className="text-[15px] font-semibold text-[#0e1b2c]">Start a questionnaire</h2>
            <label className="mt-4 block text-[13px] font-medium text-[#5e6b7b]" htmlFor="q-title">Name</label>
            <input id="q-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Standard Bank vendor assessment" className={`${field} mt-1.5 h-11`} />
            <label className="mt-4 block text-[13px] font-medium text-[#5e6b7b]" htmlFor="q-req">Who it is for <span className="font-normal text-[#8a95a3]">(optional)</span></label>
            <input id="q-req" value={requester} onChange={(e) => setRequester(e.target.value)} placeholder="Customer or contact" className={`${field} mt-1.5 h-11`} />
            <label className="mt-4 block text-[13px] font-medium text-[#5e6b7b]" htmlFor="q-text">Questions</label>
            <textarea id="q-text" value={text} onChange={(e) => setText(e.target.value)} rows={10} placeholder={'One question per line. Paste a column from Excel, a numbered list, or CSV.\n\n1. Do you enforce multi-factor authentication for all users?\n2. Do you use AI to make decisions about customers?'} className={`${field} mt-1.5 py-3 font-mono text-[13px]`} />
            <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-3">
              <button onClick={create} disabled={busy || !title.trim() || count === 0} className="inline-flex h-11 items-center justify-center rounded-full bg-[#0e1b2c] px-5 text-sm font-medium text-white hover:bg-[#22344a] disabled:opacity-40">
                {busy ? 'Drafting…' : `Draft ${count || ''} answer${count === 1 ? '' : 's'}`.replace('  ', ' ')}
              </button>
              {err && <span className="text-[13px] text-[#b42318]">{err}</span>}
            </div>
          </SectionCard>

          <div>
            <h2 className="mb-2 text-[14px] font-semibold text-[#0e1b2c]">Your questionnaires</h2>
            {!rows ? <p className="text-sm text-[#5e6b7b]">Loading…</p> : rows.length === 0 ? (
              <SectionCard><p className="text-[13px] text-[#5e6b7b]">None yet.</p></SectionCard>
            ) : (
              <ul className="space-y-2 lift-children">
                {rows.map((q) => (
                  <li key={q.id} className="contents">
                    <Link href={`/questionnaires/${q.id}`} className="group flex items-center justify-between gap-3 rounded-xl border border-[#dde2e8] bg-white p-4 hover:border-[#a8772a]">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-[#0e1b2c]">{q.title}</span>
                        <span className="block text-[12px] text-[#5e6b7b]">{q.approved} of {q.total} approved{q.needsInput ? `, ${q.needsInput} need input` : ''}</span>
                        <span className="mt-1.5 block h-1 rounded-full bg-[#eef1f5]"><span className="block h-1 rounded-full bg-[#a8772a]" style={{ width: `${q.total ? (q.approved / q.total) * 100 : 0}%` }} /></span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-[#9aa5b1] group-hover:text-[#8a6a1f]" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
