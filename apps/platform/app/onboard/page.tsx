'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

function OnboardContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    
    const code = searchParams.get('code');
    const orgId = searchParams.get('org');

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.password !== formData.confirmPassword) {
            alert("Passwords do not match");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/auth/onboard', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    inviteCode: code,
                    orgId: orgId
                })
            });

            if (res.ok) {
                setSuccess(true);
                setTimeout(() => router.push('/login'), 3000);
            } else {
                const err = await res.json();
                alert(err.error || "Onboarding failed");
            }
        } catch {
            alert("Connection error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-aic-paper flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-aic-paper border border-aic-black/5 rounded-[2.5rem] p-12 shadow-2xl">
                <div className="mb-12 text-center">
                    <span className="text-4xl block mb-6">🥂</span>
                    <h1 className="text-3xl font-serif font-bold text-aic-black">Alpha Welcome.</h1>
                    <p className="text-gray-500 font-serif mt-4 italic">Initialize your organization's administrative core.</p>
                </div>

                {!success ? (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest mb-2">Full Name</label>
                            <input 
                                type="text" required
                                className="w-full bg-aic-paper border border-aic-black/10 rounded-xl p-4 font-serif focus:border-aic-gold outline-none transition-all"
                                onChange={(e) => setFormData({...formData, name: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest mb-2">Work Email</label>
                            <input 
                                type="email" required
                                className="w-full bg-aic-paper border border-aic-black/10 rounded-xl p-4 font-serif focus:border-aic-gold outline-none transition-all"
                                onChange={(e) => setFormData({...formData, email: e.target.value})}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest mb-2">Password</label>
                                <input 
                                    type="password" required
                                    className="w-full bg-aic-paper border border-aic-black/10 rounded-xl p-4 font-serif focus:border-aic-gold outline-none transition-all"
                                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest mb-2">Confirm</label>
                                <input 
                                    type="password" required
                                    className="w-full bg-aic-paper border border-aic-black/10 rounded-xl p-4 font-serif focus:border-aic-gold outline-none transition-all"
                                    onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                                />
                            </div>
                        </div>

                        <button 
                            type="submit"
                            disabled={loading || !code}
                            className="w-full bg-aic-black text-aic-paper py-4 rounded-xl font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-aic-gold hover:text-black transition-all disabled:opacity-50"
                        >
                            {loading ? 'INITIALIZING...' : 'CLAIM ACCESS'}
                        </button>
                    </form>
                ) : (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center"
                    >
                        <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-8">
                            <span className="text-3xl">🎉</span>
                        </div>
                        <h3 className="text-2xl font-serif font-bold text-aic-black mb-4">Onboarding Complete</h3>
                        <p className="text-gray-500 font-serif italic">Redirecting you to the AIC Intelligence Center...</p>
                    </motion.div>
                )}
            </div>
        </div>
    );
}

export default function OnboardPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-aic-paper flex items-center justify-center text-gray-400 font-serif italic">Loading secure invitation...</div>}>
            <OnboardContent />
        </Suspense>
    );
}
