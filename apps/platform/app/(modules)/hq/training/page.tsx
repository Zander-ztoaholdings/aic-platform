'use client';
import { Eyebrow } from '@/app/components/ui/Eyebrow';

import { motion } from 'framer-motion';
import Link from 'next/link';

export default function AuditorAcademy() {
    const curriculum = [
        {
            title: "Legal Domain: POPIA Section 71",
            description: "Deep dive into the legal requirements for meaningful human intervention in South Africa.",
            modules: 4,
            status: "IN_PROGRESS",
            id: "legal-71"
        },
        {
            title: "Technical Domain: Bias Audit",
            description: "Mastering the Four-Fifths rule, Chi-Square testing, and the AIC Audit Engine.",
            modules: 6,
            status: "IN_PROGRESS",
            id: "tech-bias"
        },
        {
            title: "Oversight Domain: Human-in-Loop",
            description: "Evaluating the efficacy of intervention UIs and human agency ratios.",
            modules: 3,
            status: "IN_PROGRESS",
            id: "oversight-hil"
        }
    ];

    return (
        <div className="space-y-12">
            <div className="flex flex-col sm:flex-row sm:justify-between gap-5 sm:items-end border-b border-[#dde2e8] pb-6 md:pb-12">
                <div>
                    <Eyebrow>HQ operations</Eyebrow>
                    <h1 className="font-serif text-[30px] md:text-[34px] leading-tight font-semibold text-[#0e1b2c]">Lead Auditor Academy</h1>
                    <p className="mt-2 text-[15px] leading-relaxed text-[#5e6b7b] max-w-2xl">
                        Training the generation of accountability officers who will safeguard the continent's digital future.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
                {curriculum.map((item, i) => (
                    <motion.div 
                        key={item.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-white border border-[#dde2e8] p-6 md:p-10 rounded-xl flex flex-col justify-between group hover:border-aic-gold/30 transition-all"
                    >
                        <div>
                            <div className="flex justify-between items-start mb-8">
                                <span className="px-3 py-1 rounded-full bg-[#f5f7f9] border border-[#dde2e8] text-[11px] font-bold text-gray-500">
                                    {item.modules} modules
                                </span>
                                <span className="text-[12px] font-medium text-[#5e6b7b]">
                                    {item.status === 'LOCKED' ? 'Locked' : 'Available'}
                                </span>
                            </div>
                            <h3 className="text-2xl font-serif font-bold text-[#0e1b2c] mb-4 group-hover:text-[#8a6a1f] transition-colors tracking-tight">{item.title}</h3>
                            <p className="text-sm text-gray-500 font-serif leading-relaxed italic mb-8">"{item.description}"</p>
                        </div>
                        <Link 
                            href={item.status === 'LOCKED' ? '#' : `/hq/training/curriculum/${item.id}`}
                            className={`w-full py-4 text-center rounded-xl text-[12px] font-bold first-cap transition-all ${
                                item.status === 'LOCKED' 
                                ? 'bg-white text-zinc-700 cursor-not-allowed' 
                                : 'bg-aic-paper text-black hover:bg-aic-gold'
                            }`}
                        >
                            {item.status === 'LOCKED' ? 'Prerequisites pending' : 'Enter course'}
                        </Link>
                    </motion.div>
                ))}
            </div>

            <div className="bg-gradient-to-r from-aic-gold/10 to-transparent border border-aic-gold/20 p-6 md:p-12 rounded-xl flex justify-between items-center relative overflow-hidden">
                <div className="max-w-xl">
                    <h4 className="font-serif text-2xl mb-4">Certification Examination</h4>
                    <p className="text-gray-500 font-serif italic leading-relaxed text-sm">
                        Candidates who complete all 3 domains are eligible for the Lead Auditor Board Exam. Passing authorizes you to issue AIC-Certified status to institutional entities.
                    </p>
                </div>
                <Link href="/hq/training/exam" className="bg-white border border-[#dde2e8] text-[#0e1b2c] px-5 md:px-10 py-4 text-[12px] font-bold first-cap hover:bg-aic-gold hover:text-black transition-all">
                    Start the board exam
                </Link>
            </div>
        </div>
    );
}