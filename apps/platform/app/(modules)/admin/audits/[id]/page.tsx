'use client';

import { useEffect, useState, use } from 'react';
import AdminShell from '../../components/AdminShell';
import { motion } from 'framer-motion';

export default function AuditsDetailPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
    const params = use(paramsPromise);
    const orgId = params.id;
    const [requirements, setRequirements] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [findings, setFindings] = useState<Record<string, string>>({});

    const fetchData = () => {
        fetch(`/api/requirements?org_id=${orgId}`)
            .then(res => res.json())
            .then(data => {
                setRequirements(data.requirements || []);
                const initialFindings: Record<string, string> = {};
                data.requirements?.forEach((r: any) => {
                    initialFindings[r.id] = r.findings || '';
                });
                setFindings(initialFindings);
                setLoading(false);
            });
    }

    useEffect(() => {
        fetchData();
    }, [orgId]);

    const handleAction = async (reqId: string, status: string) => {
        try {
            const response = await fetch('/api/requirements', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    id: reqId, 
                    status, 
                    findings: findings[reqId],
                    org_id: orgId 
                })
            });

            if (response.ok) {
                fetchData();
            }
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <AdminShell>
            <div className="max-w-5xl mx-auto space-y-12">
                <div className="flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-serif font-bold text-aic-paper tracking-tight">Requirement Verification</h1>
                        <p className="text-gray-500 font-serif mt-2 italic">Detailed evidence review for Organization ID: {orgId.substring(0, 8)}</p>
                    </div>
                </div>

                <div className="space-y-6">
                    {loading ? (
                        <div className="p-12 text-center text-gray-500 italic">Syncing with secure vault...</div>
                    ) : requirements.map((req, i) => (
                        <motion.div 
                            key={req.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="bg-[#1c1c1c] border border-gray-800 p-8 rounded-3xl group"
                        >
                            <div className="flex justify-between items-start mb-8">
                                <div>
                                    <span className="text-[10px] font-mono font-bold text-blue-500 uppercase tracking-widest">{req.category}</span>
                                    <h3 className="text-2xl font-serif text-aic-paper mt-2">{req.title}</h3>
                                    <p className="text-gray-500 font-serif text-sm mt-2">{req.description}</p>
                                </div>
                                <div className={`px-3 py-1 rounded text-[10px] font-mono font-bold uppercase ${
                                    req.status === 'VERIFIED' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                                    req.status === 'REJECTED' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                    'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                }`}>
                                    {req.status}
                                </div>
                            </div>

                            <div className="bg-black/40 border border-aic-paper/5 p-6 rounded-xl mb-8">
                                <p className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-widest mb-4">Evidence URL</p>
                                {req.evidence_url ? (
                                    <a href={req.evidence_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 font-mono text-xs break-all underline decoration-blue-500/30 underline-offset-4">
                                        {req.evidence_url}
                                    </a>
                                ) : (
                                    <p className="text-gray-600 font-serif italic text-sm">No evidence submitted yet.</p>
                                )}
                            </div>

                            <div className="mb-8">
                                <p className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-widest mb-4">Auditor Findings / Remediation Advice</p>
                                <textarea 
                                    className="w-full bg-black/40 border border-aic-paper/10 rounded-xl p-4 text-aic-paper font-serif text-sm focus:border-blue-500 outline-none transition-colors"
                                    rows={3}
                                    placeholder="Provide feedback or reasons for rejection..."
                                    value={findings[req.id] || ''}
                                    onChange={(e) => setFindings({ ...findings, [req.id]: e.target.value })}
                                />
                            </div>

                            <div className="flex gap-4 border-t border-aic-paper/5 pt-8">
                                <button 
                                    onClick={() => handleAction(req.id, 'VERIFIED')}
                                    className="flex-1 bg-green-600 text-aic-paper py-3 rounded-xl font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-green-500 transition-colors shadow-lg shadow-green-900/20"
                                >
                                    Verify Evidence
                                </button>
                                <button 
                                    onClick={() => handleAction(req.id, 'REJECTED')}
                                    className="flex-1 bg-red-600 text-aic-paper py-3 rounded-xl font-mono text-[10px] font-bold uppercase tracking-widest hover:bg-red-500 transition-colors shadow-lg shadow-red-900/20"
                                >
                                    Reject Submission
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </AdminShell>
    );
}
