'use client';
import { Eyebrow } from '@/app/components/ui/Eyebrow';

import { motion } from 'framer-motion';

export default function RegulatorRelationsPage() {
    const engagementLog = [
        { date: "2026-01-15", event: "Initial Briefing Paper submitted to Information Regulator (South Africa).", status: "ACKNOWLEDGED" },
        { date: "2026-02-01", event: "Virtual consultation with POPIA enforcement sub-committee.", status: "COMPLETED" },
        { date: "2026-02-10", event: "Submission of AIC 3-Tier Framework for Regulatory Sandbox consideration.", status: "PENDING" }
    ];

    return (
        <div className="space-y-12">
            <div className="flex flex-col sm:flex-row sm:justify-between gap-5 sm:items-end border-b border-[#dde2e8] pb-6 md:pb-12">
                <div>
                    <Eyebrow>HQ regulation</Eyebrow>
                    <h1 className="font-serif text-[30px] md:text-[34px] leading-tight font-semibold text-[#0e1b2c]">Information Regulator</h1>
                    <p className="mt-2 text-[15px] leading-relaxed text-[#5e6b7b] max-w-2xl">
                        Formalizing the institutional relationship between AIC and the POPIA enforcement authority.
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-[12px] font-bold text-[#8a6a1f] first-cap mb-2">MoU Progress</p>
                    <div className="text-3xl md:text-4xl font-serif">Phase 02 / 04</div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-12">
                {/* MoU Draft Section */}
                <div className="bg-white border border-[#dde2e8] p-6 md:p-12 rounded-xl relative overflow-hidden">
                    <h3 className="font-serif text-2xl mb-8 text-[#0e1b2c]">Memorandum of Understanding (MoU)</h3>
                    <div className="prose prose-invert prose-sm font-serif italic text-gray-500 space-y-6">
                        <p>1. **Objective:** To establish a voluntary certification mechanism that demonstrates compliance with POPIA Section 71.</p>
                        <p>2. **Data Sharing:** AIC to provide aggregated, de-identified bias reports to the Regulator to inform national AI policy.</p>
                        <p>3. **Referral Mechanism:** The Regulator may refer organizations seeking technical compliance verification to AIC-Accredited Lead Auditors.</p>
                        <p>4. **Joint Standards:** Co-development of "Meaningful Human Intervention" benchmarks for high-risk automated systems.</p>
                    </div>
                    <button className="mt-12 w-full bg-[#0e1b2c] text-white py-4 text-[12px] font-bold first-cap hover:bg-[#22344a] transition-all shadow-xl">
                        Download the full proposal
                    </button>
                </div>

                {/* Engagement Log */}
                <div className="space-y-8">
                    <h3 className="text-[12px] font-bold text-gray-500 first-cap">Engagement Registry</h3>
                    <div className="space-y-4">
                        {engagementLog.map((log, i) => (
                            <motion.div 
                                key={i}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }}
                                className="bg-[#f5f7f9] border border-[#dde2e8] p-4 sm:p-6 rounded-2xl flex justify-between items-center group hover:border-aic-gold/20 transition-all"
                            >
                                <div className="max-w-md">
                                    <p className="text-[12px] text-gray-600 mb-2 first-cap">{log.date}</p>
                                    <p className="font-serif text-sm text-gray-700 leading-relaxed italic">"{log.event}"</p>
                                </div>
                                <span className={`text-[11px] font-bold px-2 py-1 rounded border ${
                                    log.status === 'COMPLETED' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-aic-gold/10 text-[#8a6a1f] border-aic-gold/20'
                                }`}>
                                    {log.status}
                                </span>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
