import ClientWorkspaceGate from '@/app/components/workspace/ClientWorkspaceGate';

export const dynamic = 'force-dynamic';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <ClientWorkspaceGate path="/incidents">{children}</ClientWorkspaceGate>;
}
