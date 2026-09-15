'use client';

import Link from 'next/link';
import { signOut } from 'next-auth/react';
import {
  LayoutDashboard, ShieldCheck, Activity, AlertTriangle,
  FileCheck, MessageSquare, Award, GraduationCap, Key, Building2, LogOut, Boxes, ExternalLink, Users, Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { canManageTeamAndKeys, type OrgRole } from '../../../lib/roles';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  restricted?: (role?: OrgRole | string) => boolean;
  /** Short pill shown next to the label, e.g. 'Soon' for an explainer-only page. */
  badge?: string;
}

/**
 * Two products, not one menu.
 *
 * The AI Overview and the certification are separate offerings and separate
 * purchases: the overview is a tool an organisation uses to understand and
 * evidence its own AI, and is worth having whether or not a certificate ever
 * follows. Certification is an assessment against the AIC standard. Running
 * them together as a single undifferentiated list told every new client that
 * the tool was a step in a certification funnel, which undersells the half
 * that stands on its own and confuses what they are actually buying.
 *
 * Each product carries its own accent so the two read as distinct at a glance
 * without becoming two separate applications — they share the same data, and
 * one feeds the other, so a hard visual break would be a lie in the other
 * direction.
 */
const PRODUCTS: { key: string; name: string; tagline: string | null; accent: string; items: NavItem[] }[] = [
  {
    key: 'overview',
    name: 'AI Overview',
    tagline: 'What you run, and what changed',
    accent: '#3f8f83',
    items: [
      { label: 'Continuity Record', href: '/',              icon: LayoutDashboard },
      { label: 'AI Estate',         href: '/overview',      icon: Boxes },
      { label: 'Register Drafter',   href: '/register-drafter', icon: Sparkles, badge: 'Soon' },
      { label: 'Decision Log',      href: '/pulse',         icon: Activity },
      { label: 'API & Access Keys', href: '/settings/keys', icon: Key, restricted: canManageTeamAndKeys },
    ],
  },
  {
    key: 'certification',
    name: 'Certification',
    tagline: 'Assessment against the AIC standard',
    accent: '#c9920a',
    items: [
      { label: 'Evidence Vault',     href: '/evidence',       icon: ShieldCheck },
      { label: 'Assessor Findings',  href: '/findings',       icon: AlertTriangle },
      { label: 'Reports',            href: '/reports',        icon: FileCheck },
      { label: 'Correspondence',     href: '/correspondence', icon: MessageSquare },
      { label: 'My Certificate',     href: '/certificate',    icon: Award },
    ],
  },
  {
    key: 'account',
    name: 'Account',
    tagline: null,
    accent: '#6b7280',
    items: [
      { label: 'Organisation Profile', href: '/organisation', icon: Building2 },
      { label: 'Team',                 href: '/settings',     icon: Users, restricted: canManageTeamAndKeys },
      { label: 'Practitioner (CAAP)',  href: '/practitioner', icon: GraduationCap },
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
  role,
}: {
  show: boolean;
  onClose: () => void;
  isActive: (href: string) => boolean;
  /** The signed-in person's org-level role - undefined while the session is
   *  still loading. Items marked `restricted` stay hidden until a role that
   *  passes the check arrives, rather than flashing visible-then-hidden. */
  role?: OrgRole | string;
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
            <div className="text-xs font-semibold text-white/85 mt-0.5 truncate">Example Organisation</div>
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
        {PRODUCTS.map((group) => (
          <div key={group.key}>
            <div
              className="px-2 mb-2 border-l-2 pl-2.5"
              style={{ borderColor: group.accent }}
            >
              <div
                className="font-mono text-[9px] font-bold uppercase tracking-[0.22em]"
                style={{ color: group.accent }}
              >
                {group.name}
              </div>
              {group.tagline && (
                <div className="font-mono text-[8px] text-white/[0.28] tracking-wide mt-0.5 leading-snug">
                  {group.tagline}
                </div>
              )}
            </div>
            <nav className="space-y-0.5">
              {group.items
                .filter((item) => !('restricted' in item) || !item.restricted || item.restricted(role))
                .map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={`flex items-center gap-2.5 py-2 px-2.5 rounded-lg text-xs font-medium transition-all border-l-2 ${
                      active
                        ? 'bg-white/[0.09] text-white'
                        : 'text-white/[0.38] hover:bg-white/[0.05] hover:text-white/70 border-transparent'
                    }`}
                    style={active ? { borderColor: group.accent } : undefined}
                  >
                    <Icon
                      className="w-3.5 h-3.5 flex-shrink-0"
                      style={active ? { color: group.accent } : undefined}
                    />
                    <span className="flex-1">{item.label}</span>
                    {'badge' in item && item.badge && (
                      <span className="font-mono text-[7px] font-bold uppercase tracking-wide text-white/40 bg-white/[0.06] px-1.5 py-0.5 rounded flex-shrink-0">
                        {item.badge}
                      </span>
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
        <a
          href={process.env.NEXT_PUBLIC_AIC_WEB_URL || 'https://aiccertified.cloud'}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-white/30 text-xs transition-colors hover:text-white/70"
        >
          <ExternalLink className="w-3.5 h-3.5" /> aiccertified.cloud
        </a>
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
