'use client';
import { Eyebrow } from '@/app/components/ui/Eyebrow';

import { motion } from 'framer-motion';
import { SADC_LEGAL_REGISTRY } from '@aic/legal';

export default function RegionalExpansionPage() {
    const registry = Object.values(SADC_LEGAL_REGISTRY);

    return (
        <div className="space-y-16">
:apps/platform/app/(modules)/hq/governance/expansion/page.tsx
            <div className="flex flex-col sm:flex-row sm:justify-between gap-5 sm:items-end border-b border-[#dde2e8] pb-6 md:pb-12">
                <div>
                    <Eyebrow>HQ regulation</Eyebrow>
                    <h1 className="font-serif text-[30px] md:text-[34px] leading-tight font-semibold text-[#0e1b2c]">Global Expansion</h1>
                    <p className="mt-2 text-[15px] leading-relaxed text-[#5e6b7b] max-w-2xl">
                        Strategic tracking of AIC institutional entry across global jurisdictions.
                    </p>
                </div>
                <div className="text-right text-[#8a6a1f] text-[12px] font-bold first-cap">
                    Global Scale: v1.0:apps/hq/app/governance/expansion/page.tsx
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:gap-8">
:apps/platform/app/(modules)/hq/governance/expansion/page.tsx
                {registry.map((j: any, i) => (
                    <motion.div 
                        key={j.jurisdiction || j.country}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-white border border-[#dde2e8] p-6 md:p-12 rounded-xl relative overflow-hidden group hover:border-aic-gold/20 transition-all"
                    >
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-12 relative z-10">
                            <div className="lg:col-span-1 border-r border-[#dde2e8] pr-12">
                                <span className="text-[12px] font-bold text-gray-600 first-cap mb-4 block">Jurisdiction</span>
                                <h3 className="text-3xl font-serif font-bold text-[#0e1b2c] mb-2">{j.jurisdiction || j.country}</h3>:apps/hq/app/governance/expansion/page.tsx
                                <span className={`text-[11px] font-mono font-bold px-2 py-1 rounded border ${
                                    j.status === 'GOLD_STANDARD' ? 'border-green-200 text-green-700' : 'border-aic-gold/20 text-[#8a6a1f]'
                                }`}>
                                    {j.status}
                                </span>
                            </div>

                            <div className="lg:col-span-2">
                                <span className="text-[12px] font-bold text-gray-600 first-cap mb-4 block">Regulatory Mapping</span>
                                <p className="text-sm font-serif italic text-gray-500 mb-6">"{j.law}"</p>
                                <div className="flex flex-wrap gap-2">
:apps/platform/app/(modules)/hq/governance/expansion/page.tsx
                                    {j.rights.map((r: string) => (
                                        <span key={r} className="px-3 py-1 bg-[#f5f7f9] rounded-lg text-[12px] text-gray-500 first-cap italic">:apps/hq/app/governance/expansion/page.tsx
                                            {r}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="lg:col-span-1 flex flex-col justify-center">
                                <p className="text-[12px] text-gray-600 first-cap mb-2">Authority Engagement</p>
:apps/platform/app/(modules)/hq/governance/expansion/page.tsx
                                <p className="text-sm font-serif text-[#0e1b2c] mb-8 italic">{j.enforcement_body}</p>
                                <button className="bg-[#0e1b2c] text-white py-3 rounded-xl text-[12px] font-bold first-cap hover:bg-[#22344a] transition-all">:apps/hq/app/governance/expansion/page.tsx
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
