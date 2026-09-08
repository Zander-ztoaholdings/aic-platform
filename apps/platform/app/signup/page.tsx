'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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
        confirmPassword: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

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
                    password: form.password
                })
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

    // The five Divisions, as published at aiccertified.cloud/certification.
    // Divisions are modes of operation, not grades — a Supervised organisation
    // is not worse than a Sovereign one, it is answering a different set of
    // requirements. This replaces an invented "AI Risk Tier" (Critical /
    // Elevated / Standard) that appeared nowhere in the standard, and which
    // meant the requirements generated at signup could not be right for anyone.
    const divisions = [
        { value: 1, label: '01 — Sovereign', desc: 'We make decisions. Humans make them. No AI in consequential decisions.' },
        { value: 2, label: '02 — Supervised', desc: 'AI assists. Humans decide. A named human makes every consequential decision.' },
        { value: 3, label: '03 — Reviewed', desc: 'AI decides. Humans review patterns and investigate flagged cases.' },
        { value: 4, label: '04 — Monitored', desc: 'AI decides at scale. Humans oversee aggregate behaviour.' },
        { value: 5, label: '05 — Artificial', desc: 'We build what others decide with. Accountability runs upstream.' }
    ];

    return (
        <div className="min-h-screen bg-aic-paper flex items-center justify-center p-8">
            <div className="max-w-lg w-full">
                <div className="text-center mb-12">
                    <h1 className="font-serif text-4xl font-bold text-aic-black mb-2">AIC.</h1>
                    <p className="text-[10px] font-mono text-gray-400 uppercase tracking-[0.4em]">AI Integrity Certification</p>
                    <p className="text-gray-500 font-serif mt-6 italic">Register your organization for POPIA Section 71 compliance certification.</p>
                </div>

                <form onSubmit={handleSubmit} className="bg-white p-10 rounded-3xl border border-aic-black/5 shadow-xl space-y-6">
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-serif">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest block mb-2">Organization Name</label>
                        <input
                            type="text"
                            required
                            value={form.orgName}
                            onChange={e => setForm(f => ({ ...f, orgName: e.target.value }))}
                            className="w-full border border-aic-black/10 rounded-xl px-4 py-3 font-serif text-sm focus:border-aic-gold outline-none transition-colors"
                            placeholder="e.g. Example Bank Ltd"
                        />
                    </div>

                    <div>
                        <label className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest block mb-2">Division</label>
                        <p className="text-[11px] text-gray-500 font-serif italic mb-3">
                            How consequential decisions are actually made in your organisation today. Divisions are modes of operation, not grades — this determines which requirements you are assessed against, not how well you score.
                        </p>
                        <div className="space-y-2">
                            {divisions.map(d => (
                                <label key={d.value} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${form.division === d.value ? 'border-aic-gold bg-aic-gold/5' : 'border-aic-black/5 hover:border-aic-black/10'}`}>
                                    <input
                                        type="radio"
                                        name="division"
                                        value={d.value}
                                        checked={form.division === d.value}
                                        onChange={() => setForm(f => ({ ...f, division: d.value }))}
                                        className="mt-1"
                                    />
                                    <div>
                                        <span className="text-sm font-bold font-serif text-aic-black">{d.label}</span>
                                        <p className="text-[10px] text-gray-400 font-mono mt-0.5">{d.desc}</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="border-t border-aic-black/5 pt-6">
                        <p className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest mb-4">Admin Account</p>
                        <div className="space-y-4">
                            <input
                                type="text"
                                required
                                value={form.name}
                                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                className="w-full border border-aic-black/10 rounded-xl px-4 py-3 font-serif text-sm focus:border-aic-gold outline-none transition-colors"
                                placeholder="Full name"
                            />
                            <input
                                type="email"
                                required
                                value={form.email}
                                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                className="w-full border border-aic-black/10 rounded-xl px-4 py-3 font-serif text-sm focus:border-aic-gold outline-none transition-colors"
                                placeholder="Email address"
                            />
                            <input
                                type="password"
                                required
                                minLength={8}
                                value={form.password}
                                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                className="w-full border border-aic-black/10 rounded-xl px-4 py-3 font-serif text-sm focus:border-aic-gold outline-none transition-colors"
                                placeholder="Password (min 8 characters)"
                            />
                            <input
                                type="password"
                                required
                                value={form.confirmPassword}
                                onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                                className="w-full border border-aic-black/10 rounded-xl px-4 py-3 font-serif text-sm focus:border-aic-gold outline-none transition-colors"
                                placeholder="Confirm password"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-aic-black text-white py-4 font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-aic-gold hover:text-black transition-all disabled:opacity-50"
                    >
                        {loading ? 'Creating Account...' : 'Register Organization'}
                    </button>

                    <p className="text-center text-xs text-gray-400 font-serif">
                        Already registered? <Link href="/login" className="text-aic-gold underline">Sign in</Link>
                    </p>
                </form>
            </div>
        </div>
    );
}
