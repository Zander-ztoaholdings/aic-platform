'use client';

import { useEffect, useState } from 'react';
import DashboardShell from '../../components/DashboardShell';

export default function InsuranceRiskPage() {
    const [riskData, setRiskData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Using demo org ID
        fetch('/api/insurance/risk-score?org_id=a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
            .then(res => res.json())
            .then(data => {
                setRiskData(data);
                setLoading(false);
            });
    }, []);

    if (loading) return <DashboardShell><div className="p-12 text-center text-gray-500 italic">Calculating actuarial risk profile...</div></DashboardShell>;

    return (
        <DashboardShell>
            <div className="max-w-4xl mx-auto pb-24">
                <div className="mb-12">
                    <h1 className="text-3xl font-serif font-bold text-aic-black underline decoration-aic-gold underline-offset-8">Insurance Risk Assessment</h1>
                    <p className="text-gray-500 font-serif mt-4 italic">Automated mapping of AIC Integrity to liability insurance risk ratings.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                    <div className="bg-aic-paper border border-aic-black/5 p-12 rounded-[2.5rem] shadow-sm flex flex-col items-center justify-center text-center">
                        <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest mb-4">Current Integrity Score</span>
                        <div className="text-7xl font-serif font-bold text-aic-black mb-2">{riskData.assessment.integrity_score}</div>
                        <span className="text-xs font-mono text-aic-gold font-bold">VERIFIED BY AIC PULSE</span>
                    </div>

                    <div className="bg-aic-black text-aic-paper p-12 rounded-[2.5rem] shadow-xl flex flex-col items-center justify-center text-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-10 font-serif italic text-4xl italic">Actuarial</div>
                        <span className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-widest mb-4">Projected Risk Rating</span>
                        <div className="text-7xl font-serif font-bold text-aic-gold mb-2">{riskData.assessment.insurance_risk_rating}</div>
                        <span className={`text-[10px] font-mono font-bold px-3 py-1 rounded-full border ${
                            riskData.assessment.recommendation === 'APPROVED_FOR_DISCOUNT' ? 'border-green-500 text-green-500' : 'border-aic-red text-aic-red'
                        }`}>
                            {riskData.assessment.recommendation.replace(/_/g, ' ')}
                        </span>
                    </div>
                </div>

                <div className="bg-aic-paper border border-aic-black/5 p-12 rounded-[3rem]">
                    <h3 className="font-serif text-xl mb-8 italic">Premium Impact Projection</h3>
                    <div className="space-y-6">
                        {[
                            { label: 'Standard Premium', value: 'R 250,000 / yr', status: 'BASELINE' },
                            { label: 'AIC Integrity Discount', value: riskData.assessment.integrity_score > 80 ? '- R 45,000' : '- R 0', status: riskData.assessment.integrity_score > 80 ? 'QUALIFIED' : 'PENDING' },
                            { label: 'Projected Net Premium', value: riskData.assessment.integrity_score > 80 ? 'R 205,000' : 'R 250,000', status: 'ESTIMATE', highlight: true }
                        ].map((item, i) => (
                            <div key={i} className={`flex justify-between items-center p-6 rounded-2xl border ${item.highlight ? 'bg-aic-paper border-aic-gold shadow-md' : 'border-aic-black/5'}`}>
                                <div>
                                    <p className="text-xs font-mono font-bold text-gray-400 uppercase tracking-widest mb-1">{item.label}</p>
                                    <p className={`font-serif text-lg ${item.highlight ? 'font-bold' : ''}`}>{item.value}</p>
                                </div>
                                <span className={`text-[9px] font-mono font-bold px-2 py-1 rounded border ${
                                    item.status === 'QUALIFIED' ? 'bg-green-50 text-green-600 border-green-100' : 
                                    item.status === 'BASELINE' ? 'bg-gray-100 text-gray-500 border-gray-200' :
                                    'bg-aic-gold/10 text-aic-gold border-aic-gold/20'
                                }`}>
                                    {item.status}
                                </span>
                            </div>
                        ))}
                    </div>

                    <div className="mt-12 p-8 border border-dashed border-aic-black/10 rounded-2xl">
                        <p className="text-sm font-serif text-gray-500 italic leading-relaxed">
                            *This assessment is a projection based on the current AIC Integrity Score. Actual premium discounts are subject to final underwriting by AIC Insurance Partners (Old Mutual, Santam, or Discovery).
                        </p>
                    </div>
                </div>
            </div>
        </DashboardShell>
    );
}
