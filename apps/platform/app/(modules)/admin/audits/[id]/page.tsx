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
                        <h1 className="text-3xl font-serif font-bold text-[#0e1b2c] tracking-tight">Requirement Verification</h1>
                        <p className="text-gray-500 font-serif mt-2 italic">Detailed evidence review for Organization ID: {orgId.substring(0, 8)}</p>
                    </div>
                </div>

                <div className="space-y-6">
                    {loading ? (
                        <div className="p-6 md:p-12 text-center text-gray-500 italic">Syncing with secure vault...</div>
                    ) : requirements.map((req, i) => (
                        <motion.div 
                            key={req.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="bg-white border border-[#dde2e8] p-5 md:p-8 rounded-3xl group"
                        >
                            <div className="flex justify-between items-start mb-8">
                                <div>
                                    <span className="text-[12px] font-bold text-blue-700 first-cap">{req.category}</span>
                                    <h3 className="text-2xl font-serif text-[#0e1b2c] mt-2">{req.title}</h3>
                                    <p className="text-gray-500 font-serif text-sm mt-2">{req.description}</p>
                                </div>
                                <div className={`px-3 py-1 rounded text-[12px] font-bold first-cap ${
                                    req.status === 'VERIFIED' ? 'bg-green-50 text-green-700 border border-green-200' :
                                    req.status === 'REJECTED' ? 'bg-red-50 text-red-700 border border-red-200' :
                                    'bg-blue-50 text-blue-700 border border-blue-200'
                                }`}>
                                    {req.status}
                                </div>
                            </div>

                            <div className="bg-white border border-[#dde2e8] p-4 sm:p-6 rounded-xl mb-8">
                                <p className="text-[12px] font-bold text-gray-500 first-cap mb-4">Evidence URL</p>
                                {req.evidence_url ? (
                                    <a href={req.evidence_url} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:text-blue-700 font-mono text-xs break-all underline decoration-blue-500/30 underline-offset-4">
                                        {req.evidence_url}
                                    </a>
                                ) : (
                                    <p className="text-gray-600 font-serif italic text-sm">No evidence submitted yet.</p>
                                )}
                            </div>

                            <div className="mb-8">
                                <p className="text-[12px] font-bold text-gray-500 first-cap mb-4">Auditor Findings / Remediation Advice</p>
                                <textarea 
                                    className="w-full bg-white border border-[#dde2e8] rounded-xl p-4 text-[#0e1b2c] font-serif text-sm focus:border-blue-200 outline-none transition-colors"
                                    rows={3}
                                    placeholder="Provide feedback or reasons for rejection..."
                                    value={findings[req.id] || ''}
                                    onChange={(e) => setFindings({ ...findings, [req.id]: e.target.value })}
                                />
                            </div>

                            <div className="flex gap-4 border-t border-[#dde2e8] pt-8">
                                <button 
                                    onClick={() => handleAction(req.id, 'VERIFIED')}
                                    className="flex-1 bg-green-600 text-aic-paper py-3 rounded-xl text-[12px] font-bold first-cap hover:bg-green-500 transition-colors shadow-lg shadow-green-900/20"
                                >
                                    Verify Evidence
                                </button>
                                <button 
                                    onClick={() => handleAction(req.id, 'REJECTED')}
                                    className="flex-1 bg-red-600 text-aic-paper py-3 rounded-xl text-[12px] font-bold first-cap hover:bg-red-500 transition-colors shadow-lg shadow-red-900/20"
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
