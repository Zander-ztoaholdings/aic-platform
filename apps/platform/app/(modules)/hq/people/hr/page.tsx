'use client';

import { motion } from 'framer-motion';

export default function InstitutionalRolesPage() {
    const roles = [
        {
            title: "Lead Auditor",
            grade: "L7",
            mandate: "Final certification authority for institutional entities.",
            requirements: [
                "5+ years ISO/IEC 17021 experience",
                "Certified AIC Lead Auditor status",
                "Legal degree or equivalent POPIA expertise"
            ],
            responsibilities: [
                "Final sign-off on Integrity Scores",
                "SANAS witness audit representation",
                "High-stakes client consultation"
            ],
            color: "text-[#8a6a1f]"
        },
        {
            title: "Technical Audit Lead",
            grade: "L6",
            mandate: "Guardian of the AIC Audit Engine integrity.",
            requirements: [
                "MSc in Data Science or Mathematics",
                "Expertise in XAI and Fairness metrics",
                "Advanced Python/Pandas proficiency"
            ],
            responsibilities: [
                "Audit Engine maintenance",
                "Technical bias report validation",
                "Red-team model auditing"
            ],
            color: "text-blue-700"
        },
        {
            title: "Regulatory Advisor",
            grade: "L6",
            mandate: "Ensuring framework alignment with evolving SA law.",
            requirements: [
                "LLB with ICT/Privacy focus",
                "Admission as an Attorney (High Court)",
                "POPIA Section 71 deep-domain knowledge"
            ],
            responsibilities: [
                "MoU drafting for Regulators",
                "Amicus Curiae brief development",
                "Legal risk mapping for clients"
            ],
            color: "text-green-700"
        }
    ];

    return (
        <div className="space-y-16">
            <div className="flex flex-col sm:flex-row sm:justify-between gap-5 sm:items-end border-b border-[#dde2e8] pb-6 md:pb-12">
                <div>
                    <h1 className="text-[2rem] leading-tight md:text-5xl font-serif font-medium tracking-tight tracking-tighter mb-4">Institutional Roles</h1>
                    <p className="text-gray-500 font-serif italic text-lg max-w-2xl">
                        Defining the standards of excellence for the generation of accountability officers.
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-[12px] font-bold text-gray-600 first-cap mb-2">Registry Version</p>
                    <div className="text-2xl font-serif text-[#0e1b2c]">Standard 3.1</div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:gap-8">
                {roles.map((role, i) => (
                    <motion.div 
                        key={role.title}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-white border border-[#dde2e8] rounded-[3rem] p-6 md:p-12 hover:border-[#dde2e8] transition-all group relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-6 md:p-12 opacity-5 font-serif italic text-8xl group-hover:opacity-10 transition-opacity">{role.grade}</div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-12 relative z-10">
                            <div className="lg:col-span-1">
                                <span className={`text-[12px] font-bold first-cap mb-4 block ${role.color}`}>Department Mandate</span>
                                <h3 className="text-3xl font-serif font-bold text-[#0e1b2c] mb-6">{role.title}</h3>
                                <p className="text-gray-500 font-serif italic leading-relaxed">"{role.mandate}"</p>
                            </div>

                            <div className="lg:col-span-1">
                                <span className="text-[12px] font-bold text-gray-600 first-cap mb-6 block">Requirements</span>
                                <ul className="space-y-4">
                                    {role.requirements.map((req, j) => (
                                        <li key={j} className="flex gap-3 text-xs font-mono text-gray-500">
                                            <span className={role.color}>•</span>
                                            {req}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="lg:col-span-1">
                                <span className="text-[12px] font-bold text-gray-600 first-cap mb-6 block">Responsibilities</span>
                                <ul className="space-y-4">
                                    {role.responsibilities.map((res, k) => (
                                        <li key={k} className="flex gap-3 text-xs font-serif text-gray-500 italic">
                                            <span className={role.color}>→</span>
                                            {res}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            <div className="p-6 md:p-12 border border-dashed border-[#dde2e8] rounded-[3rem] text-center bg-[#f5f7f9]">
                <p className="text-gray-600 font-serif italic text-sm mb-8">
                    Looking to join the mission? All applicants must undergo the preliminary ethics screening.
                </p>
                <button className="bg-[#0e1b2c] text-white px-5 md:px-10 py-4 text-[12px] font-bold first-cap hover:bg-[#22344a] transition-all shadow-2xl">
                    INITIATE RECRUITMENT FLOW
                </button>
            </div>
        </div>
    );
}
