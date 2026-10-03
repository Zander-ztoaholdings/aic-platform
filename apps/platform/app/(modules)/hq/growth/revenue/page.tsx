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
    { label: 'Unqualified Leads',       value: data?.unqualified ?? '—', color: 'bg-white' },
    { label: 'Discovery / High Intent', value: data?.discovery   ?? '—', color: 'bg-blue-50' },
    { label: 'Converted to Org',        value: data?.alpha       ?? '—', color: 'bg-aic-gold/40' },
    { label: 'Certified Institutional', value: data?.certified   ?? '—', color: 'bg-green-50' },
  ];

  const total = data ? data.unqualified + data.discovery + data.alpha + data.certified : null;

  return (
    <div className="space-y-16">
      <div className="flex flex-col sm:flex-row sm:justify-between gap-5 sm:items-end border-b border-[#dde2e8] pb-6 md:pb-12">
        <div>
          <h1 className="text-[2rem] leading-tight md:text-5xl font-serif font-medium tracking-tight tracking-tighter mb-4">Pipeline Velocity</h1>
          <p className="text-gray-500 font-serif italic text-lg max-w-2xl">
            Tracking institutional pipeline flow and market expansion speed.
          </p>
        </div>
        <div className="text-right">
          <p className="text-[12px] font-bold text-gray-600 first-cap mb-2">Total Pipeline</p>
          <div className="text-3xl md:text-4xl font-serif text-[#0e1b2c] first-cap">
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
            className="bg-white border border-[#dde2e8] p-6 md:p-10 rounded-[2.5rem] relative overflow-hidden group hover:border-[#dde2e8] transition-all"
          >
            <div className={`absolute top-0 right-0 w-1/3 h-full ${s.color} blur-[100px] opacity-20 pointer-events-none group-hover:opacity-40 transition-opacity`} />
            <div className="flex justify-between items-center relative z-10">
              <div>
                <p className="text-[12px] font-bold text-gray-500 first-cap mb-2">{s.label}</p>
              </div>
              <div className="text-right">
                <p className="text-[12px] text-gray-600 first-cap mb-1">Entity Count</p>
                <p className="text-2xl font-serif text-[#8a6a1f]">{s.value}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="bg-white border border-[#dde2e8] p-6 md:p-12 rounded-[3rem] flex flex-col justify-center">
        <h4 className="font-serif text-2xl text-[#0e1b2c] mb-4 italic">Pipeline Insight</h4>
        <p className="text-gray-500 font-serif text-sm leading-relaxed mb-8 italic">
          Real-time entity counts from the growth registry. Revenue projections require Stripe billing integration.
        </p>
        <button className="bg-[#0e1b2c] text-white px-5 md:px-10 py-4 text-[12px] font-bold first-cap hover:bg-[#22344a] transition-all">
          Export growth summary
        </button>
      </div>
    </div>
  );
}
