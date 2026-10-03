'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';

export default function QualityControlPage() {
    const [tasks] = useState([
        { id: 'QC-102', entity: 'Example Bank Ltd Audit', auditor: 'Dr. Sarah Khumalo', status: 'PENDING', type: 'REPORT' },
        { id: 'QC-103', entity: 'Example Insurer SPI Policy', auditor: 'Auditor #04', status: 'FLAGGED', type: 'REQUIREMENT' },
        { id: 'QC-104', entity: 'Example Healthcare XAI', auditor: 'Dr. Sarah Khumalo', status: 'PENDING', type: 'REQUIREMENT' }
    ]);

    return (
        <div className="space-y-12">
            <div className="flex flex-col sm:flex-row sm:justify-between gap-5 sm:items-end border-b border-[#dde2e8] pb-6 md:pb-12">
                <div>
                    <h1 className="text-[2rem] leading-tight md:text-5xl font-serif font-medium tracking-tight tracking-tighter mb-4">Operations QC</h1>
                    <p className="text-gray-500 font-serif italic text-lg max-w-2xl">
                        Ensuring the highest standard of audit integrity. Secondary review board for all institutional certifications.
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-[12px] font-bold text-blue-700 first-cap mb-2">Internal Health</p>
                    <div className="text-2xl font-serif text-[#0e1b2c]">98.4% Accuracy</div>
                </div>
            </div>

            <div className="bg-white border border-[#dde2e8] rounded-[2.5rem] overflow-hidden">
                <div className="overflow-x-auto"><table className="min-w-[640px] w-full text-left">
                    <thead className="bg-[#f5f7f9] border-b border-[#dde2e8] text-[12px] font-bold text-gray-500 first-cap">
                        <tr>
                            <th className="p-5 md:p-8 text-center">Reference</th>
                            <th className="p-5 md:p-8">Audit Entity</th>
                            <th className="p-5 md:p-8">Originating Auditor</th>
                            <th className="p-5 md:p-8">Status</th>
                            <th className="p-5 md:p-8 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e6e9ee] font-serif">
                        {tasks.map((task, i) => (
                            <motion.tr 
                                key={task.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="hover:bg-[#eef1f5] transition-colors group"
                            >
                                <td className="p-5 md:p-8 text-center font-mono text-[11.5px] text-gray-600 group-hover:text-[#8a6a1f] transition-colors">{task.id}</td>
                                <td className="p-5 md:p-8 text-[#0e1b2c] font-bold tracking-tight">
                                    {task.entity}
                                    <span className="block text-[12px] text-gray-600 first-cap mt-1">{task.type}</span>
                                </td>
                                <td className="p-5 md:p-8 text-gray-500">{task.auditor}</td>
                                <td className="p-5 md:p-8">
                                    <span className={`px-3 py-1 rounded-full border text-[12px] font-bold first-cap ${
                                        task.status === 'PENDING' ? 'bg-aic-gold/10 text-[#8a6a1f] border-aic-gold/20' : 'bg-aic-red/10 text-aic-red border-aic-red/20'
                                    }`}>
                                        {task.status}
                                    </span>
                                </td>
                                <td className="p-5 md:p-8 text-right">
                                    <button className="bg-[#0e1b2c] text-white px-4 sm:px-6 py-2 rounded-xl text-[12px] font-bold first-cap hover:bg-[#22344a] transition-all shadow-xl">
                                        REVIEW_EVIDENCE
                                    </button>
                                </td>
                            </motion.tr>
                        ))}
                    </tbody>
                </table></div>
            </div>

            <div className="mt-12 p-6 md:p-12 bg-[#f5f7f9] border border-dashed border-[#dde2e8] rounded-[3rem] text-center">
                <p className="text-gray-600 font-serif italic text-sm mb-0 leading-relaxed">
                    Quality Control is mandatory for 10% of all Tier 3 audits and 100% of all Tier 1 audits prior to final registry anchoring.
                </p>
            </div>
        </div>
    );
}
