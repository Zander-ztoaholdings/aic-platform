'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignupPage() {
    const router = useRouter();
    const [form, setForm] = useState({
        orgName: '',
        tier: 'TIER_2',
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
                    tier: form.tier,
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

    const tiers = [
        { value: 'TIER_1', label: 'Tier 1 — Critical', desc: '100% human approval (e.g. medical diagnosis, parole)' },
        { value: 'TIER_2', label: 'Tier 2 — Elevated', desc: 'Human supervision with override (e.g. credit, hiring)' },
        { value: 'TIER_3', label: 'Tier 3 — Standard', desc: 'Periodic monitoring (e.g. recommendations, spam)' }
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
                            placeholder="e.g. Standard Bank SA"
                        />
                    </div>

                    <div>
                        <label className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest block mb-2">AI Risk Tier</label>
                        <div className="space-y-2">
                            {tiers.map(t => (
                                <label key={t.value} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${form.tier === t.value ? 'border-aic-gold bg-aic-gold/5' : 'border-aic-black/5 hover:border-aic-black/10'}`}>
                                    <input
                                        type="radio"
                                        name="tier"
                                        value={t.value}
                                        checked={form.tier === t.value}
                                        onChange={e => setForm(f => ({ ...f, tier: e.target.value }))}
                                        className="mt-1"
                                    />
                                    <div>
                                        <span className="text-sm font-bold font-serif text-aic-black">{t.label}</span>
                                        <p className="text-[10px] text-gray-400 font-mono mt-0.5">{t.desc}</p>
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
