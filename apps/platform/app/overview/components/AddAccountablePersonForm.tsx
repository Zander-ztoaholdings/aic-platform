'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const inputClass =
  'w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-aic-navy focus:outline-none focus:border-aic-gold transition-colors bg-white';
const labelClass = 'block font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-1.5';

/**
 * Declare the organisation's accountable person, from the Accountability
 * panel itself rather than leaving it a permanently-red "No current
 * declaration on record."
 *
 * See app/api/accountable-person/route.ts for the HU-1/HU-2 rationale and
 * the note that the acceptance wording below is a placeholder for AIC's own
 * declaration text, not a substitute for it.
 */
export function AddAccountablePersonForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [email, setEmail] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function reset() {
    setName('');
    setJobTitle('');
    setEmail('');
    setAccepted(false);
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError('Name and email are required.');
      return;
    }
    if (!accepted) {
      setError('The declaration must be accepted to record it.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/accountable-person', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          jobTitle: jobTitle.trim() || undefined,
          email: email.trim(),
          accepted: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}) as { error?: string });
        throw new Error(data.error || 'Failed to record the declaration.');
      }

      reset();
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record the declaration.');
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
        + Declare an accountable person
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="border border-gray-200 rounded-lg p-4 bg-gray-50/60 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="ap-name" className={labelClass}>
            Full name
          </label>
          <input
            id="ap-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Thandiwe Mokoena"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="ap-title" className={labelClass}>
            Job title
          </label>
          <input
            id="ap-title"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="e.g. Chief Risk Officer"
            className={inputClass}
          />
          <p className="mt-1 text-[11px] text-gray-400">
            A job title alone is not an accountable person — this names who holds it.
          </p>
        </div>
      </div>

      <div>
        <label htmlFor="ap-email" className={labelClass}>
          Email
        </label>
        <input
          id="ap-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@organisation.com"
          className={inputClass}
        />
      </div>

      <label className="flex items-start gap-2.5 text-xs text-gray-600 bg-white border border-gray-200 rounded-md p-3">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-0.5 rounded border-gray-300"
        />
        <span>
          I, the named individual above, accept personal accountability for the AI systems this
          organisation declares to AIC, consistent with Human Agency requirement HU-2.
        </span>
      </label>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={submitting}
          className="bg-aic-navy text-white rounded-md px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider disabled:opacity-50"
        >
          {submitting ? 'Recording…' : 'Record declaration'}
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
