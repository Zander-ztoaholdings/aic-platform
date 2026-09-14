'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Takes an observation on demand.
 *
 * The result line is deliberately blunt about writing nothing. "No change
 * recorded" is the single most reassuring thing this record can say, and
 * hiding it behind a generic success toast would teach the user that pressing
 * the button always does something — which is exactly the habit that makes an
 * audit trail's length meaningless.
 */
export function ObserveButton({ firstRun }: { firstRun: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const observe = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/org/continuity', { method: 'POST' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Observation failed');
      const data = await res.json();
      setResult(
        data.eventsWritten === 0
          ? 'No change recorded. The estate is as it was at the last observation.'
          : `${data.eventsWritten} change${data.eventsWritten === 1 ? '' : 's'} recorded (#${data.fromSeq}–#${data.toSeq}).`
      );
      startTransition(() => router.refresh());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={observe}
        disabled={busy || pending}
        className="px-5 h-10 rounded-full bg-aic-navy text-white font-mono text-[10px] font-bold uppercase tracking-[0.15em] disabled:opacity-50 hover:bg-aic-gold transition-colors"
      >
        {busy || pending ? 'Observing…' : firstRun ? 'Begin the record' : 'Take an observation'}
      </button>
      {result && <p className="text-xs text-gray-500 max-w-xs text-right">{result}</p>}
      {error && <p className="text-xs text-red-600 max-w-xs text-right">{error}</p>}
    </div>
  );
}
