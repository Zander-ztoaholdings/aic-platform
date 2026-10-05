'use client';
import { Eyebrow } from '@/app/components/ui/Eyebrow';

import React, { useEffect, useState } from 'react';
import DashboardShell from '../components/DashboardShell';
import { motion } from 'framer-motion';
import { Trophy, TrendingUp, UserCheck, ShieldCheck } from 'lucide-react';

export default function GlobalLeaderboard() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch('/api/leaderboard')
      .then(res => res.json())
      .then(d => {
        setData(d);
      })
      .catch(() => {});
  }, []);

  const stats = [
    { label: 'Average integrity score', value: data?.globalMetrics?.avgIntegrity != null ? `${data.globalMetrics.avgIntegrity}%` : '—', icon: TrendingUp },
    { label: 'Human override rate', value: data?.globalMetrics?.humanInterventionRate != null ? `${data.globalMetrics.humanInterventionRate}%` : '—', icon: UserCheck },
    { label: 'Formal ledger entries', value: data?.globalMetrics?.formalLedgerEntries ?? '—', icon: ShieldCheck },
  ];

  return (
    <DashboardShell>
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-8 ">
          <div>
            <Eyebrow>Register</Eyebrow>
            <h1 className="font-serif text-[30px] md:text-[34px] leading-tight font-semibold text-[#0e1b2c]">
              Governance leaderboard
            </h1>
            <p className="mt-2 text-[15px] leading-relaxed text-[#5e6b7b] max-w-2xl">
              Organisations that agreed to appear on the public index. Register-wide figures stay hidden until at least five have agreed, so no single score can be worked out.
            </p>
          </div>
        </header>

        {/* Global KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {stats.map((s, i) => (
            <motion.div 
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white p-5 rounded-xl border border-[#dde2e8]"
            >
              <s.icon className="w-4 h-4 text-[#8a6a1f] mb-3" />
              <p className="text-[13px] text-[#5e6b7b]">{s.label}</p>
              <p className="mt-1 font-serif text-[28px] font-semibold text-[#0e1b2c]">{s.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Rankings Table */}
        <section className="bg-white border border-[#dde2e8] text-[#0e1b2c] p-5 md:p-7 rounded-xl">
          <div className="flex items-center gap-3 mb-5">
            <Trophy className="w-4 h-4 text-[#8a6a1f]" />
            <h2 className="text-base font-semibold">Organisations on the index</h2>
          </div>

          <div className="space-y-4 relative z-10">
            {(data?.leaderboard?.length ? [] : [0]).map((k: number) => (
              <p key={k} className="text-sm text-[#5e6b7b]">No organisation has agreed to appear on the index yet.</p>
            ))}
            {(data?.leaderboard || []).map((org: any, i: number) => (
              <motion.div 
                key={org.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + (i * 0.05) }}
                className="flex items-center justify-between p-4 sm:p-6 bg-[#f5f7f9] border border-[#dde2e8] rounded-2xl hover:border-aic-gold/30 transition-all group"
              >
                <div className="flex items-center gap-6">
                  <span className="font-mono text-xs font-bold text-gray-500 w-4">{i + 1}</span>
                  <div>
                    <span className="font-serif text-xl block group-hover:text-[#8a6a1f] transition-colors">{org.name}</span>
                    <span className="text-[12px] text-gray-500 first-cap">{org.tier ? `${org.tier} certified` : 'Not yet certified'}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-serif font-bold text-[#8a6a1f]">{org.integrityScore ?? '—'}</span>
                  <span className="text-[12px] text-gray-500 block first-cap">Integrity Score</span>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
