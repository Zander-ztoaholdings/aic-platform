'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AppealPortal() {
    const [step, setStep] = useState(1);
    const [trackingRef, setTrackingRef] = useState('');
    useEffect(() => {
        setTrackingRef('AIC-INC-' + Math.random().toString(36).substring(7).toUpperCase());
    }, []);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        orgName: '',
        systemName: '',
        citizen_email: '',
        description: '',
        decisionId: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            // In a real app, we'd look up org_id by orgName or from a pre-filled link
            const res = await fetch('/api/incidents/public', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            if (res.ok) setStep(3);
        } catch {
            alert("Failed to submit appeal. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-aic-paper flex flex-col items-center justify-center p-6">
            <div className="max-w-2xl w-full bg-aic-paper border border-aic-black/5 rounded-[3rem] p-12 shadow-2xl">
                <div className="mb-12 text-center">
                    <span className="text-4xl block mb-6">⚖️</span>
                    <h1 className="text-3xl font-serif font-bold text-aic-black">Citizen Appeal Portal</h1>
                    <p className="text-gray-500 font-serif mt-4 italic">Exercise your Right to Representation under POPIA Section 71.</p>
                </div>

                <AnimatePresence mode="wait">
                    {step === 1 && (
                        <motion.div 
                            key="step1"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <h3 className="font-mono text-[10px] font-bold text-aic-gold uppercase tracking-[0.4em] mb-8 text-center">Identify the Decision</h3>
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest mb-2">Organization Name</label>
                                    <input 
                                        type="text" 
                                        className="w-full bg-aic-paper border border-aic-black/10 rounded-xl p-4 font-serif focus:border-aic-gold outline-none transition-all"
                                        placeholder="e.g. FirstRand Bank"
                                        onChange={(e) => setFormData({...formData, orgName: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest mb-2">System/Model Name (Optional)</label>
                                    <input 
                                        type="text" 
                                        className="w-full bg-aic-paper border border-aic-black/10 rounded-xl p-4 font-serif focus:border-aic-gold outline-none transition-all"
                                        placeholder="e.g. LoanApproval-v2"
                                        onChange={(e) => setFormData({...formData, systemName: e.target.value})}
                                    />
                                </div>
                                <button 
                                    onClick={() => setStep(2)}
                                    className="w-full bg-aic-black text-aic-paper py-4 rounded-xl font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-aic-gold hover:text-black transition-all"
                                >
                                    PROCEED TO APPEAL
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {step === 2 && (
                        <motion.div 
                            key="step2"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <h3 className="font-mono text-[10px] font-bold text-aic-gold uppercase tracking-[0.4em] mb-8 text-center">Lodge Your Representation</h3>
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div>
                                    <label className="block text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest mb-2">Your Email Address</label>
                                    <input 
                                        type="email" required
                                        className="w-full bg-aic-paper border border-aic-black/10 rounded-xl p-4 font-serif focus:border-aic-gold outline-none transition-all"
                                        onChange={(e) => setFormData({...formData, citizen_email: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest mb-2">Reason for Appeal</label>
                                    <textarea 
                                        required rows={4}
                                        className="w-full bg-aic-paper border border-aic-black/10 rounded-xl p-4 font-serif focus:border-aic-gold outline-none transition-all"
                                        placeholder="Describe why you believe the automated decision should be reviewed by a human..."
                                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                                    />
                                </div>
                                <div className="flex gap-4">
                                    <button 
                                        type="button"
                                        onClick={() => setStep(1)}
                                        className="flex-1 border border-aic-black/10 py-4 rounded-xl font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-aic-paper transition-all"
                                    >
                                        BACK
                                    </button>
                                    <button 
                                        type="submit"
                                        disabled={loading}
                                        className="flex-[2] bg-aic-black text-aic-paper py-4 rounded-xl font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-aic-gold hover:text-black transition-all"
                                    >
                                        {loading ? 'SUBMITTING...' : 'SUBMIT APPEAL'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    )}

                    {step === 3 && (
                        <motion.div 
                            key="step3"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-center"
                        >
                            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-8 border border-green-100">
                                <span className="text-3xl">✅</span>
                            </div>
                            <h3 className="text-2xl font-serif font-bold text-aic-black mb-4">Appeal Lodged</h3>
                            <p className="text-gray-500 font-serif italic mb-8">
                                Your representation has been securely hashed and recorded in the organization's accountability queue. A human officer is required to review this within 72 hours.
                            </p>
                            <p className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest">Tracking Reference</p>
                            <p className="font-mono text-xs text-aic-gold select-all">{trackingRef || 'AIC-INC-\u2026'}</p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
            
            <p className="mt-12 text-[10px] font-mono font-bold text-gray-400 uppercase tracking-[0.2em]">
                Powered by the AIC Immutable Trust Registry
            </p>
        </div>
    );
}
