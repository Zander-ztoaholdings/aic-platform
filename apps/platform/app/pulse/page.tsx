'use client';

import { Activity } from 'lucide-react';
import DashboardShell from '../components/DashboardShell';
import { Eyebrow, SectionCard } from '../components/ui/Eyebrow';

export default function PulsePage() {
  return (
    <DashboardShell>
      <div className="space-y-5">
        <Eyebrow>Live Pulse Telemetry</Eyebrow>
        <SectionCard>
          <div className="text-center py-16">
            <Activity className="w-10 h-10 text-gray-300 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-[#0f1f3d] mb-2">Pulse Telemetry — Coming Soon</h2>
            <p className="text-gray-500 text-sm max-w-sm mx-auto leading-relaxed">
              Real-time decision telemetry via the Pulse SDK is being prepared.
              Integration launches with the Empathy Engine in a future release.
            </p>
          </div>
        </SectionCard>
      </div>
    </DashboardShell>
  );
}
