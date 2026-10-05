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
                <div className="flex flex-col sm:flex-row sm:justify-between gap-5 sm:items-end border-b border-aic-black/5 pb-6 md:pb-8">
                    <div>
                        <h1 className="font-serif text-[30px] md:text-[34px] leading-tight font-semibold text-[#0e1b2c]">Institutional Subscriptions</h1>
                        <p className="mt-2 text-[15px] leading-relaxed text-[#5e6b7b] max-w-2xl">
                            Select the accountability tier required for your institutional risk profile.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
                    {tiers.map((tier) => (
                        <motion.div 
                            key={tier.name}
                            whileHover={{ y: -5 }}
                            className="bg-aic-paper border border-aic-black/5 rounded-xl p-6 md:p-10 flex flex-col"
                        >
                            <h3 className="text-[12px] font-bold text-aic-gold first-cap mb-6">{tier.name}</h3>
                            <div className="mb-10">
                                <span className="text-3xl md:text-4xl font-serif font-bold text-aic-black">{tier.price}</span>
                                <span className="text-gray-400 text-xs first-cap ml-2">/ month</span>
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
                                className="w-full inline-flex h-11 items-center justify-center rounded-full bg-[#0e1b2c] text-white text-sm font-medium hover:bg-[#22344a] disabled:opacity-50"
                            >
                                {loading === tier.id ? 'Connecting…' : `Choose ${tier.name}`}
                            </button>
                        </motion.div>
                    ))}
                </div>

                <div className="bg-[#080808] text-aic-paper p-6 md:p-12 rounded-xl shadow-2xl relative overflow-hidden">
                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
                        <div>
                            <h3 className="font-serif text-2xl font-bold mb-2">Custom Enterprise Frameworks</h3>
                            <p className="text-gray-400 font-serif italic max-w-xl">
                                For high-frequency trading platforms, sovereign government systems, or multinational deployments requiring custom regulatory mapping.
                            </p>
                        </div>
                        <button className="bg-aic-white text-aic-navy px-5 md:px-10 py-4 rounded-xl text-[12px] font-bold first-cap hover:bg-aic-gold transition-all">
                            Contact Lead Auditor
                        </button>
                    </div>
                </div>
            </div>
        </DashboardShell>
    );
}
