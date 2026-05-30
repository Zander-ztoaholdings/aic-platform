'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            const res = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await res.json();
            
            if (res.ok) {
                setMessage(data.message);
            } else {
                setError(data.error);
            }
        } catch {
            setError('Failed to connect to the server');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-aic-paper flex flex-col items-center justify-center p-6">
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md bg-aic-paper border border-aic-black/5 rounded-[2.5rem] p-12 shadow-2xl"
            >
                <div className="text-center mb-10">
                    <Link href="/login" className="font-serif text-3xl font-bold text-aic-black">
                        AIC<span className="text-aic-gold">.</span>
                    </Link>
                    <h1 className="text-xl font-serif font-bold text-aic-black mt-6">Restore Institutional Access</h1>
                    <p className="text-gray-500 font-serif mt-2 italic text-sm">
                        Enter your credentials to receive a secure recovery link.
                    </p>
                </div>

                {message ? (
                    <div className="bg-green-50 border border-green-100 p-6 rounded-2xl text-center">
                        <p className="text-sm font-serif text-green-800">{message}</p>
                        <Link href="/login" className="inline-block mt-6 font-mono text-[10px] font-bold text-aic-black uppercase tracking-widest border-b border-aic-black/20 hover:border-aic-black transition-all">
                            Return to Login
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-mono text-center">
                                {error}
                            </div>
                        )}
                        <div>
                            <label className="block text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest mb-3">Compliance Email</label>
                            <input
                                type="email"
                                required
                                className="w-full bg-aic-paper/50 border border-aic-black/10 rounded-xl p-4 font-serif text-sm focus:border-aic-gold outline-none transition-all"
                                placeholder="name@organization.co.za"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-aic-black text-aic-paper py-4 rounded-xl font-mono text-[10px] font-bold uppercase tracking-[0.3em] hover:bg-aic-gold hover:text-black transition-all disabled:opacity-50"
                        >
                            {loading ? 'PROCESSING...' : 'SEND_RECOVERY_LINK'}
                        </button>

                        <div className="text-center">
                            <Link href="/login" className="font-mono text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-aic-black transition-colors">
                                ← Back to Portal
                            </Link>
                        </div>
                    </form>
                )}
            </motion.div>
        </div>
    );
}
