'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

type PipelineData = {
  unqualified: number;
  discovery:   number;
  alpha:        number;
  certified:    number;
};

export default function RevenueVelocityPage() {
  const [data, setData] = useState<PipelineData | null>(null);

  useEffect(() => {
    fetch('/api/leads?limit=100')
      .then(r => r.json())
      .then(d => {
        const leads: Array<{ status: string }> = d.leads ?? [];
        setData({
          unqualified: leads.filter(l => ['NEW', 'PROSPECT'].includes(l.status)).length,
          discovery:   leads.filter(l => ['HIGH_INTENT', 'ALPHA_APPLIED', 'RE-ENGAGED'].includes(l.status)).length,
          alpha:       leads.filter(l => l.status === 'CONVERTED').length,
          certified:   leads.filter(l => l.status === 'CERTIFIED').length,
        });
      })
      .catch(() => {});
  }, []);

  const segments = [
    { label: 'Unqualified Leads',       value: data?.unqualified ?? '—', color: 'bg-zinc-800' },
    { label: 'Discovery / High Intent', value: data?.discovery   ?? '—', color: 'bg-blue-900/40' },
    { label: 'Converted to Org',        value: data?.alpha       ?? '—', color: 'bg-aic-gold/40' },
    { label: 'Certified Institutional', value: data?.certified   ?? '—', color: 'bg-green-900/40' },
  ];

  const total = data ? data.unqualified + data.discovery + data.alpha + data.certified : null;

  return (
    <div className="space-y-16">
      <div className="flex justify-between items-end border-b border-aic-paper/5 pb-12">
        <div>
          <h1 className="text-5xl font-serif font-medium tracking-tight tracking-tighter mb-4">Pipeline Velocity</h1>
          <p className="text-gray-500 font-serif italic text-lg max-w-2xl">
            Tracking institutional pipeline flow and market expansion speed.
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-mono font-bold text-gray-600 uppercase tracking-[0.4em] mb-2">Total Pipeline</p>
          <div className="text-4xl font-serif text-aic-paper uppercase tracking-widest">
            {total !== null ? total : '—'} orgs
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {segments.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-[#080808] border border-aic-paper/5 p-10 rounded-[2.5rem] relative overflow-hidden group hover:border-aic-paper/10 transition-all"
          >
            <div className={`absolute top-0 right-0 w-1/3 h-full ${s.color} blur-[100px] opacity-20 pointer-events-none group-hover:opacity-40 transition-opacity`} />
            <div className="flex justify-between items-center relative z-10">
              <div>
                <p className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-widest mb-2">{s.label}</p>
              </div>
              <div className="text-right">
                <p className="text-[8px] font-mono text-gray-600 uppercase mb-1">Entity Count</p>
                <p className="text-2xl font-serif text-aic-gold">{s.value}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="bg-[#080808] border border-aic-paper/5 p-12 rounded-[3rem] flex flex-col justify-center">
        <h4 className="font-serif text-2xl text-aic-paper mb-4 italic">Pipeline Insight</h4>
        <p className="text-gray-500 font-serif text-sm leading-relaxed mb-8 italic">
          Real-time entity counts from the growth registry. Revenue projections require Stripe billing integration.
        </p>
        <button className="bg-aic-paper text-black px-10 py-4 font-mono text-[10px] font-bold uppercase tracking-[0.3em] hover:bg-aic-gold transition-all">
          EXPORT_GROWTH_MANIFEST
        </button>
      </div>
    </div>
  );
}
