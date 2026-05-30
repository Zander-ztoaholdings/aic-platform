import DashboardShell from '../components/DashboardShell';
import AuditorFindings from '../(modules)/internal/components/AuditorFindings';

export const metadata = { title: 'Auditor Findings | AIC Pulse' };

export default function FindingsPage() {
  return (
    <DashboardShell>
      <AuditorFindings />
    </DashboardShell>
  );
}
