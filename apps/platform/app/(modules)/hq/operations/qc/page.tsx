'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';

export default function QualityControlPage() {
    const [tasks] = useState([
        { id: 'QC-102', entity: 'Capitec Bank Audit', auditor: 'Dr. Sarah Khumalo', status: 'PENDING', type: 'REPORT' },
        { id: 'QC-103', entity: 'Discovery SPI Policy', auditor: 'Auditor #04', status: 'FLAGGED', type: 'REQUIREMENT' },
        { id: 'QC-104', entity: 'Investec Health XAI', auditor: 'Dr. Sarah Khumalo', status: 'PENDING', type: 'REQUIREMENT' }
    ]);

    return (
        <div className="space-y-12">
            <div className="flex justify-between items-end border-b border-aic-paper/5 pb-12">
                <div>
                    <h1 className="text-5xl font-serif font-medium tracking-tight tracking-tighter mb-4">Operations QC</h1>
                    <p className="text-gray-500 font-serif italic text-lg max-w-2xl">
                        Ensuring the highest standard of audit integrity. Secondary review board for all institutional certifications.
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-mono font-bold text-blue-400 uppercase tracking-[0.4em] mb-2">Internal Health</p>
                    <div className="text-2xl font-serif text-aic-paper">98.4% Accuracy</div>
                </div>
            </div>

            <div className="bg-[#080808] border border-aic-paper/5 rounded-[2.5rem] overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-aic-paper/[0.02] border-b border-aic-paper/5 font-mono text-[9px] font-bold text-gray-500 uppercase tracking-[0.3em]">
                        <tr>
                            <th className="p-8 text-center">Reference</th>
                            <th className="p-8">Audit Entity</th>
                            <th className="p-8">Originating Auditor</th>
                            <th className="p-8">Status</th>
                            <th className="p-8 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-aic-paper/5 font-serif">
                        {tasks.map((task, i) => (
                            <motion.tr 
                                key={task.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="hover:bg-aic-paper/[0.01] transition-colors group"
                            >
                                <td className="p-8 text-center font-mono text-[10px] text-gray-600 group-hover:text-aic-gold transition-colors">{task.id}</td>
                                <td className="p-8 text-aic-paper font-bold tracking-tight">
                                    {task.entity}
                                    <span className="block text-[8px] font-mono text-gray-600 uppercase tracking-widest mt-1">{task.type}</span>
                                </td>
                                <td className="p-8 text-gray-400">{task.auditor}</td>
                                <td className="p-8">
                                    <span className={`px-3 py-1 rounded-full border text-[8px] font-mono font-bold uppercase tracking-widest ${
                                        task.status === 'PENDING' ? 'bg-aic-gold/10 text-aic-gold border-aic-gold/20' : 'bg-aic-red/10 text-aic-red border-aic-red/20'
                                    }`}>
                                        {task.status}
                                    </span>
                                </td>
                                <td className="p-8 text-right">
                                    <button className="bg-aic-paper text-black px-6 py-2 rounded-xl font-mono text-[9px] font-bold uppercase tracking-widest hover:bg-aic-gold transition-all shadow-xl">
                                        REVIEW_EVIDENCE
                                    </button>
                                </td>
                            </motion.tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mt-12 p-12 bg-aic-paper/[0.01] border border-dashed border-aic-paper/5 rounded-[3rem] text-center">
                <p className="text-gray-600 font-serif italic text-sm mb-0 leading-relaxed">
                    Quality Control is mandatory for 10% of all Tier 3 audits and 100% of all Tier 1 audits prior to final registry anchoring.
                </p>
            </div>
        </div>
    );
}
