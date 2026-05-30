import DashboardShell from '../components/DashboardShell';
import OrganisationProfile from '../(modules)/internal/components/OrganisationProfile';

export const metadata = { title: 'Organisation Profile | AIC Pulse' };

export default function OrganisationPage() {
  return (
    <DashboardShell>
      <OrganisationProfile />
    </DashboardShell>
  );
}
