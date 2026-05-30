'use client';

import Link from 'next/link';
import { signOut } from 'next-auth/react';
import {
  LayoutDashboard, ShieldCheck, Activity, AlertTriangle,
  FileCheck, MessageSquare, Award, GraduationCap, Key, Building2, LogOut,
} from 'lucide-react';

const NAV_GROUPS = [
  {
    section: 'My Certification',
    items: [
      { label: 'Dashboard',           href: '/',               icon: LayoutDashboard },
      { label: 'Evidence Vault',      href: '/evidence',       icon: ShieldCheck },
      { label: 'Pulse Monitor',       href: '/pulse',          icon: Activity },
    ],
  },
  {
    section: 'Review & Findings',
    items: [
      { label: 'Auditor Findings',    href: '/findings',       icon: AlertTriangle, badge: 3 },
      { label: 'Compliance Reports',  href: '/reports',        icon: FileCheck },
      { label: 'Correspondence',      href: '/correspondence', icon: MessageSquare, dot: true },
    ],
  },
  {
    section: 'Certification',
    items: [
      { label: 'My Certificate',      href: '/certificate',    icon: Award },
      { label: 'Practitioner (CAAP)', href: '/practitioner',   icon: GraduationCap },
    ],
  },
  {
    section: 'Account',
    items: [
      { label: 'API & Access Keys',    href: '/settings/keys',  icon: Key },
      { label: 'Organisation Profile', href: '/organisation',   icon: Building2 },
    ],
  },
];

function BrandMark() {
  return (
    <svg viewBox="0 0 110 180" className="h-10 w-auto flex-shrink-0">
      <path d="M36,1 L1,1 L1,179 L36,179" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="square"/>
      <path d="M74,1 L109,1 L109,179 L74,179" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="square"/>
      <text x="55" y="20" fontSize="7" fill="#fff" textAnchor="middle" letterSpacing="2.5" fontFamily="Space Grotesk,sans-serif" fontWeight="700">METHODOLOGY</text>
      <text x="55" y="31" fontSize="7" fill="#fff" textAnchor="middle" letterSpacing="2.5" fontFamily="Space Grotesk,sans-serif" fontWeight="700">ASSESSED</text>
      <line x1="8" y1="41" x2="102" y2="41" stroke="#fff" strokeWidth="1" opacity="0.3"/>
      <text x="55" y="100" fontSize="40" fontWeight="700" fill="#fff" textAnchor="middle" letterSpacing="5" fontFamily="Space Grotesk,sans-serif">AIC</text>
      <line x1="8" y1="122" x2="102" y2="122" stroke="#fff" strokeWidth="1" opacity="0.3"/>
      <text x="55" y="148" fontSize="5" fill="#c9920a" textAnchor="middle" letterSpacing="1.5" fontFamily="Space Grotesk,sans-serif" fontWeight="700">AICCERTIFIED.CLOUD</text>
    </svg>
  );
}

export function DashboardSidebar({
  show,
  onClose,
  isActive,
}: {
  show: boolean;
  onClose: () => void;
  isActive: (href: string) => boolean;
}) {
  return (
    <aside
      className={`w-64 bg-[#0f1f3d] border-r border-white/[0.06] flex flex-col fixed h-full z-40 transition-transform duration-300 md:translate-x-0 overflow-y-auto ${
        show ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      {/* Logo */}
      <div className="px-4 pt-5 pb-4 border-b border-white/[0.06] flex items-center gap-3">
        <Link href="/" onClick={onClose} className="flex items-center gap-3 min-w-0">
          <BrandMark />
          <div className="min-w-0">
            <div className="font-mono text-[8px] font-bold tracking-[0.2em] uppercase text-white/35">Client Portal</div>
            <div className="text-xs font-semibold text-white/85 mt-0.5 truncate">Meridian Financial</div>
          </div>
        </Link>
        <button
          onClick={onClose}
          className="md:hidden ml-auto text-white/40 hover:text-white p-1 flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Nav */}
      <div className="flex-1 px-2.5 py-4 space-y-5">
        {NAV_GROUPS.map((group) => (
          <div key={group.section}>
            <div className="font-mono text-[8px] font-bold uppercase tracking-[0.3em] text-white/[0.22] px-2 mb-1">
              {group.section}
            </div>
            <nav className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={`flex items-center gap-2.5 py-2 px-2.5 rounded-lg text-xs font-medium transition-all border-l-2 ${
                      active
                        ? 'bg-white/[0.09] text-white border-[#c9920a]'
                        : 'text-white/[0.38] hover:bg-white/[0.05] hover:text-white/70 border-transparent'
                    }`}
                  >
                    <Icon
                      className={`w-3.5 h-3.5 flex-shrink-0 ${active ? 'text-[#c9920a]' : 'text-current'}`}
                    />
                    <span className="flex-1">{item.label}</span>
                    {'badge' in item && item.badge != null && (
                      <span className="ml-auto bg-[#c9920a] text-[#0a1628] font-mono text-[8px] font-bold px-1.5 py-0.5 rounded-full">
                        {item.badge}
                      </span>
                    )}
                    {'dot' in item && item.dot && !('badge' in item && (item as { badge?: number }).badge != null) && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#c9920a] flex-shrink-0" />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      {/* Bottom status */}
      <div className="px-3 pb-4 pt-3 border-t border-white/[0.06] space-y-2">
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 flex items-center gap-2.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] shadow-[0_0_6px_#22c55e] animate-pulse flex-shrink-0" />
          <div>
            <div className="font-mono text-[7px] uppercase tracking-[0.15em] text-white/30">Pulse</div>
            <div className="font-mono text-[9px] font-bold text-white">Live — Secure</div>
          </div>
        </div>
        <button 
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-white/30 text-xs transition-colors hover:text-red-400"
        >
          <LogOut className="w-3.5 h-3.5" /> Sign Out
        </button>
      </div>
    </aside>
  );
}
