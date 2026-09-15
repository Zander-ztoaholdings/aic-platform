'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// The five Divisions, as published at aiccertified.cloud/certification.
// Divisions are modes of operation, not grades — a Supervised organisation
// is not worse than a Sovereign one, it is answering a different set of
// requirements. This is the one real decision on this page, so it gets
// the room a decision deserves instead of living as a scrollable radio
// list wedged between two text inputs.
const DIVISIONS = [
  { value: 1, label: 'Sovereign', desc: 'We make decisions. Humans make them. No AI in consequential decisions.' },
  { value: 2, label: 'Supervised', desc: 'AI assists. Humans decide. A named human makes every consequential decision.' },
  { value: 3, label: 'Reviewed', desc: 'AI decides. Humans review patterns and investigate flagged cases.' },
  { value: 4, label: 'Monitored', desc: 'AI decides at scale. Humans oversee aggregate behaviour.' },
  { value: 5, label: 'Artificial', desc: 'We build what others decide with. Accountability runs upstream.' },
] as const;

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    orgName: '',
    // Division 2 (Supervised) is the most common starting point, but it is a
    // real choice — the Division decides which of the published
    // requirements apply, so it is not a default anyone should coast past.
    division: 2,
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const activeDivision = DIVISIONS.find((d) => d.value === form.division) ?? DIVISIONS[1];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgName: form.orgName,
          division: form.division,
          name: form.name,
          email: form.email,
          password: form.password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Registration failed');
        return;
      }

      router.push('/login?registered=true');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-aic-paper flex flex-col lg:flex-row">
      {/* Division panel — the actual decision, given the weight it deserves */}
      <div className="lg:w-[44%] bg-[#0A1728] text-white flex flex-col justify-between p-8 sm:p-12 lg:p-14">
        <div>
          <Link href="/" className="inline-block mb-14 lg:mb-20">
            <span className="font-serif text-2xl font-bold text-white">AIC.</span>
          </Link>
          <p className="text-[10px] font-mono text-white/40 uppercase tracking-[0.35em] mb-3">Step 1 of 2 — Division</p>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold leading-snug mb-3 text-balance">
            How are consequential decisions actually made today?
          </h1>
          <p className="text-sm text-white/50 leading-relaxed mb-10 max-w-sm">
            Not a grade — a mode of operation. This decides which of the published requirements apply to your
            organisation.
          </p>
        </div>

        <div role="radiogroup" aria-label="Division" className="space-y-0.5">
          {DIVISIONS.map((d) => {
            const active = form.division === d.value;
            return (
              <button
                type="button"
                key={d.value}
                role="radio"
                aria-checked={active}
                onClick={() => setForm((f) => ({ ...f, division: d.value }))}
                className={`w-full text-left flex gap-4 py-4 pl-5 pr-3 border-l-2 transition-all ${
                  active ? 'border-aic-gold bg-white/[0.05]' : 'border-white/10 hover:border-white/25'
                }`}
              >
                <span className={`font-mono text-xs pt-0.5 flex-shrink-0 ${active ? 'text-aic-gold' : 'text-white/30'}`}>
                  0{d.value}
                </span>
                <span className="min-w-0">
                  <span className={`block text-sm font-bold font-serif mb-1 ${active ? 'text-white' : 'text-white/55'}`}>
                    {d.label}
                  </span>
                  <span className={`block text-xs leading-relaxed ${active ? 'text-white/60' : 'text-white/25'}`}>
                    {d.desc}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <p className="text-[10px] font-mono text-white/25 uppercase tracking-[0.2em] mt-10 lg:mt-0">
          AI Integrity Certification
        </p>
      </div>

      {/* Account panel */}
      <div className="flex-1 flex items-center justify-center p-8 sm:p-12 lg:p-16">
        <div className="max-w-md w-full">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 mb-4">
              <span className="font-mono text-[10px] font-bold text-aic-gold uppercase tracking-widest">
                Division 0{activeDivision.value}
              </span>
              <span className="text-gray-300">·</span>
              <span className="font-mono text-[10px] text-gray-400 uppercase tracking-widest">{activeDivision.label}</span>
            </div>
            <h2 className="font-serif text-3xl font-bold text-aic-black mb-2 text-balance">Register your organisation</h2>
            <p className="text-gray-500 text-sm">For POPIA Section 71 compliance certification.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
            )}

            <div>
              <label htmlFor="su-org" className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest block mb-2">
                Organisation Name
              </label>
              <input
                id="su-org"
                type="text"
                required
                value={form.orgName}
                onChange={(e) => setForm((f) => ({ ...f, orgName: e.target.value }))}
                className="w-full border border-aic-black/10 rounded-xl px-4 py-3 text-sm text-aic-black focus:border-aic-gold outline-none transition-colors bg-white"
                placeholder="e.g. Example Bank Ltd"
              />
            </div>

            <div className="pt-5 border-t border-aic-black/5">
              <p className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest mb-4">Admin Account</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label htmlFor="su-name" className="sr-only">Full name</label>
                  <input
                    id="su-name"
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full border border-aic-black/10 rounded-xl px-4 py-3 text-sm text-aic-black focus:border-aic-gold outline-none transition-colors bg-white"
                    placeholder="Full name"
                  />
                </div>
                <div>
                  <label htmlFor="su-email" className="sr-only">Email address</label>
                  <input
                    id="su-email"
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full border border-aic-black/10 rounded-xl px-4 py-3 text-sm text-aic-black focus:border-aic-gold outline-none transition-colors bg-white"
                    placeholder="Email address"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="su-password" className="sr-only">Password</label>
                  <input
                    id="su-password"
                    type="password"
                    required
                    minLength={8}
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    className="w-full border border-aic-black/10 rounded-xl px-4 py-3 text-sm text-aic-black focus:border-aic-gold outline-none transition-colors bg-white"
                    placeholder="Password (min 8 characters)"
                  />
                </div>
                <div>
                  <label htmlFor="su-confirm" className="sr-only">Confirm password</label>
                  <input
                    id="su-confirm"
                    type="password"
                    required
                    value={form.confirmPassword}
                    onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                    className="w-full border border-aic-black/10 rounded-xl px-4 py-3 text-sm text-aic-black focus:border-aic-gold outline-none transition-colors bg-white"
                    placeholder="Confirm password"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-aic-black text-white py-4 font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-aic-gold hover:text-black transition-all disabled:opacity-50 rounded-xl"
            >
              {loading ? 'Creating Account…' : `Register as Division 0${activeDivision.value}`}
            </button>

            <p className="text-center text-xs text-gray-400">
              Already registered? <Link href="/login" className="text-aic-gold underline">Sign in</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
