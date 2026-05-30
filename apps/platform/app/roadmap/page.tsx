'use client';

import { useEffect, useState } from 'react';
import DashboardShell from '../components/DashboardShell';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import EvidenceModal from '../components/EvidenceModal';

interface Requirement {
    id: string;
    title: string;
    description: string;
    category: string;
    status: 'PENDING' | 'SUBMITTED' | 'VERIFIED' | 'REJECTED';
    findings?: string;
    evidence_url?: string;
}

export default function RoadmapPage() {
    const [requirements, setRequirements] = useState<Requirement[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedReq, setSelectedReq] = useState<Requirement | null>(null);

    const fetchRequirements = () => {
        fetch('/api/requirements')
            .then(res => res.json())
            .then(data => {
                setRequirements(data.requirements || []);
            })
            .catch(err => {
                console.error(err);
                setRequirements([]);
            });
    }

    useEffect(() => {
        fetchRequirements();
    }, []);

    const openUploadModal = (req: Requirement) => {
        setSelectedReq(req);
        setIsModalOpen(true);
    };

    const handleEvidenceSubmit = async (url: string) => {
        if (!selectedReq) return;

        try {
            const response = await fetch('/api/requirements', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: selectedReq.id, evidence_url: url })
            });

            if (response.ok) {
                toast.success('Institutional evidence submitted for verification.');
                fetchRequirements();
            } else {
                toast.error('Failed to submit evidence.');
            }
        } catch {
            toast.error('Network error during submission.');
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'VERIFIED': return 'text-green-600 bg-green-50 border-green-200';
            case 'SUBMITTED': return 'text-blue-600 bg-blue-50 border-blue-200';
            case 'REJECTED': return 'text-red-600 bg-red-50 border-red-200';
            default: return 'text-gray-500 bg-gray-50 border-gray-200';
        }
    };

    const verifiedCount = requirements.filter(r => r.status === 'VERIFIED').length;
    const progress = requirements.length > 0 ? (verifiedCount / requirements.length) * 100 : 0;

    return (
        <DashboardShell>
            <div className="max-w-5xl mx-auto pb-24">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
                    <div>
                        <h1 className="text-3xl font-serif font-bold text-aic-black">Certification Roadmap</h1>
                        <p className="text-gray-500 font-serif mt-2">Track your progress toward POPIA Section 71 compliance.</p>
                    </div>
                    <div className="glass-panel p-6 rounded-2xl w-full md:w-64">
                        <div className="flex justify-between items-end mb-2">
                            <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest">Progress</span>
                            <span className="text-2xl font-serif font-bold">{Math.round(progress)}%</span>
                        </div>
                        <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                            <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 1, ease: "easeOut" }}
                                className="h-full bg-aic-gold"
                            />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
                    {['DOCUMENTATION', 'TECHNICAL', 'OVERSIGHT'].map((cat) => (
                        <div key={cat} className="space-y-6">
                            <h3 className="font-mono text-xs font-bold text-aic-gold uppercase tracking-[0.3em] pl-2 border-l-2 border-aic-gold">
                                {cat}
                            </h3>
                            <div className="space-y-4">
                                {requirements.filter(r => r.category === cat).map((req, i) => (
                                    <motion.div 
                                        key={req.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.1 }}
                                        className="bg-aic-paper border border-aic-black/5 p-6 rounded-xl hover:shadow-md transition-all group"
                                    >
                                        <div className={`inline-block px-2 py-0.5 rounded text-[9px] font-mono font-bold border mb-4 ${getStatusColor(req.status)}`}>
                                            {req.status}
                                        </div>
                                        <h4 className="font-serif font-bold text-lg mb-2 group-hover:text-aic-gold transition-colors">{req.title}</h4>
                                        <p className="text-sm text-gray-500 font-serif leading-relaxed mb-6">
                                            {req.description}
                                        </p>

                                        {req.findings && (
                                            <div className="mb-6 p-4 bg-aic-paper border-l-2 border-aic-gold rounded-r-lg">
                                                <p className="text-[10px] font-mono font-bold text-aic-gold uppercase tracking-widest mb-1">Auditor Findings</p>
                                                <p className="text-xs font-serif italic text-gray-600 leading-relaxed">{req.findings}</p>
                                            </div>
                                        )}

                                        <button 
                                            onClick={() => req.status === 'PENDING' || req.status === 'REJECTED' ? openUploadModal(req) : null}
                                            className="w-full py-2 border border-aic-black/10 font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-aic-black hover:text-aic-paper transition-colors disabled:opacity-50"
                                        >
                                            {req.status === 'PENDING' || req.status === 'REJECTED' ? (req.status === 'REJECTED' ? 'Resubmit Evidence' : 'Submit Evidence') : 'Under Review'}
                                        </button>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Timeline Visualization */}
                <div className="bg-aic-black text-aic-paper p-12 rounded-3xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-aic-gold/10 rounded-full blur-3xl -mr-32 -mt-32" />
                    <h3 className="font-serif text-2xl mb-12">The Journey to AIC Certified</h3>
                    
                    <div className="relative">
                        <div className="absolute top-1/2 left-0 w-full h-px bg-aic-paper/10 -translate-y-1/2" />
                        <div className="grid grid-cols-4 gap-4 relative z-10">
                            {[
                                { step: 'Foundation', status: 'COMPLETE', icon: '01' },
                                { step: 'Gap Analysis', status: 'ACTIVE', icon: '02' },
                                { step: 'Remediation', status: 'PENDING', icon: '03' },
                                { step: 'Certification', status: 'PENDING', icon: '04' }
                            ].map((item, i) => (
                                <div key={i} className="text-center">
                                    <div className={`w-10 h-10 rounded-full mx-auto flex items-center justify-center font-mono text-xs mb-4 border ${
                                        item.status === 'COMPLETE' ? 'bg-aic-gold border-aic-gold text-aic-black' :
                                        item.status === 'ACTIVE' ? 'bg-aic-paper text-aic-black border-aic-paper' :
                                        'bg-transparent border-aic-paper/20 text-aic-paper/40'
                                    }`}>
                                        {item.icon}
                                    </div>
                                    <p className={`text-xs font-mono font-bold uppercase tracking-widest ${
                                        item.status === 'PENDING' ? 'text-aic-paper/20' : 'text-aic-paper'
                                    }`}>
                                        {item.step}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <EvidenceModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                requirement={selectedReq}
                onSubmit={handleEvidenceSubmit}
            />
        </DashboardShell>
    );
}
