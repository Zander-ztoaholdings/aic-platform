'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';

function VerifyEmailContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get('token');

    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('');

    useEffect(() => {
        const verify = async () => {
            if (!token) {
                setStatus('error');
                setMessage('Verification token is missing.');
                return;
            }

            try {
                const res = await fetch('/api/auth/verify-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token })
                });
                const data = await res.json();

                if (res.ok) {
                    setStatus('success');
                    setMessage(data.message);
                    setTimeout(() => router.push('/login'), 3000);
                } else {
                    setStatus('error');
                    setMessage(data.error);
                }
            } catch {
                setStatus('error');
                setMessage('Connection failure.');
            }
        };

        verify();
    }, [token, router]);

    return (
        <div className="text-center">
            <Link href="/" className="font-serif text-3xl font-bold text-aic-black inline-block mb-10">
                AIC<span className="text-aic-gold">.</span>
            </Link>

            {status === 'loading' && (
                <div className="space-y-6">
                    <div className="h-12 w-12 border-4 border-aic-gold border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="font-serif italic text-gray-500">Verifying Institutional Credentials...</p>
                </div>
            )}

            {status === 'success' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="h-16 w-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h1 className="text-xl font-serif font-bold text-aic-black mb-4">Credentials Verified</h1>
                    <p className="text-gray-500 font-serif mb-8">{message}</p>
                    <Link href="/login" className="font-mono text-[10px] font-bold text-aic-black uppercase tracking-widest border-b border-aic-black pb-1 hover:text-aic-gold hover:border-aic-gold transition-all">
                        Proceed to Portal
                    </Link>
                </motion.div>
            )}

            {status === 'error' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="h-16 w-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                    <h1 className="text-xl font-serif font-bold text-aic-black mb-4">Verification Failed</h1>
                    <p className="text-red-500 font-serif text-sm mb-8">{message}</p>
                    <Link href="/login" className="font-mono text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-aic-black transition-all">
                        ← Back to Login
                    </Link>
                </motion.div>
            )}
        </div>
    );
}

export default function VerifyEmailPage() {
    return (
        <div className="min-h-screen bg-aic-paper flex items-center justify-center p-6">
            <div className="w-full max-w-md bg-aic-paper border border-aic-black/5 rounded-[2.5rem] p-12 shadow-2xl">
                <Suspense fallback={<div>Loading...</div>}>
                    <VerifyEmailContent />
                </Suspense>
            </div>
        </div>
    );
}
