'use client';

import { useState } from 'react';
import DashboardShell from '../../components/DashboardShell';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export default function BillingSettings() {
    const [loading, setLoading] = useState<string | null>(null);

    const handleSubscribe = async (priceId: string) => {
        setLoading(priceId);
        try {
            const res = await fetch('/api/billing/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ priceId })
            });
            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                toast.error(data.error || 'Failed to initiate checkout.');
            }
        } catch {
            toast.error('Network error while connecting to Stripe.');
        } finally {
            setLoading(null);
        }
    };

    const tiers = [
        {
            name: 'Standard',
            id: 'price_standard',
            price: 'R 5,000',
            features: ['Automated Bias Audits', 'Monthly Compliance Reports', 'Email Support', '1 System Registry']
        },
        {
            name: 'Elevated',
            id: 'price_elevated',
            price: 'R 15,000',
            features: ['Everything in Standard', 'Intersectional Analysis', 'Priority Verification', '5 System Registries', 'Incident Management']
        },
        {
            name: 'Critical',
            id: 'price_critical',
            price: 'R 50,000',
            features: ['Everything in Elevated', 'Unlimited Systems', 'Quarterly Lead Auditor Review', 'Custom SLA', 'On-Premise Deployment Support']
        }
    ];

    return (
        <DashboardShell>
            <div className="max-w-5xl mx-auto space-y-12 pb-24">
                <div className="flex justify-between items-end border-b border-aic-black/5 pb-8">
                    <div>
                        <h1 className="text-4xl font-serif font-bold text-aic-black tracking-tighter">Institutional Subscriptions</h1>
                        <p className="text-gray-500 font-serif mt-4 italic text-lg leading-relaxed">
                            Select the accountability tier required for your institutional risk profile.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {tiers.map((tier) => (
                        <motion.div 
                            key={tier.name}
                            whileHover={{ y: -5 }}
                            className="bg-aic-paper border border-aic-black/5 rounded-[2.5rem] p-10 shadow-xl flex flex-col"
                        >
                            <h3 className="text-[10px] font-mono font-bold text-aic-gold uppercase tracking-[0.4em] mb-6">{tier.name}</h3>
                            <div className="mb-10">
                                <span className="text-4xl font-serif font-bold text-aic-black">{tier.price}</span>
                                <span className="text-gray-400 font-mono text-xs uppercase tracking-widest ml-2">/ month</span>
                            </div>
                            
                            <ul className="space-y-4 mb-12 flex-1">
                                {tier.features.map((f) => (
                                    <li key={f} className="flex items-start gap-3 text-sm font-serif text-gray-600 leading-relaxed">
                                        <svg className="w-4 h-4 text-aic-gold mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                        {f}
                                    </li>
                                ))}
                            </ul>

                            <button 
                                onClick={() => handleSubscribe(tier.id)}
                                disabled={!!loading}
                                className="w-full bg-aic-black text-aic-paper py-4 rounded-xl font-mono text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-aic-gold hover:text-black transition-all disabled:opacity-50"
                            >
                                {loading === tier.id ? 'CONNECTING...' : `SELECT_${tier.name.toUpperCase()}_TIER`}
                            </button>
                        </motion.div>
                    ))}
                </div>

                <div className="bg-[#080808] text-aic-paper p-12 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-12 opacity-5 font-serif italic text-6xl select-none uppercase">Billing</div>
                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
                        <div>
                            <h3 className="font-serif text-2xl font-bold mb-2">Custom Enterprise Frameworks</h3>
                            <p className="text-gray-400 font-serif italic max-w-xl">
                                For high-frequency trading platforms, sovereign government systems, or multinational deployments requiring custom regulatory mapping.
                            </p>
                        </div>
                        <button className="bg-aic-white text-aic-navy px-10 py-4 rounded-xl font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-aic-gold transition-all">
                            Contact Lead Auditor
                        </button>
                    </div>
                </div>
            </div>
        </DashboardShell>
    );
}
