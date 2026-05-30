'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ReactNode } from 'react'
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  ShieldCheck, 
  Globe, 
  Server, 
  Activity,
  Layout,
  GraduationCap,
  Key
} from 'lucide-react'

import { toast } from 'sonner'

interface AdminShellProps {
  children: ReactNode
}

export default function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname()

  const handleExecuteAudit = async () => {
    const promise = fetch('/api/audits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        org_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', // Default Alpha Org
        scheduled_at: new Date().toISOString(),
        notes: 'Manually triggered audit from Admin Command Center.'
      })
    });

    toast.promise(promise, {
      loading: 'Initializing institutional audit sequence...',
      success: 'Audit session synchronized and logged.',
      error: 'Audit initialization failed. Check engine connectivity.'
    });
  };

  const navItems = [
    { href: '/', label: 'Dashboard', section: 'Command', icon: <LayoutDashboard className="w-4 h-4" /> },
    { href: '/workspace', label: 'Workspace', section: 'Governance', icon: <Layout className="w-4 h-4" /> },
    { href: '/leads', label: 'Leads', section: 'Command', icon: <Users className="w-4 h-4" /> },
    { href: '/applications', label: 'Applications', section: 'Command', icon: <FileText className="w-4 h-4" /> },
    { href: '/certifications', label: 'Certifications', section: 'Registry', icon: <ShieldCheck className="w-4 h-4" /> },
    { href: '/audits', label: 'Audits', section: 'Registry', icon: <Activity className="w-4 h-4" /> },
    { href: '/organizations', label: 'Organizations', section: 'Registry', icon: <Globe className="w-4 h-4" /> },
    { href: '/practitioner', label: 'Practitioner', section: 'Governance', icon: <GraduationCap className="w-4 h-4" /> },
    { href: '/leaderboard', label: 'Leaderboard', section: 'Governance', icon: <Globe className="w-4 h-4" /> },
    { href: '/verification', label: 'Verification', section: 'Registry', icon: <Key className="w-4 h-4" /> },
  ]

  return (
    <div className="min-h-screen bg-aic-navy text-aic-paper flex font-sans">
      {/* Sidebar */}
      <aside className="w-72 bg-aic-navy border-r border-aic-paper/5 p-6 flex flex-col fixed h-full z-20">
        <div className="flex justify-between items-center mb-10 px-2">
          <Link href="/" className="flex items-center gap-3 group">
              <div className="h-8 w-8 rounded bg-red-900/20 border border-red-500/30 flex items-center justify-center text-red-500 font-mono font-bold text-lg group-hover:bg-red-900/30 group-hover:shadow-[0_0_15px_rgba(239,68,68,0.3)] transition-all">A</div>
              <div>
                  <h1 className="font-sans text-lg font-bold tracking-tight text-aic-paper leading-none">AIC ADMIN</h1>
                  <p className="text-[9px] font-mono text-red-500 uppercase tracking-widest mt-1">Sovereign Control</p>
              </div>
          </Link>
        </div>

        <nav className="flex-1 space-y-8 overflow-y-auto pr-2 custom-scrollbar">
          {['Command', 'Governance', 'Registry'].map((section) => (
            <div key={section}>
              <div className="text-[9px] font-mono text-gray-600 uppercase tracking-widest mb-3 px-3">{section}</div>
              <div className="space-y-1">
                {navItems.filter(i => i.section === section).map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 py-2.5 px-3 rounded-lg font-sans text-xs font-medium transition-all group relative overflow-hidden ${
                      pathname === item.href
                        ? 'text-aic-paper bg-aic-paper/5 border border-aic-paper/5'
                        : 'text-gray-400 hover:text-aic-paper hover:bg-aic-paper/5'
                    }`}
                  >
                    {pathname === item.href && (
                      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-red-500 shadow-[0_0_10px_#EF4444]" />
                    )}
                    <span className={pathname === item.href ? 'text-red-500' : 'text-gray-600 group-hover:text-gray-400'}>
                      {item.icon}
                    </span>
                    <span className="">{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-auto pt-6 border-t border-aic-paper/5">
          <div className="p-3 rounded-lg bg-aic-navy-mid border border-aic-paper/5 flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_#EF4444]"></div>
            <div className="flex-1">
              <p className="text-[9px] text-gray-400 font-mono uppercase tracking-widest">System Status</p>
              <span className="text-[10px] font-bold text-aic-paper uppercase tracking-wide">Privileged Access</span>
            </div>
            <Server className="w-3 h-3 text-gray-600" />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-72 min-h-screen bg-aic-navy">
        <header className="sticky top-0 z-10 bg-aic-navy/80 backdrop-blur-xl border-b border-aic-paper/5 px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-6">
                <div className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
                <div>
                    <p className="text-[8px] text-gray-600 uppercase tracking-[0.4em] mb-1">Authenticated Command</p>
                    <h2 className="text-xs font-bold text-aic-paper tracking-[0.2em]">{navItems.find(i => i.href === pathname)?.label.toUpperCase() || 'CONSOLE'}</h2>
                </div>
            </div>
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1 bg-green-500/5 border border-green-500/20 rounded-full">
                    <span className="w-1 h-1 rounded-full bg-green-500 animate-pulse"></span>
                    <span className="text-[8px] text-green-500 font-bold">ENGINE_SYNC_ACTIVE</span>
                </div>
              </div>
              <button 
                onClick={handleExecuteAudit}
                className="bg-red-600 text-aic-paper px-6 py-2 rounded-md text-[9px] font-bold hover:bg-red-500 transition-all shadow-lg shadow-red-900/20 active:scale-95 uppercase tracking-widest"
              >
                Execute New Audit
              </button>
            </div>
          </div>
        </header>

        <div className="p-8 text-aic-paper">
          {children}
        </div>
      </main>
    </div>
  )
}
