'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Eyebrow, SectionCard } from '@/app/components/ui/Eyebrow';

type Check = { status: 'ok' | 'error' | string; latency_ms?: number; detail?: string };
type Health = { status: string; checks: Record<string, Check>; timestamp: string };

const LABELS: Record<string, string> = {
  database: 'Database',
  engine: 'Audit engine',
  schema: 'Database schema',
  tenant_isolation: 'Tenant isolation',
  standard: 'AIC standard loaded',
};

/**
 * What the platform's own health check says, read live. The page used to be a
 * "coming soon" panel; /api/health already probes the engine, so this shows
 * that probe rather than promising telemetry nobody is collecting.
 */
export default function EngineOpsPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setBusy(true);
    fetch('/api/health', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => { setHealth(d); setFailed(false); })
      .catch(() => setFailed(true))
      .finally(() => setBusy(false));
  };
  useEffect(load, []);

  return (
    <div className="max-w-3xl space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <Eyebrow>HQ operations</Eyebrow>
          <h1 className="font-serif text-[30px] md:text-[34px] leading-tight font-semibold text-[#0e1b2c]">Audit engine and platform health</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5e6b7b] max-w-2xl">
            The same checks the uptime monitor reads at /api/health. If the engine shows as unreachable, the platform cannot run statistical audits.
          </p>
        </div>
        <button
          onClick={load}
          disabled={busy}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-[#dde2e8] bg-white px-5 text-sm font-medium text-[#0e1b2c] hover:border-[#a8772a] transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} /> Check again
        </button>
      </header>

      {failed && <p className="text-sm text-[#b42318]">The health check did not answer.</p>}

      {health && (
        <SectionCard className="p-0 overflow-hidden">
          <ul className="divide-y divide-[#e6e9ee]">
            {Object.entries(health.checks).map(([key, c]) => (
              <li key={key} className="flex items-start justify-between gap-4 px-5 py-3.5">
                <div className="flex items-start gap-3">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${c.status === 'ok' ? 'bg-[#2f7d4f]' : 'bg-[#b42318]'}`} />
                  <div>
                    <div className="text-sm font-medium text-[#0e1b2c]">{LABELS[key] ?? key}</div>
                    {c.detail && <div className="text-[13px] text-[#5e6b7b]">{c.detail}</div>}
                  </div>
                </div>
                <div className="text-right text-[13px] text-[#5e6b7b] whitespace-nowrap">
                  {c.status === 'ok' ? 'Working' : 'Not working'}
                  {typeof c.latency_ms === 'number' && <span className="block">{c.latency_ms} ms</span>}
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
      {health && (
        <p className="text-[13px] text-[#5e6b7b]">Checked {new Date(health.timestamp).toLocaleString('en-ZA')}.</p>
      )}
    </div>
  );
}
