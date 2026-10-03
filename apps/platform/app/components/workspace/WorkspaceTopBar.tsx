'use client';

import Link from 'next/link';
import { useState } from 'react';
import { signOut } from 'next-auth/react';
import * as NavigationMenu from '@radix-ui/react-navigation-menu';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown, LogOut, Menu, X } from 'lucide-react';
import type { NavGroup, NavItem } from './nav';

/**
 * The top bar both workspaces share.
 *
 * Why a top bar rather than the old 256px sidebar: AIC's client workspace has
 * ten destinations in three groups. A permanent sidebar spent a quarter of the
 * screen advertising all ten on every page. Grouped menus — the pattern
 * Square, Stripe and Linear use for a product of this size — keep the whole
 * width for the record itself, which is the thing the client came to look at.
 *
 * Each menu opens a panel rather than a bare list: an icon, a name and one line
 * saying what the page is for. A compliance officer seeing "Evidence Vault" for
 * the first time should not have to click it to find out what it holds.
 *
 * Built on the Radix primitives directly rather than the shadcn wrappers, so the
 * two tones below are set here instead of fighting the wrappers' theme classes.
 * Radix brings the keyboard behaviour: arrow keys between menus, Escape to
 * close, focus returned to the trigger.
 */

type Tone = 'light' | 'dark';

const TONE = {
  light: {
    bar: 'bg-white/85 border-[#0a1728]/[0.06] text-[#0A1728]',
    muted: 'text-[#6b7280]',
    faint: 'text-[#9ca3af]',
    trigger: 'text-[#374151] hover:text-[#0A1728] hover:bg-[#0a1728]/[0.04] data-[state=open]:bg-[#0a1728]/[0.05] data-[state=open]:text-[#0A1728]',
    triggerActive: 'text-[#0A1728]',
    panel: 'bg-white border-[#0a1728]/[0.07] shadow-[0_1px_3px_rgba(10,23,40,0.05),0_18px_48px_-18px_rgba(10,23,40,0.22)]',
    item: 'hover:bg-[#0a1728]/[0.035] focus:bg-[#0a1728]/[0.035]',
    itemActive: 'bg-[#c9920a]/[0.07]',
    tile: 'bg-[#0a1728]/[0.04] text-[#0A1728]',
    tileActive: 'bg-[#c9920a]/15 text-[#a87a08]',
    divider: 'bg-[#0a1728]/[0.08]',
    avatar: 'bg-[#0A1728] text-white',
  },
  dark: {
    bar: 'bg-[#0A1728]/90 border-white/[0.07] text-white',
    muted: 'text-white/55',
    faint: 'text-white/35',
    trigger: 'text-white/65 hover:text-white hover:bg-white/[0.06] data-[state=open]:bg-white/[0.08] data-[state=open]:text-white',
    triggerActive: 'text-white',
    panel: 'bg-[#0f1f3d] border-white/[0.08] shadow-[0_18px_48px_-18px_rgba(0,0,0,0.6)]',
    item: 'hover:bg-white/[0.05] focus:bg-white/[0.05]',
    itemActive: 'bg-[#c9920a]/[0.12]',
    tile: 'bg-white/[0.06] text-white/85',
    tileActive: 'bg-[#c9920a]/20 text-[#e4a80c]',
    divider: 'bg-white/[0.1]',
    avatar: 'bg-[#c9920a] text-[#0A1728]',
  },
} as const;

export interface WorkspaceTopBarProps {
  tone: Tone;
  homeHref: string;
  /** Organisation name, or "AIC Staff". Null while it loads. */
  contextLabel: string | null;
  contextDetail?: string | null;
  groups: NavGroup[];
  accountItems: NavItem[];
  isActive: (href: string) => boolean;
  user: { name: string | null; email: string | null; roleLabel: string | null };
  /** Notifications and anything else that belongs beside the person menu. */
  actions?: React.ReactNode;
  /** Extra entries at the foot of the person menu, e.g. "Take the tour". */
  menuExtras?: { label: string; onSelect: () => void; icon: React.ComponentType<{ className?: string }> }[];
}

function initialsOf(nameOrEmail: string): string {
  const base = nameOrEmail.includes('@') ? nameOrEmail.split('@')[0] : nameOrEmail;
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function WorkspaceTopBar({
  tone,
  homeHref,
  contextLabel,
  contextDetail,
  groups,
  accountItems,
  isActive,
  user,
  actions,
  menuExtras = [],
}: WorkspaceTopBarProps) {
  const t = TONE[tone];
  const [mobileOpen, setMobileOpen] = useState(false);
  const display = user.name ?? user.email ?? 'Signed in';

  return (
    <header className={`sticky top-0 z-40 border-b backdrop-blur-xl ${t.bar}`}>
      <div className="max-w-[1400px] mx-auto h-16 px-4 md:px-8 flex items-center gap-4 md:gap-8">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className={`md:hidden -ml-1 p-2 rounded-lg ${t.trigger}`}
          aria-label="Open navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Brand and context — whose record this is. */}
        <Link href={homeHref} className="flex items-center gap-3 min-w-0 shrink-0">
          <span className="font-serif text-[19px] font-bold tracking-tight leading-none">
            AIC<span className="text-[#c9920a]">.</span>
          </span>
          <span className={`hidden sm:block w-px h-6 ${t.divider}`} />
          <span className="hidden sm:flex flex-col min-w-0 max-w-[220px]">
            <span className="text-[13px] font-semibold leading-tight truncate">
              {contextLabel ?? <span className={t.faint}>Loading…</span>}
            </span>
            {contextDetail && (
              <span className={`text-[11px] leading-tight truncate ${t.muted}`}>{contextDetail}</span>
            )}
          </span>
        </Link>

        {/* Grouped menus. */}
        <NavigationMenu.Root className="hidden md:block relative" delayDuration={120}>
          <NavigationMenu.List className="flex items-center gap-1">
            {groups.map((group) => {
              const groupActive = group.items.some((i) => isActive(i.href));
              return (
                <NavigationMenu.Item key={group.key} className="relative">
                  <NavigationMenu.Trigger
                    data-tour={`nav-${group.key}`}
                    className={`group inline-flex items-center gap-1 h-9 px-3 rounded-lg text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#c9920a]/40 ${t.trigger} ${groupActive ? t.triggerActive : ''}`}
                  >
                    {group.label}
                    {groupActive && <span className="w-1 h-1 rounded-full bg-[#c9920a] ml-0.5" aria-hidden />}
                    <ChevronDown className="w-3.5 h-3.5 opacity-60 transition-transform duration-200 group-data-[state=open]:rotate-180" aria-hidden />
                  </NavigationMenu.Trigger>

                  <NavigationMenu.Content
                    className={`absolute left-0 top-full mt-2 w-[420px] rounded-2xl border p-2 z-50 ${t.panel} data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95`}
                  >
                    <p className={`px-3 pt-2 pb-2.5 text-[12px] leading-snug ${t.muted}`}>{group.summary}</p>
                    <ul className="space-y-0.5">
                      {group.items.map((item) => {
                        const active = isActive(item.href);
                        const Icon = item.icon;
                        return (
                          <li key={item.href}>
                            <NavigationMenu.Link asChild active={active}>
                              <Link
                                href={item.href}
                                className={`flex items-start gap-3 rounded-xl px-3 py-2.5 outline-none transition-colors ${t.item} ${active ? t.itemActive : ''}`}
                              >
                                <span className={`mt-0.5 w-8 h-8 shrink-0 rounded-lg flex items-center justify-center ${active ? t.tileActive : t.tile}`}>
                                  <Icon className="w-4 h-4" />
                                </span>
                                <span className="min-w-0">
                                  <span className="flex items-center gap-2 text-[13px] font-semibold leading-tight">
                                    {item.label}
                                    {item.badge && (
                                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${t.tile}`}>{item.badge}</span>
                                    )}
                                  </span>
                                  <span className={`block text-[12px] leading-snug mt-0.5 ${t.muted}`}>{item.description}</span>
                                </span>
                              </Link>
                            </NavigationMenu.Link>
                          </li>
                        );
                      })}
                    </ul>
                  </NavigationMenu.Content>
                </NavigationMenu.Item>
              );
            })}
          </NavigationMenu.List>
        </NavigationMenu.Root>

        <div className="ml-auto flex items-center gap-2">
          {actions}

          {/* The person — and the account pages that belong to them, not to the work. */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger
              data-tour="account"
              className={`flex items-center gap-2.5 rounded-xl pl-1.5 pr-2 py-1.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#c9920a]/40 ${t.trigger}`}
            >
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold ${t.avatar}`}>
                {initialsOf(display)}
              </span>
              <span className="hidden lg:flex flex-col items-start leading-tight">
                <span className="text-[12.5px] font-semibold max-w-[160px] truncate">{display}</span>
                {user.roleLabel && <span className={`text-[11px] ${t.muted}`}>{user.roleLabel}</span>}
              </span>
              <ChevronDown className="hidden lg:block w-3.5 h-3.5 opacity-50" aria-hidden />
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={8}
                className={`z-50 w-64 rounded-2xl border p-1.5 ${t.panel} ${tone === 'dark' ? 'text-white' : 'text-[#0A1728]'} data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95`}
              >
                <div className="px-3 py-2.5">
                  <p className="text-[13px] font-semibold truncate">{display}</p>
                  {user.email && user.name && <p className={`text-[12px] truncate ${t.muted}`}>{user.email}</p>}
                </div>
                {accountItems.length > 0 && <div className={`h-px my-1 ${t.divider}`} />}
                {accountItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <DropdownMenu.Item key={item.href} asChild>
                      <Link
                        href={item.href}
                        className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] outline-none cursor-pointer ${t.item}`}
                      >
                        <Icon className={`w-4 h-4 ${t.muted}`} />
                        {item.label}
                      </Link>
                    </DropdownMenu.Item>
                  );
                })}
                {menuExtras.map((x) => (
                  <DropdownMenu.Item key={x.label} onSelect={x.onSelect}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] outline-none cursor-pointer ${t.item}`}>
                    <x.icon className={`w-4 h-4 ${t.muted}`} />
                    {x.label}
                  </DropdownMenu.Item>
                ))}
                <div className={`h-px my-1 ${t.divider}`} />
                <DropdownMenu.Item
                  onSelect={() => signOut({ callbackUrl: '/login' })}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] outline-none cursor-pointer ${t.item}`}
                >
                  <LogOut className={`w-4 h-4 ${t.muted}`} />
                  Sign out
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>

      {/* Small screens: the same groups as one list. */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-[#0A1728]/30 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <nav
            className={`absolute inset-y-0 left-0 w-[86%] max-w-sm overflow-y-auto border-r p-4 ${t.panel} ${tone === 'dark' ? 'text-white' : 'text-[#0A1728]'}`}
            aria-label="Workspace"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="font-serif text-[19px] font-bold">AIC<span className="text-[#c9920a]">.</span></span>
              <button type="button" onClick={() => setMobileOpen(false)} className={`p-2 rounded-lg ${t.trigger}`} aria-label="Close navigation">
                <X className="w-5 h-5" />
              </button>
            </div>
            {groups.map((group) => (
              <div key={group.key} className="mb-5">
                <p className={`px-2 mb-1.5 text-[11px] font-semibold uppercase tracking-wide ${t.faint}`}>{group.label}</p>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-2 py-2 text-[14px] ${t.item} ${active ? t.itemActive : ''}`}
                    >
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${active ? t.tileActive : t.tile}`}>
                        <Icon className="w-4 h-4" />
                      </span>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
