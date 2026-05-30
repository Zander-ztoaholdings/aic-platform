'use client';

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
            <div className="flex justify-between items-end border-b border-aic-paper/5 pb-12">
                <div>
                    <h1 className="text-5xl font-serif font-medium tracking-tight tracking-tighter mb-4">Lead Auditor Academy</h1>
                    <p className="text-gray-500 font-serif italic text-lg max-w-2xl">
                        Training the generation of accountability officers who will safeguard the continent's digital future.
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-mono font-bold text-aic-gold uppercase tracking-[0.4em] mb-2">Class of 2026</p>
                    <div className="text-4xl font-serif">58 Enrolled</div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {curriculum.map((item, i) => (
                    <motion.div 
                        key={item.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-[#080808] border border-aic-paper/5 p-10 rounded-[2.5rem] flex flex-col justify-between group hover:border-aic-gold/30 transition-all"
                    >
                        <div>
                            <div className="flex justify-between items-start mb-8">
                                <span className="px-3 py-1 rounded-full bg-aic-paper/5 border border-aic-paper/10 text-[8px] font-mono font-bold text-gray-500">
                                    {item.modules} MODULES
                                </span>
                                <span className={`text-[8px] font-mono font-bold uppercase tracking-widest ${item.status === 'LOCKED' ? 'text-gray-700' : 'text-aic-gold animate-pulse'}`}>
                                    {item.status}
                                </span>
                            </div>
                            <h3 className="text-2xl font-serif font-bold text-aic-paper mb-4 group-hover:text-aic-gold transition-colors tracking-tight">{item.title}</h3>
                            <p className="text-sm text-gray-500 font-serif leading-relaxed italic mb-8">"{item.description}"</p>
                        </div>
                        <Link 
                            href={item.status === 'LOCKED' ? '#' : `/training/curriculum/${item.id}`}
                            className={`w-full py-4 text-center rounded-xl font-mono text-[10px] font-bold uppercase tracking-widest transition-all ${
                                item.status === 'LOCKED' 
                                ? 'bg-zinc-900 text-zinc-700 cursor-not-allowed' 
                                : 'bg-aic-paper text-black hover:bg-aic-gold'
                            }`}
                        >
                            {item.status === 'LOCKED' ? 'PREREQUISITES_PENDING' : 'ENTER COURSE'}
                        </Link>
                    </motion.div>
                ))}
            </div>

            <div className="bg-gradient-to-r from-aic-gold/10 to-transparent border border-aic-gold/20 p-12 rounded-[3rem] flex justify-between items-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 opacity-5 font-serif italic text-6xl">Exam</div>
                <div className="max-w-xl">
                    <h4 className="font-serif text-2xl mb-4">Certification Examination</h4>
                    <p className="text-gray-400 font-serif italic leading-relaxed text-sm">
                        Candidates who complete all 3 domains are eligible for the Lead Auditor Board Exam. Passing authorizes you to issue AIC-Certified status to institutional entities.
                    </p>
                </div>
                <Link href="/training/exam" className="bg-aic-black border border-aic-paper/10 text-aic-paper px-10 py-4 font-mono text-[10px] font-bold uppercase tracking-[0.3em] hover:bg-aic-gold hover:text-black transition-all shadow-2xl">
                    INITIALIZE BOARD EXAM
                </Link>
            </div>
        </div>
    );
}