'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';

function ResetPasswordForm() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get('token');

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    if (!token) {
        return (
            <div className="text-center p-8">
                <p className="text-red-500 font-serif">Invalid or missing reset token.</p>
                <Link href="/login" className="mt-4 inline-block font-mono text-[10px] font-bold uppercase underline">Return to Login</Link>
            </div>
        );
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        setLoading(true);

        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password })
            });
            const data = await res.json();

            if (res.ok) {
                setSuccess(true);
                setTimeout(() => router.push('/login'), 3000);
            } else {
                setError(data.error);
            }
        } catch {
            setError('Failed to reset password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full">
            <div className="text-center mb-10">
                <Link href="/login" className="font-serif text-3xl font-bold text-aic-black">
                    AIC<span className="text-aic-gold">.</span>
                </Link>
                <h1 className="text-xl font-serif font-bold text-aic-black mt-6">Secure Your Credentials</h1>
                <p className="text-gray-500 font-serif mt-2 italic text-sm">
                    Enter your new organizational password below.
                </p>
            </div>

            {success ? (
                <div className="bg-green-50 border border-green-100 p-6 rounded-2xl text-center">
                    <p className="text-sm font-serif text-green-800 italic">Institutional access restored. Redirecting to portal...</p>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                    {error && (
                        <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-mono text-center">
                            {error}
                        </div>
                    )}
                    
                    <div>
                        <label className="block text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest mb-3">New Password</label>
                        <input
                            type="password"
                            required
                            className="w-full bg-aic-paper/50 border border-aic-black/10 rounded-xl p-4 font-serif text-sm focus:border-aic-gold outline-none transition-all"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest mb-3">Confirm Password</label>
                        <input
                            type="password"
                            required
                            className="w-full bg-aic-paper/50 border border-aic-black/10 rounded-xl p-4 font-serif text-sm focus:border-aic-gold outline-none transition-all"
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-aic-black text-aic-paper py-4 rounded-xl font-mono text-[10px] font-bold uppercase tracking-[0.3em] hover:bg-aic-gold hover:text-black transition-all disabled:opacity-50"
                    >
                        {loading ? 'SECURING...' : 'FINALIZE_RESET'}
                    </button>
                </form>
            )}
        </div>
    );
}

export default function ResetPassword() {
    return (
        <div className="min-h-screen bg-aic-paper flex flex-col items-center justify-center p-6">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-md bg-aic-paper border border-aic-black/5 rounded-[2.5rem] p-12 shadow-2xl"
            >
                <Suspense fallback={<div className="text-center py-10 font-serif italic text-gray-400 uppercase tracking-widest text-[10px]">Loading Security Context...</div>}>
                    <ResetPasswordForm />
                </Suspense>
            </motion.div>
        </div>
    );
}
