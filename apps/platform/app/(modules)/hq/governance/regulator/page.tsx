'use client';

import { motion } from 'framer-motion';

export default function RegulatorRelationsPage() {
    const engagementLog = [
        { date: "2026-01-15", event: "Initial Briefing Paper submitted to Information Regulator (South Africa).", status: "ACKNOWLEDGED" },
        { date: "2026-02-01", event: "Virtual consultation with POPIA enforcement sub-committee.", status: "COMPLETED" },
        { date: "2026-02-10", event: "Submission of AIC 3-Tier Framework for Regulatory Sandbox consideration.", status: "PENDING" }
    ];

    return (
        <div className="space-y-12">
            <div className="flex justify-between items-end border-b border-aic-paper/5 pb-12">
                <div>
                    <h1 className="text-5xl font-serif font-medium tracking-tight mb-4 tracking-tighter text-aic-paper">Information Regulator</h1>
                    <p className="text-gray-500 font-serif italic text-lg max-w-2xl">
                        Formalizing the institutional relationship between AIC and the POPIA enforcement authority.
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-mono font-bold text-aic-gold uppercase tracking-[0.4em] mb-2">MoU Progress</p>
                    <div className="text-4xl font-serif">Phase 02 / 04</div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                {/* MoU Draft Section */}
                <div className="bg-[#080808] border border-aic-paper/5 p-12 rounded-[3rem] shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-12 opacity-5 font-serif italic text-6xl">DRAFT</div>
                    <h3 className="font-serif text-2xl mb-8 text-aic-paper">Memorandum of Understanding (MoU)</h3>
                    <div className="prose prose-invert prose-sm font-serif italic text-gray-400 space-y-6">
                        <p>1. **Objective:** To establish a voluntary certification mechanism that demonstrates compliance with POPIA Section 71.</p>
                        <p>2. **Data Sharing:** AIC to provide aggregated, de-identified bias reports to the Regulator to inform national AI policy.</p>
                        <p>3. **Referral Mechanism:** The Regulator may refer organizations seeking technical compliance verification to AIC-Accredited Lead Auditors.</p>
                        <p>4. **Joint Standards:** Co-development of "Meaningful Human Intervention" benchmarks for high-risk automated systems.</p>
                    </div>
                    <button className="mt-12 w-full bg-aic-paper text-black py-4 font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-aic-gold transition-all shadow-xl">
                        DOWNLOAD FULL PROPOSAL
                    </button>
                </div>

                {/* Engagement Log */}
                <div className="space-y-8">
                    <h3 className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-[0.4em]">Engagement Registry</h3>
                    <div className="space-y-4">
                        {engagementLog.map((log, i) => (
                            <motion.div 
                                key={i}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }}
                                className="bg-aic-paper/[0.02] border border-aic-paper/5 p-6 rounded-2xl flex justify-between items-center group hover:border-aic-gold/20 transition-all"
                            >
                                <div className="max-w-md">
                                    <p className="text-[9px] font-mono text-gray-600 mb-2 uppercase">{log.date}</p>
                                    <p className="font-serif text-sm text-gray-300 leading-relaxed italic">"{log.event}"</p>
                                </div>
                                <span className={`text-[8px] font-mono font-bold px-2 py-1 rounded border ${
                                    log.status === 'COMPLETED' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-aic-gold/10 text-aic-gold border-aic-gold/20'
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
