'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ExternalLink } from 'lucide-react';
import DashboardShell from '../components/DashboardShell';
import { Eyebrow } from '../components/ui/Eyebrow';
import { useIntegrations, call, ago, type Check, type IntegrationsData } from '../integrations/useIntegrations';
import type { CheckDefinition } from '@/lib/integrations/catalog';

/**
 * Automated checks.
 *
 * Grouped by what is being checked, not by where it came from: someone fixing
 * "changes need an approving review" wants every repository that fails it in
 * one place. Failing checks first; a check AIC could not run is shown as such
 * and never counted as passing.
 */

const STATUS = {
  fail: { label: 'Failing', dot: 'bg-[#b23a35]', pill: 'text-[#b23a35] bg-[#b23a35]/10' },
  warn: { label: 'Waiting', dot: 'bg-[#b45309]', pill: 'text-[#b45309] bg-[#b45309]/10' },
  unknown: { label: 'Could not check', dot: 'bg-[#8a95a3]', pill: 'text-[#5e6b7b] bg-[#f5f7f9]' },
  pass: { label: 'Passing', dot: 'bg-[#2e7a57]', pill: 'text-[#2e7a57] bg-[#2e7a57]/10' },
} as const;
const ORDER: Check['status'][] = ['fail', 'warn', 'unknown', 'pass'];

function worst(cs: Check[]): Check['status'] {
  for (const s of ORDER) if (cs.some((c) => c.status === s)) return s;
  return 'pass';
}

const SUBJECT_NOUN: Record<string, [string, string]> = {
  github: ['repository', 'repositories'],
  microsoft: ['tenant', 'tenants'],
  openai: ['provider', 'providers'],
  anthropic: ['provider', 'providers'],
};

export default function ChecksPage() {
  const { data, error, reload } = useIntegrations();
  const [filter, setFilter] = useState<'failing' | 'all'>('failing');
  const [open, setOpen] = useState<string | null>(null);

  const groups = useMemo(() => {
    if (!data) return [];
    return data.catalog
      .map((def) => ({ def, checks: data.checks.filter((c) => c.checkKey === def.key) }))
      .filter((g) => g.checks.length > 0)
      .map((g) => ({ ...g, status: worst(g.checks) }))
      .sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));
  }, [data]);

  const counts = useMemo(() => {
    const c = { fail: 0, warn: 0, unknown: 0, pass: 0 };
    for (const ch of data?.checks ?? []) c[ch.status] += 1;
    return c;
  }, [data]);

  const shown = filter === 'failing' ? groups.filter((g) => g.status !== 'pass') : groups;
  const lastRun = data?.integrations.map((i) => i.lastSyncedAt).filter(Boolean).sort().pop() ?? null;

  return (
    <DashboardShell>
      <div className="space-y-7">
        <header>
          <Eyebrow>Compliance tracking</Eyebrow>
          <h1 className="font-serif text-[30px] md:text-[34px] leading-tight font-semibold text-[#0e1b2c]">Automated checks</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5e6b7b] max-w-2xl">
            What AIC found in your connected systems, each with why it matters and how to fix it. A check is evidence towards a control, not a
            verdict on it.
          </p>
        </header>

        {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-[14px] text-red-700">{error}</div>}
        {!data && !error && <p className="text-[14px] text-[#5e6b7b]">Loading…</p>}

        {data && data.integrations.length === 0 && (
          <div className="rounded-xl border border-dashed border-[#c9ced6] bg-white p-6 text-center">
            <p className="text-[15px] text-[#0e1b2c] font-medium">Nothing is connected yet.</p>
            <p className="mt-1 text-[14px] text-[#5e6b7b]">Connect GitHub or an AI provider and the first checks run straight away.</p>
            <Link href="/integrations" className="mt-4 inline-flex h-11 sm:h-10 items-center px-5 rounded-full bg-[#0e1b2c] text-white text-[14px] font-semibold hover:bg-[#22344a]">
              Connect a system
            </Link>
          </div>
        )}

        {data && data.integrations.length > 0 && (
          <>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <p className="text-[15px] text-[#0e1b2c]">
                  <span className="font-semibold">{counts.fail} failing</span>, {counts.pass} passing
                  {counts.unknown > 0 ? `, ${counts.unknown} could not be checked` : ''}
                  {counts.warn > 0 ? `, ${counts.warn} waiting` : ''}.
                </p>
                <p className="text-[13px] text-[#5e6b7b] mt-0.5">Last checked {ago(lastRun)}. Checked again every night.</p>
              </div>
              <div className="inline-flex rounded-full border border-[#dde2e8] bg-white p-1 self-start">
                {(['failing', 'all'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`h-9 px-4 rounded-full text-[14px] font-medium ${filter === f ? 'bg-[#0e1b2c] text-white' : 'text-[#5e6b7b] hover:text-[#0e1b2c]'}`}
                  >
                    {f === 'failing' ? 'Needs attention' : 'All checks'}
                  </button>
                ))}
              </div>
            </div>

            {groups.length === 0 && <p className="text-[14px] text-[#5e6b7b]">The first checks are running. This page fills in within a minute or two.</p>}
            {groups.length > 0 && shown.length === 0 && (
              <p className="rounded-xl border border-[#dde2e8] bg-white px-4 py-5 text-[14px] text-[#2e7a57]">Every check is passing.</p>
            )}

            <section className="bg-white border border-[#dde2e8] rounded-xl divide-y divide-[#e6e9ee] overflow-hidden">
              {shown.map(({ def, checks, status }) => (
                <CheckGroup
                  key={def.key}
                  def={def}
                  checks={checks}
                  status={status}
                  open={open === def.key}
                  onToggle={() => setOpen(open === def.key ? null : def.key)}
                  data={data}
                  reload={reload}
                />
              ))}
            </section>
          </>
        )}
      </div>
    </DashboardShell>
  );
}

function CheckGroup({ def, checks, status, open, onToggle, data, reload }: {
  def: CheckDefinition; checks: Check[]; status: Check['status']; open: boolean; onToggle: () => void; data: IntegrationsData; reload: () => void;
}) {
  const noun = SUBJECT_NOUN[checks[0]?.provider ?? 'github'] ?? ['item', 'items'];
  const n = checks.length;
  const of = (st: Check['status']) => checks.filter((c) => c.status === st).length;
  const tally =
    n === 1
      ? `${STATUS[status].label} for ${checks[0].subject}`
      : status === 'pass'
        ? `Passing in all ${n} ${noun[1]}`
        : status === 'fail'
          ? `Failing in ${of('fail')} of ${n} ${noun[1]}`
          : status === 'warn'
            ? `Waiting on ${of('warn')} of ${n} ${noun[1]}`
            : `Could not check ${of('unknown')} of ${n} ${noun[1]}`;
  const sorted = [...checks].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || a.subject.localeCompare(b.subject));

  return (
    <div>
      <button onClick={onToggle} aria-expanded={open} className="w-full text-left px-4 sm:px-5 py-4 flex items-start gap-3 hover:bg-[#fafbfc]">
        <span className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${STATUS[status].dot}`} aria-hidden />
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-semibold text-[#0e1b2c]">{def.title}</span>
          <span className="block text-[13px] text-[#5e6b7b] mt-0.5">{tally}</span>
        </span>
        <ChevronDown className={`w-4 h-4 mt-1 text-[#8a95a3] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-4 sm:px-5 pb-5 space-y-4">
          <p className="text-[14px] leading-relaxed text-[#5e6b7b] sm:pl-5">{def.why}</p>
          <ul className="sm:ml-5 rounded-xl border border-[#e6e9ee] divide-y divide-[#e6e9ee]">
            {sorted.map((c) => (
              <li key={c.id} className="p-3.5 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
                  <span className="text-[14px] font-medium text-[#0e1b2c] break-all">{c.subject}</span>
                  <span className={`self-start sm:self-auto text-[12px] font-medium px-2 py-0.5 rounded-full ${STATUS[c.status].pill}`}>{STATUS[c.status].label}</span>
                  {c.failingSince && <span className="text-[12px] text-[#8a95a3]">since {new Date(c.failingSince).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}</span>}
                </div>
                <p className="text-[13.5px] leading-relaxed text-[#5e6b7b]">{c.summary}</p>
                <Detail check={c} data={data} reload={reload} />
              </li>
            ))}
          </ul>
          {status !== 'pass' && (
            <div className="sm:ml-5 rounded-xl bg-[#fbf7ee] border border-[#e7d9b8] p-4">
              <p className="text-[13px] font-semibold text-[#8a6a1f]">How to fix it</p>
              <p className="mt-1 text-[14px] leading-relaxed text-[#0e1b2c]">{def.fix}</p>
            </div>
          )}
          <p className="sm:ml-5 text-[12.5px] text-[#8a95a3]">Evidence towards {def.controls.join(', ')}.</p>
        </div>
      )}
    </div>
  );
}

type PullRef = { number: number; title: string; url: string; author: string | null };

function Detail({ check, data, reload }: { check: Check; data: IntegrationsData; reload: () => void }) {
  const d = check.detail as { pulls?: PullRef[]; models?: { model: string; tokens: number }[]; libraries?: string[] };

  if (d.pulls && d.pulls.length > 0) {
    return (
      <ul className="space-y-1">
        {d.pulls.slice(0, 8).map((p) => (
          <li key={p.number} className="text-[13px]">
            <a href={p.url} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1 text-[#0e1b2c] hover:text-[#8a6a1f]">
              <span className="text-[#8a95a3]">#{p.number}</span> <span className="underline decoration-[#d5dbe2] underline-offset-2">{p.title}</span>
              <ExternalLink className="w-3 h-3 mt-1 shrink-0" />
            </a>
            {p.author && <span className="text-[#8a95a3]"> by {p.author}</span>}
          </li>
        ))}
        {d.pulls.length > 8 && <li className="text-[13px] text-[#8a95a3]">and {d.pulls.length - 8} more</li>}
      </ul>
    );
  }

  const people = (check.detail as { people?: ({ name: string; upn?: string; admin?: boolean } | string)[] }).people;
  if (people && people.length > 0) {
    return (
      <ul className="text-[13px] text-[#0e1b2c] space-y-0.5">
        {people.slice(0, 12).map((p, i) => (
          <li key={i}>{typeof p === 'string' ? p : `${p.name}${p.admin ? ' (administrator)' : ''}`}</li>
        ))}
        {people.length > 12 && <li className="text-[#8a95a3]">and {people.length - 12} more</li>}
      </ul>
    );
  }

  if (check.checkKey === 'github.ai_usage_declared') {
    return <LinkPicker provider="github" subject={check.subject} data={data} reload={reload} />;
  }

  if (check.checkKey === 'ai.models_declared' && d.models && check.provider) {
    return (
      <div className="space-y-2">
        {d.models.map((m) => (
          <div key={m.model} className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
            <span className="text-[13px] text-[#0e1b2c] sm:w-56 truncate">{m.model}</span>
            <LinkPicker provider={check.provider!} subject={m.model} data={data} reload={reload} />
          </div>
        ))}
      </div>
    );
  }
  return null;
}

function LinkPicker({ provider, subject, data, reload }: { provider: string; subject: string; data: IntegrationsData; reload: () => void }) {
  const current = data.integrations.find((i) => i.provider === provider)?.settings.links?.[subject] ?? '';
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function change(value: string) {
    setBusy(true);
    setErr('');
    const r = await call(`/api/integrations/${provider}`, 'PATCH', { subject, systemId: value === '' ? null : value });
    setBusy(false);
    if (!r.ok) setErr(r.error!);
    reload();
  }

  return (
    <div className="flex-1">
      <select
        value={current}
        disabled={busy}
        onChange={(e) => change(e.target.value)}
        aria-label={`Declared system for ${subject}`}
        className="w-full sm:w-auto rounded-lg border border-[#dde2e8] bg-white px-3 h-10 text-[14px] text-[#0e1b2c] outline-none focus:border-[#a8772a] disabled:opacity-50"
      >
        <option value="">Not linked</option>
        {data.systems.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
        <option value="none">Not used for automated decisions</option>
      </select>
      {data.systems.length === 0 && (
        <p className="mt-1 text-[12.5px] text-[#5e6b7b]">
          No systems declared yet. <Link href="/overview" className="text-[#8a6a1f] hover:underline">Declare one on the AI Estate page</Link>.
        </p>
      )}
      {err && <p className="mt-1 text-[12.5px] text-[#b23a35]">{err}</p>}
    </div>
  );
}
