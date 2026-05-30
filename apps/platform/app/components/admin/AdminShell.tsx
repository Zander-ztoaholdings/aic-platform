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
  Key,
  ShieldAlert,
  Search,
  Bell
} from 'lucide-react'

import { cn } from "@/lib/utils";

interface AdminShellProps {
  children: ReactNode
}

export default function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname()

  const navItems = [
    { href: '/admin', label: 'Dashboard', section: 'Command', icon: <LayoutDashboard className="w-4 h-4" /> },
    { href: '/admin/workspace', label: 'Workspace', section: 'Governance', icon: <Layout className="w-4 h-4" /> },
    { href: '/admin/users', label: 'User Registry', section: 'Identity', icon: <Users className="w-4 h-4" /> },
    { href: '/admin/permissions', label: 'RBAC God Mode', section: 'Identity', icon: <ShieldAlert className="w-4 h-4" /> },
    { href: '/admin/queue', label: 'Audit Queue', section: 'Factory', icon: <Activity className="w-4 h-4" /> },
    { href: '/admin/organizations', label: 'Organizations', section: 'Registry', icon: <Globe className="w-4 h-4" /> },
    { href: '/admin/certifications', label: 'Certifications', section: 'Registry', icon: <ShieldCheck className="w-4 h-4" /> },
    { href: '/admin/applications', label: 'Applications', section: 'Factory', icon: <FileText className="w-4 h-4" /> },
    { href: '/admin/practitioner', label: 'ISO 17024', section: 'Governance', icon: <GraduationCap className="w-4 h-4" /> },
    { href: '/admin/verification', label: 'KYC/Verification', section: 'Identity', icon: <Key className="w-4 h-4" /> },
  ]

  return (
    <div className="flex h-screen bg-[#F9FAFB] text-[#0A1728] font-sans overflow-hidden">
      {/* Sidebar - Compact & Dense */}
      <aside className="w-64 bg-aic-paper border-r border-gray-200 flex flex-col shrink-0">
        <div className="p-6 border-b border-gray-100 flex items-center gap-3">
          <div className="w-8 h-8 bg-[#0A1728] rounded flex items-center justify-center text-aic-paper font-bold text-xs">A</div>
          <div>
            <h1 className="text-sm font-black tracking-tight leading-none">ADMIN CONTROL</h1>
            <p className="text-[10px] text-[#c36c32] font-bold uppercase mt-1">Sovereign Layer</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-6">
          {['Command', 'Factory', 'Registry', 'Identity', 'Governance'].map((section) => (
            <div key={section}>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-2">{section}</div>
              <div className="space-y-0.5">
                {navItems.filter(i => i.section === section).map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 py-2 px-3 rounded-lg text-xs font-medium transition-all",
                        isActive 
                          ? "bg-gray-100 text-[#0A1728] shadow-sm" 
                          : "text-gray-500 hover:bg-gray-50 hover:text-[#0A1728]"
                      )}
                    >
                      <span className={cn(isActive ? "text-[#c36c32]" : "text-gray-400")}>
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
            <div className="flex-1">
              <p className="text-[9px] text-gray-400 font-bold uppercase">System Integrity</p>
              <span className="text-[10px] font-bold text-gray-700">Audit Engine Linked</span>
            </div>
            <Server className="w-3 h-3 text-gray-400" />
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-aic-paper border-b border-gray-200 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4 flex-1 max-w-xl">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Global Search (Omni-bar)..." 
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-lg text-xs focus:ring-2 focus:ring-[#c36c32]/20 outline-none"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button className="p-2 text-gray-400 hover:bg-gray-50 rounded-lg relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-aic-paper"></span>
            </button>
            <div className="h-8 w-px bg-gray-200"></div>
            <div className="flex items-center gap-3 pl-2">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-gray-900 leading-none">Root Admin</p>
                <p className="text-[10px] text-gray-400 uppercase font-bold mt-1">Privileged Account</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-[#0A1728] flex items-center justify-center text-aic-paper text-xs font-bold shadow-lg shadow-gray-200">
                RA
              </div>
            </div>
          </div>
        </header>

        {/* Content Viewport */}
        <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {children}
        </main>
      </div>
    </div>
  )
}
