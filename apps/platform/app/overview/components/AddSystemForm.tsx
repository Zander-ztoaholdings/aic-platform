'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const LIFECYCLE_STAGES = ['DEVELOPMENT', 'PRODUCTION', 'RETIRED'] as const;
type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];

const inputClass =
  'w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-aic-navy focus:outline-none focus:border-aic-gold transition-colors bg-white';
const labelClass = 'block font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-1.5';

/**
 * Declare an AI system from the AI Overview page.
 *
 * /api/ai-systems already had a working POST — nothing in the UI ever called
 * it. The "Add the first one" link on this page pointed at /workspace, a
 * differently-styled governance-workspace screen with a system *picker* but
 * no create form, so it was a dead end either way. This calls the existing
 * API directly instead of adding a second, redundant creation surface.
 *
 * After a successful declare, it also takes an on-demand continuity
 * observation (POST /api/org/continuity) so the new system shows up in the
 * continuity record immediately rather than waiting for the next scheduled
 * run — the point of this form is to watch the record react to what you
 * just did.
 */
export function AddSystemForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [riskTier, setRiskTier] = useState('1');
  const [lifecycleStage, setLifecycleStage] = useState<LifecycleStage>('DEVELOPMENT');
  const [isSandbox, setIsSandbox] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function reset() {
    setName('');
    setPurpose('');
    setRiskTier('1');
    setLifecycleStage('DEVELOPMENT');
    setIsSandbox(true);
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/ai-systems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          purpose: purpose.trim() || undefined,
          riskTier: Number(riskTier),
          lifecycleStage,
          isSandbox,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}) as { error?: string });
        throw new Error(data.error || 'Failed to declare the system.');
      }

      await fetch('/api/org/continuity', { method: 'POST' }).catch(() => {
        // Non-fatal: the system is declared either way. The next scheduled
        // observation will pick it up if this on-demand one failed.
      });

      reset();
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to declare the system.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-mono text-xs font-bold text-aic-gold underline underline-offset-2 hover:text-aic-navy transition-colors"
      >
        + Declare a system
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-gray-200 rounded-lg p-4 bg-gray-50/60 space-y-4"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="system-name" className={labelClass}>
            System name
          </label>
          <input
            id="system-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. claims-triage-agent"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="system-risk" className={labelClass}>
            Risk tier
          </label>
          <select
            id="system-risk"
            value={riskTier}
            onChange={(e) => setRiskTier(e.target.value)}
            className={inputClass}
          >
            {[1, 2, 3, 4, 5].map((t) => (
              <option key={t} value={t}>
                Tier {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="system-purpose" className={labelClass}>
          Purpose
        </label>
        <textarea
          id="system-purpose"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          placeholder="What this system decides or recommends, in one or two sentences."
          rows={2}
          className={inputClass}
        />
        <p className="mt-1 text-[11px] text-gray-400">
          Left blank, a production system without a stated purpose is exactly what the continuity record flags as a gap.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
        <div>
          <label htmlFor="system-lifecycle" className={labelClass}>
            Lifecycle stage
          </label>
          <select
            id="system-lifecycle"
            value={lifecycleStage}
            onChange={(e) => setLifecycleStage(e.target.value as LifecycleStage)}
            className={inputClass}
          >
            {LIFECYCLE_STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 pb-2.5">
          <input
            type="checkbox"
            checked={isSandbox}
            onChange={(e) => setIsSandbox(e.target.checked)}
            className="rounded border-gray-300"
          />
          Sandbox — not yet in production
        </label>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={submitting}
          className="bg-aic-navy text-white rounded-md px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider disabled:opacity-50"
        >
          {submitting ? 'Declaring…' : 'Declare system'}
        </button>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="text-xs font-mono text-gray-400 hover:text-gray-600"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
