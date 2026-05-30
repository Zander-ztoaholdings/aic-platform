'use client';

import { useEffect, useState } from 'react';
import {
  MessageSquare,
  ShieldCheck,
  Globe,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { IntegrityScore } from './components/IntegrityScore';
import { RightsRibbon } from './components/RightsRibbon';
import { PulseMonitor } from './components/PulseMonitor';
import { JourneyTracker } from './components/JourneyTracker';
import { EvidenceByRight } from './components/EvidenceByRight';
import { ActionItems } from './components/ActionItems';
import { AccountablePerson } from './components/AccountablePerson';

// Mock data based on the redesign spec
const MOCK_DATA = {
  org: {
    name: 'Meridian Financial Group',
    division: 'Division 2',
    divisionName: 'Supervised',
  },
  score: {
    overall: 77,
    trend: '+2 from last month',
    bottleneck: 'Right 3 (Empathy) is the bottleneck. Dignity score is below the certification threshold.',
    methodology: [
      { label: 'Evidence Completeness', weight: 40, score: 72 },
      { label: 'Override Rate Health', weight: 20, score: 55 },
      { label: 'Dignity Score', weight: 20, score: 54 },
      { label: 'Findings Severity', weight: 10, score: 90 },
      { label: 'Appeal SLA Adherence', weight: 10, score: 100 },
    ],
  },
  rights: [
    { id: 1, name: 'Human Agency', score: 71, trend: '↑', trendDir: 'up', metric: '47 overrides in Q1 · 0 in Q2', status: 'attention' },
    { id: 2, name: 'Explanation', score: 88, trend: '→', trendDir: 'flat', metric: 'Decision notices reviewed · Plain language confirmed', status: 'healthy' },
    { id: 3, name: 'Empathy', score: 54, trend: '↓', trendDir: 'down', metric: 'Dignity score 54/100 — below threshold', status: 'action' },
    { id: 4, name: 'Correction', score: 79, trend: '↑', trendDir: 'up', metric: 'Avg 7.4 BD resolution · 3 open', status: 'attention' },
    { id: 5, name: 'Truth', score: 95, trend: '→', trendDir: 'flat', metric: 'All disclosures verified · Full compliance', status: 'healthy' },
  ],
  pulse: {
    decisionsToday: 1243,
    overrideRate: 0.0,
    overrideHealthMin: 1.0,
    overrideHealthMax: 8.0,
    openFindings: 3,
    findingsMaxSev: 'critical',
    daysToMilestone: 14,
    milestoneLabel: 'Evidence deadline',
    sparkline: [980, 1102, 1340, 1189, 1420, 1380, 1243],
  },
  stages: [
    { id: 1, label: 'Intake', status: 'past', date: 'Mar 28' },
    { id: 2, label: 'Onboarding', status: 'past', date: 'Apr 01' },
    { id: 3, label: 'Evidence Submission', status: 'active', progress: 42, nextAction: 'Upload outstanding Right 3 (Empathy) evidence', cta: 'Vault', daysIn: 14 },
    { id: 4, label: 'Auditor Review', status: 'future' },
    { id: 5, label: 'Final Certification', status: 'future' },
  ],
  actions: [
    { id: 1, urgency: 'high', title: 'Submit Right 3 (Empathy) evidence', why: 'Dignity score 54/100 blocks certification. Threshold is 60.', deadline: '2 May 2026', cta: 'Evidence Vault' },
    { id: 2, urgency: 'high', title: 'Explain zero override rate (April)', why: '15,421 decisions with no human override logged. Auditor requires explanation.', deadline: '2 May 2026', cta: 'Correspondence' },
    { id: 3, urgency: 'medium', title: 'Complete Appeal Mechanism documentation', why: 'Tier 1 escalation path is missing — significant finding.', deadline: '2 May 2026', cta: 'Evidence Vault' },
  ],
};

export default function ClientDashboard() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-aic-paper flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-aic-gold border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-aic-paper">
      <div className="max-w-[1400px] mx-auto px-6 py-10 space-y-6">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-[10px] font-bold text-aic-gold uppercase tracking-[0.2em]">Meridian Financial Group</span>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            </div>
            <h1 className="font-serif text-4xl font-bold text-aic-navy tracking-tight">
              AIC Pulse Dashboard
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="px-4 py-2 bg-white border border-gray-100 rounded-full flex items-center gap-2 shadow-sm">
              <Globe className="w-3.5 h-3.5 text-gray-400" />
              <span className="font-mono text-[10px] font-bold text-gray-500 uppercase tracking-widest">{MOCK_DATA.org.division} — {MOCK_DATA.org.divisionName}</span>
            </div>
            <div className="px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-full flex items-center gap-2 shadow-sm">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span className="font-mono text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Integrity: Secure</span>
            </div>
          </div>
        </header>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <IntegrityScore 
            overall={MOCK_DATA.score.overall}
            trend={MOCK_DATA.score.trend}
            bottleneck={MOCK_DATA.score.bottleneck}
            methodology={MOCK_DATA.score.methodology}
          />
          
          <div className="hidden lg:block">
            <JourneyTracker stages={MOCK_DATA.stages as any} />
          </div>

          <RightsRibbon rights={MOCK_DATA.rights as any} />
          
          <div className="hidden lg:block">
            <AccountablePerson 
              name="Dr. Sarah Chen"
              role="Chief Risk Officer"
              initials="SC"
              caapStatus="pending"
            />
          </div>

          <PulseMonitor {...MOCK_DATA.pulse as any} />
          
          <ActionItems 
            items={MOCK_DATA.actions as any} 
            onAction={(id, cta) => console.log('Action:', id, cta)} 
          />

          <EvidenceByRight 
            rights={MOCK_DATA.rights as any} 
            onViewAll={() => console.log('View all')} 
          />

          <div className="lg:col-span-1">
             <Card className="p-6 bg-gray-50 border-gray-100 border-dashed flex flex-col items-center justify-center text-center h-full min-h-[200px]">
                <MessageSquare className="w-8 h-8 text-gray-300 mb-4" />
                <h3 className="text-sm font-bold text-aic-navy mb-2">Auditor Correspondence</h3>
                <p className="text-xs text-gray-400 max-w-[200px] mb-6 leading-relaxed">Direct line to your assigned AIC System Auditor.</p>
                <Button variant="outline" className="font-mono text-[10px] uppercase tracking-widest h-9 px-6 rounded-full bg-white">
                  Open Chat
                </Button>
             </Card>
          </div>
        </div>

        {/* Footer Info */}
        <footer className="pt-8 border-t border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="font-mono text-[9px] text-gray-400 uppercase tracking-[0.2em]">
            AIC Platform v2.4.0 — All sessions are cryptographically logged.
          </div>
          <div className="flex items-center gap-6">
            <button className="font-mono text-[9px] font-bold text-gray-400 uppercase tracking-widest hover:text-aic-gold transition-colors">Documentation</button>
            <button className="font-mono text-[9px] font-bold text-gray-400 uppercase tracking-widest hover:text-aic-gold transition-colors">Support</button>
            <button className="font-mono text-[9px] font-bold text-gray-400 uppercase tracking-widest hover:text-aic-gold transition-colors">Legal</button>
          </div>
        </footer>
      </div>
    </div>
  );
}
