import DashboardShell from '../components/DashboardShell';
import EvidenceVault from '../(modules)/internal/components/EvidenceVault';

export const metadata = { title: 'Evidence Vault | AIC Pulse' };

export default function EvidencePage() {
  return (
    <DashboardShell>
      <EvidenceVault />
    </DashboardShell>
  );
}
