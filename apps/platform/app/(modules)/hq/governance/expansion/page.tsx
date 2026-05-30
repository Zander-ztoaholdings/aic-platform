'use client';

import { motion } from 'framer-motion';
import { SADC_LEGAL_REGISTRY } from '@aic/legal';

export default function RegionalExpansionPage() {
    const registry = Object.values(SADC_LEGAL_REGISTRY);

    return (
        <div className="space-y-16">
:apps/platform/app/(modules)/hq/governance/expansion/page.tsx
            <div className="flex justify-between items-end border-b border-aic-paper/5 pb-12">
                <div>
                    <h1 className="text-5xl font-serif font-medium tracking-tight tracking-tighter mb-4 text-aic-paper">Global Expansion</h1>
                    <p className="text-gray-500 font-serif italic text-lg max-w-2xl">
                        Strategic tracking of AIC institutional entry across global jurisdictions.
                    </p>
                </div>
                <div className="text-right text-aic-gold font-mono text-[10px] font-bold uppercase tracking-[0.4em]">
                    Global Scale: v1.0:apps/hq/app/governance/expansion/page.tsx
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8">
:apps/platform/app/(modules)/hq/governance/expansion/page.tsx
                {registry.map((j: any, i) => (
                    <motion.div 
                        key={j.jurisdiction || j.country}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-[#080808] border border-aic-paper/5 p-12 rounded-[3rem] relative overflow-hidden group hover:border-aic-gold/20 transition-all"
                    >
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-12 relative z-10">
                            <div className="lg:col-span-1 border-r border-aic-paper/5 pr-12">
                                <span className="text-[10px] font-mono font-bold text-gray-600 uppercase tracking-widest mb-4 block">Jurisdiction</span>
                                <h3 className="text-3xl font-serif font-bold text-aic-paper mb-2">{j.jurisdiction || j.country}</h3>:apps/hq/app/governance/expansion/page.tsx
                                <span className={`text-[8px] font-mono font-bold px-2 py-1 rounded border ${
                                    j.status === 'GOLD_STANDARD' ? 'border-green-500/20 text-green-500' : 'border-aic-gold/20 text-aic-gold'
                                }`}>
                                    {j.status}
                                </span>
                            </div>

                            <div className="lg:col-span-2">
                                <span className="text-[10px] font-mono font-bold text-gray-600 uppercase tracking-widest mb-4 block">Regulatory Mapping</span>
                                <p className="text-sm font-serif italic text-gray-400 mb-6">"{j.law}"</p>
                                <div className="flex flex-wrap gap-2">
:apps/platform/app/(modules)/hq/governance/expansion/page.tsx
                                    {j.rights.map((r: string) => (
                                        <span key={r} className="px-3 py-1 bg-aic-paper/5 rounded-lg text-[9px] font-mono text-gray-500 uppercase tracking-tighter italic">:apps/hq/app/governance/expansion/page.tsx
                                            {r}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="lg:col-span-1 flex flex-col justify-center">
                                <p className="text-[8px] font-mono text-gray-600 uppercase mb-2">Authority Engagement</p>
:apps/platform/app/(modules)/hq/governance/expansion/page.tsx
                                <p className="text-sm font-serif text-aic-paper mb-8 italic">{j.enforcement_body}</p>
                                <button className="bg-aic-paper text-black py-3 rounded-xl font-mono text-[9px] font-bold uppercase tracking-widest hover:bg-aic-gold transition-all">:apps/hq/app/governance/expansion/page.tsx
                                    INITIATE_ENTRY_PROTOCOL
                                </button>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
