import DashboardShell from '../components/DashboardShell';
import Correspondence from '../(modules)/internal/components/Correspondence';

export const metadata = { title: 'Correspondence | AIC Pulse' };

export default function CorrespondencePage() {
  return (
    <DashboardShell>
      <Correspondence />
    </DashboardShell>
  );
}
