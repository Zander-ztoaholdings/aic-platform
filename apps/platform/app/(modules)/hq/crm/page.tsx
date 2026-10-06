'use client';
import { Eyebrow } from '@/app/components/ui/Eyebrow';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export default function EnterpriseCRMPage() {
    const [leads, setLeads] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchLeads = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/leads');
            const data = await res.json();
            setLeads(data.leads || []);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLeads();
    }, []);

    const handleStatusUpdate = async (id: string, status: string) => {
        try {
            const res = await fetch(`/api/leads/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });
            if (res.ok) {
                toast.success('Institutional lead status updated.');
                fetchLeads();
            } else {
                toast.error('Failed to update lead status.');
            }
        } catch {
            toast.error('Network error during CRM update.');
        }
    };

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'ALPHA_ENROLLED': return 'bg-green-50 text-green-700 border-green-200';
            case 'HIGH_INTENT': return 'bg-aic-gold/10 text-[#8a6a1f] border-aic-gold/20';
            default: return 'bg-[#f5f7f9] text-gray-500 border-[#dde2e8]';
        }
    };

    return (
        <div className="space-y-12">
            <div className="flex flex-col sm:flex-row sm:justify-between gap-5 sm:items-end">
                <div>
                    <Eyebrow>HQ growth</Eyebrow>
                    <h1 className="font-serif text-[30px] md:text-[34px] leading-tight font-semibold text-[#0e1b2c]">CRM</h1>
                    <p className="mt-2 text-[15px] leading-relaxed text-[#5e6b7b] max-w-2xl">
                        Every lead, where it came from, and where it stands.
                    </p>
                </div>
                <div className="flex gap-4">
                    <div className="bg-white border border-[#dde2e8] px-4 sm:px-6 py-3 rounded-2xl text-right">
                        <p className="text-[12px] text-gray-600 first-cap mb-1">Pipeline</p>
                        <p className="text-xl font-serif font-bold">—</p>
                    </div>
                </div>
            </div>

            <div className="bg-white border border-[#dde2e8] rounded-xl overflow-hidden">
                <div className="overflow-x-auto"><table className="min-w-[640px] w-full text-left">
                    <thead className="bg-[#f5f7f9] border-b border-[#dde2e8] text-[12px] font-bold text-gray-500 first-cap">
                        <tr>
                            <th className="p-5 md:p-8">Organisation</th>
                            <th className="p-5 md:p-8">Source</th>
                            <th className="p-5 md:p-8">Score</th>
                            <th className="p-5 md:p-8">Status</th>
                            <th className="p-5 md:p-8 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e6e9ee] font-serif">
                        {loading ? (
                            <tr><td colSpan={5} className="p-10 text-center text-sm text-[#5e6b7b]">Loading…</td></tr>
                        ) : (
                            leads.map((lead, i) => (
                                <motion.tr 
                                    key={lead.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                    className="hover:bg-[#eef1f5] transition-colors group"
                                >
                                    <td className="p-5 md:p-8">
                                        <p className="text-lg font-bold text-[#0e1b2c] tracking-tight">{lead.company || lead.email.split('@')[1]}</p>
                                        <p className="text-[12px] text-gray-500 first-cap mt-1">{lead.email}</p>
                                    </td>
                                    <td className="p-5 md:p-8">
                                        <span className="text-[11.5px] text-gray-500">{lead.source}</span>
                                    </td>
                                    <td className="p-5 md:p-8 text-[#8a6a1f] font-bold text-lg">
                                        {lead.score || 0}%
                                    </td>
                                    <td className="p-5 md:p-8">
                                        <select 
                                            value={lead.status}
                                            onChange={(e) => handleStatusUpdate(lead.id, e.target.value)}
                                            className={`bg-transparent border border-[#dde2e8] rounded-full px-3 py-1 text-[12px] font-bold first-cap outline-none focus:border-aic-gold transition-colors ${getStatusStyle(lead.status)}`}
                                        >
                                            <option value="PROSPECT">PROSPECT</option>
                                            <option value="HIGH_INTENT">High intent</option>
                                            <option value="ALPHA_ENROLLED">Alpha enrolled</option>
                                            <option value="CERTIFIED">CERTIFIED</option>
                                            <option value="LOST">LOST</option>
                                        </select>
                                    </td>
                                    <td className="p-5 md:p-8 text-right">
                                        <button className="text-[12px] font-bold text-gray-500 group-hover:text-[#0e1b2c] transition-colors first-cap">
                                            Manage lead
                                        </button>
                                    </td>
                                </motion.tr>
                            ))
                        )}
                    </tbody>
                </table></div>
            </div>
        </div>
    );
}