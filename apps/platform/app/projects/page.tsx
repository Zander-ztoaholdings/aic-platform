'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import DashboardShell from '../components/DashboardShell';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { PeekView } from '@/app/components/ui/PeekView';

/**
 * Projects: compliance work split the way the organisation runs it. Each
 * project has its own people, its own frameworks, the AI systems it touches,
 * and a task list. Evidence still counts once across the organisation.
 */

type Project = {
  id: string; name: string; description: string | null; status: 'active' | 'paused' | 'done'; leadId: string | null; dueDate: string | null; updatedAt: string;
  members: number; frameworks: string[]; systems: number; tasks: { total: number; done: number; overdue: number };
};
type Person = { id: string; name: string; email: string };

const STATUS: Record<Project['status'], { label: string; tone: string }> = {
  active: { label: 'Active', tone: 'text-[#2e7a57] bg-[#2e7a57]/10' },
  paused: { label: 'Paused', tone: 'text-[#8a6114] bg-[#a8772a]/10' },
  done: { label: 'Done', tone: 'text-[#5e6b7b] bg-[#eef1f5]' },
};
const date = (v: string | null) => (v ? new Date(`${v}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '');
const input = 'mt-1 h-11 w-full rounded-xl border border-[#dde2e8] bg-white px-3 text-[15px] font-normal outline-none focus:border-[#a8772a]';

export default function ProjectsPage() {
  const router = useRouter();
  const [data, setData] = useState<{ projects: Project[]; people: Person[]; canEdit: boolean; notReady?: boolean } | null>(null);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<'open' | 'all'>('open');

  const load = useCallback(async () => {
    const r = await fetch('/api/projects');
    setData(r.ok ? await r.json() : { projects: [], people: [], canEdit: false });
  }, []);
  useEffect(() => { load(); }, [load]);

  const people = new Map((data?.people ?? []).map((p) => [p.id, p.name]));
  const shown = (data?.projects ?? []).filter((p) => filter === 'all' || p.status !== 'done');

  return (
    <DashboardShell>
      <div className="max-w-[1100px] space-y-6">
        <PageHeader
          eyebrow="Compliance tracking"
          title="Projects"
          lede="Split compliance work the way you run it. Each project has its own people, the frameworks it must meet, the AI systems it touches, and its own tasks. Evidence still counts once, everywhere it applies."
          actions={data?.canEdit ? <button type="button" onClick={() => setCreating(true)} className="inline-flex h-11 items-center gap-2 rounded-full bg-[#0e1b2c] px-5 text-[14px] font-semibold text-white hover:bg-[#22344a]"><Plus className="h-4 w-4" /> New project</button> : undefined}
        />

        {data?.notReady && <p className="rounded-xl bg-[#a8772a]/[0.07] px-4 py-3 text-[14px] text-[#6f5418]">Projects are not switched on for this server yet. AIC needs to apply migration 021.</p>}

        {data && data.projects.length > 0 && (
          <div className="flex gap-1.5">
            {(['open', 'all'] as const).map((f) => (
              <button key={f} type="button" onClick={() => setFilter(f)} className={`inline-flex min-h-[36px] items-center rounded-full border px-3.5 text-[13.5px] font-medium ${filter === f ? 'border-[#0e1b2c] bg-[#0e1b2c] text-white' : 'border-[#dde2e8] bg-white text-[#0e1b2c] hover:border-[#a8772a]'}`}>
                {f === 'open' ? 'Active and paused' : 'All, including done'}
              </button>
            ))}
          </div>
        )}

        {data === null ? (
          <p className="text-[14px] text-[#5e6b7b]">Loading…</p>
        ) : shown.length === 0 && !data.notReady ? (
          <div className="rounded-2xl border border-[#dde2e8] bg-white px-6 py-10 text-center">
            <p className="text-[16px] font-semibold text-[#0e1b2c]">{data.projects.length ? 'No open projects.' : 'No projects yet.'}</p>
            <p className="mx-auto mt-1.5 max-w-lg text-[14px] leading-relaxed text-[#5e6b7b]">
              Start one for a piece of work with its own obligations: a new credit model that must meet POPIA section 71, or a payments rebuild that answers to PCI DSS.
            </p>
          </div>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {shown.map((p) => {
              const pct = p.tasks.total ? Math.round((p.tasks.done / p.tasks.total) * 100) : 0;
              return (
                <li key={p.id}>
                  <Link href={`/projects/${p.id}`} className="flex h-full flex-col rounded-2xl border border-[#dde2e8] bg-white p-5 hover:border-[#a8772a]/60">
                    <span className="flex items-start justify-between gap-3">
                      <span className="text-[16px] font-semibold text-[#0e1b2c]">{p.name}</span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[12px] font-medium ${STATUS[p.status].tone}`}>{STATUS[p.status].label}</span>
                    </span>
                    {p.description && <span className="mt-1 line-clamp-2 text-[13.5px] leading-relaxed text-[#5e6b7b]">{p.description}</span>}
                    <span className="mt-3 text-[13px] text-[#5e6b7b]">
                      {p.leadId && people.get(p.leadId) ? `Led by ${people.get(p.leadId)}. ` : ''}{p.members} {p.members === 1 ? 'person' : 'people'}, {p.frameworks.length} {p.frameworks.length === 1 ? 'framework' : 'frameworks'}, {p.systems} AI {p.systems === 1 ? 'system' : 'systems'}{p.dueDate ? `. Due ${date(p.dueDate)}` : ''}.
                    </span>
                    <span className="mt-3 block">
                      <span className="flex items-baseline justify-between text-[12.5px] text-[#5e6b7b]">
                        <span>{p.tasks.total ? `${p.tasks.done} of ${p.tasks.total} tasks done` : 'No tasks yet'}</span>
                        {p.tasks.overdue > 0 && <span className="font-medium text-[#b23a35]">{p.tasks.overdue} overdue</span>}
                      </span>
                      <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-[#eef1f5]"><span className="block h-full rounded-full bg-[#a8772a]" style={{ width: `${pct}%` }} /></span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {creating && data && <NewProject people={data.people} onClose={() => setCreating(false)} onDone={(id) => router.push(`/projects/${id}`)} />}
    </DashboardShell>
  );
}

function NewProject({ people, onClose, onDone }: { people: Person[]; onClose: () => void; onDone: (id: string) => void }) {
  const [f, setF] = useState({ name: '', description: '', leadId: '', dueDate: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function save() {
    setBusy(true); setErr('');
    const r = await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, leadId: f.leadId || null, dueDate: f.dueDate || null }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(j.error ?? 'Could not create the project.'); return; }
    onDone(j.id);
  }
  return (
    <PeekView title="New project" onClose={onClose} size="md" footer={<>
      <button type="button" onClick={save} disabled={busy || f.name.trim().length < 2} className="inline-flex h-11 items-center rounded-full bg-[#0e1b2c] px-5 text-sm font-semibold text-white hover:bg-[#22344a] disabled:opacity-40">{busy ? 'Creating…' : 'Create and set it up'}</button>
      <button type="button" onClick={onClose} className="h-11 px-3 text-sm font-medium text-[#5e6b7b] hover:text-[#0e1b2c]">Cancel</button>
    </>}>
      <div className="space-y-4">
        <label className="block text-[13px] font-medium text-[#0e1b2c]">Name<input className={input} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Credit scoring model v4" /></label>
        <label className="block text-[13px] font-medium text-[#0e1b2c]">What it is <span className="font-normal text-[#8a95a3]">(optional)</span>
          <textarea rows={3} className={`${input} h-auto py-2`} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="The work, and why it has obligations of its own" />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-[13px] font-medium text-[#0e1b2c]">Lead
            <select className={input} value={f.leadId} onChange={(e) => setF({ ...f, leadId: e.target.value })}>
              <option value="">Me</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="block text-[13px] font-medium text-[#0e1b2c]">Due <span className="font-normal text-[#8a95a3]">(optional)</span><input type="date" className={input} value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} /></label>
        </div>
        <p className="text-[13px] text-[#5e6b7b]">Next you choose its frameworks, people and AI systems, and add tasks.</p>
        {err && <p role="alert" className="text-[13.5px] text-[#b23a35]">{err}</p>}
      </div>
    </PeekView>
  );
}
