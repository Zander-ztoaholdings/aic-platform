'use client';

import { useEffect, useState } from 'react';
import AdminShell from '../components/AdminShell';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

interface Requirement {
    id: string;
    org_id: string;
    title: string;
    description: string;
    category: string;
    status: 'PENDING' | 'SUBMITTED' | 'VERIFIED' | 'REJECTED';
    evidence_url?: string;
    findings?: string;
}

export default function VerificationPage() {
    const [organizations, setOrganizations] = useState<any[]>([]);
    const [selectedOrgId, setSelectedOrgId] = useState<string>('');
    const [requirements, setRequirements] = useState<Requirement[]>([]);
    const [loading, setLoading] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);

    useEffect(() => {
        // Fetch alpha organizations
        fetch('/api/organizations?is_alpha=true')
            .then(res => res.json())
            .then(data => {
                setOrganizations(data.organizations || []);
                if (data.organizations?.length > 0) {
                    setSelectedOrgId(data.organizations[0].id);
                }
            });
    }, []);

    useEffect(() => {
        if (!selectedOrgId) return;
        setLoading(true);
        fetch(`/api/requirements?org_id=${selectedOrgId}`)
            .then(res => res.json())
            .then(data => {
                setRequirements(data.requirements || []);
                setLoading(false);
            });
    }, [selectedOrgId]);

    const handleVerify = async (id: string, status: 'VERIFIED' | 'REJECTED', findings: string = '') => {
        setProcessingId(id);
        try {
            const res = await fetch('/api/requirements', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status, findings, org_id: selectedOrgId })
            });
            if (res.ok) {
                toast.success(`Requirement marked as ${status.toLowerCase()}.`);
                // Refresh requirements
                const data = await fetch(`/api/requirements?org_id=${selectedOrgId}`).then(r => r.json());
                setRequirements(data.requirements || []);
            } else {
                const error = await res.json();
                toast.error(error.error || 'Failed to verify requirement');
            }
        } catch {
            toast.error('Network error during verification');
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <AdminShell>
            <div className="max-w-6xl mx-auto pb-24">
                <div className="flex justify-between items-end mb-12">
                    <div>
                        <h1 className="text-3xl font-serif font-bold text-aic-paper">Lead Auditor Verification</h1>
                        <p className="text-gray-400 font-serif mt-2 italic">Reviewing evidence for POPIA Section 71 Certification.</p>
                    </div>
                    
                    <select 
                        value={selectedOrgId}
                        onChange={(e) => setSelectedOrgId(e.target.value)}
                        className="bg-zinc-900 border border-aic-paper/10 text-aic-paper font-mono text-xs p-3 rounded-lg focus:border-aic-gold outline-none"
                    >
                        {organizations.map(org => (
                            <option key={org.id} value={org.id}>{org.name}</option>
                        ))}
                    </select>
                </div>

                {loading ? (
                    <div className="text-center py-24 text-gray-500 font-serif italic">Loading requirement queue...</div>
                ) : (
                    <div className="grid grid-cols-1 gap-6">
                        {requirements.filter(r => r.status === 'SUBMITTED' || r.status === 'VERIFIED' || r.status === 'REJECTED').map((req) => (
                            <motion.div 
                                key={req.id}
                                layout
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="bg-zinc-900 border border-aic-paper/5 p-8 rounded-3xl"
                            >
                                <div className="flex justify-between items-start mb-8">
                                    <div className="max-w-2xl">
                                        <div className="flex items-center gap-4 mb-4">
                                            <span className="text-[10px] font-mono font-bold text-aic-gold uppercase tracking-[0.3em] px-2 py-1 bg-aic-gold/10 rounded">
                                                {req.category}
                                            </span>
                                            <span className={`text-[10px] font-mono font-bold uppercase tracking-widest ${
                                                req.status === 'VERIFIED' ? 'text-green-500' : 
                                                req.status === 'REJECTED' ? 'text-red-500' : 'text-blue-500'
                                            }`}>
                                                {req.status}
                                            </span>
                                        </div>
                                        <h3 className="text-xl font-serif text-aic-paper font-bold mb-2">{req.title}</h3>
                                        <p className="text-sm text-gray-400 font-serif leading-relaxed mb-6">{req.description}</p>
                                        
                                        {req.evidence_url && (
                                            <div className="mb-6">
                                                <p className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-widest mb-2">Submitted Evidence</p>
                                                <a
                                                    href={req.evidence_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-2 text-aic-gold hover:underline font-mono text-xs"
                                                >
                                                    View Document ↗
                                                </a>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-col gap-3 w-48">
                                        <button 
                                            onClick={() => handleVerify(req.id, 'VERIFIED')}
                                            disabled={!!processingId || req.status === 'VERIFIED'}
                                            className="w-full py-3 bg-green-600/10 border border-green-500/20 text-green-500 font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-green-600 hover:text-aic-paper transition-all disabled:opacity-30"
                                        >
                                            APPROVE
                                        </button>
                                        <button 
                                            onClick={() => {
                                                const findings = prompt('Enter rejection reason:');
                                                if (findings) handleVerify(req.id, 'REJECTED', findings);
                                            }}
                                            disabled={!!processingId || req.status === 'REJECTED'}
                                            className="w-full py-3 bg-red-600/10 border border-red-500/20 text-red-500 font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-red-600 hover:text-aic-paper transition-all disabled:opacity-30"
                                        >
                                            REJECT
                                        </button>
                                    </div>
                                </div>

                                {req.findings && (
                                    <div className="mt-8 p-4 bg-aic-paper/5 border border-aic-paper/5 rounded-xl">
                                        <p className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-widest mb-1">Last Finding</p>
                                        <p className="text-xs font-serif italic text-gray-400">{req.findings}</p>
                                    </div>
                                )}
                            </motion.div>
                        ))}

                        {requirements.length === 0 && (
                            <div className="text-center py-24 border border-dashed border-aic-paper/10 rounded-3xl">
                                <p className="text-gray-500 font-serif italic">No requirements submitted for this organization.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </AdminShell>
    );
}