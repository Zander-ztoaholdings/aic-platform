'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { signOut } from 'next-auth/react';
import { ChevronDown, LogOut, Search, X, LayoutGrid } from 'lucide-react';
import type { NavGroup, NavItem } from './nav';

/**
 * Phone navigation, in the way phone apps do it.
 *
 * A tab bar at the bottom, within reach of a thumb, holds the four places
 * people go most. "Menu" opens a sheet from the bottom with everything else:
 * grouped, each group folding open, with a search field once the list is long.
 * The menu grew past twenty entries in October 2026, which is too many for the
 * old side drawer to scan.
 */

export interface MobileNavProps {
  tabs: NavItem[];
  groups: NavGroup[];
  accountItems: NavItem[];
  isActive: (href: string) => boolean;
  contextLabel: string | null;
  contextDetail?: string | null;
  userLabel: string;
  menuExtras?: { label: string; onSelect: () => void; icon: React.ComponentType<{ className?: string }> }[];
}

export function MobileNav({ tabs, groups, accountItems, isActive, contextLabel, contextDetail, userLabel, menuExtras = [] }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const activeGroup = groups.find((g) => g.items.some((i) => isActive(i.href)))?.key ?? groups[0]?.key;
  const [expanded, setExpanded] = useState<Set<string>>(new Set(activeGroup ? [activeGroup] : []));
  const total = groups.reduce((n, g) => n + g.items.length, 0);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open]);

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return null;
    return groups.flatMap((g) => g.items.filter((i) => `${i.label} ${i.description} ${g.label}`.toLowerCase().includes(s)).map((i) => ({ ...i, group: g.label })));
  }, [q, groups]);

  const close = () => { setOpen(false); setQ(''); };
  const tabActive = (href: string) => isActive(href);
  const onTab = tabs.some((t) => tabActive(t.href));

  const Row = ({ item, sub }: { item: NavItem; sub?: string }) => {
    const Icon = item.icon;
    const active = isActive(item.href);
    return (
      <Link href={item.href} onClick={close}
        className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 min-h-[52px] ${active ? 'bg-[#a8772a]/10' : 'active:bg-[#eef1f5]'}`}>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${active ? 'bg-[#0e1b2c] text-white' : 'bg-[#f1f3f6] text-[#0e1b2c]'}`}><Icon className="h-[18px] w-[18px]" /></span>
        <span className="min-w-0">
          <span className="block text-[15px] font-medium leading-tight text-[#0e1b2c]">{item.label}{item.badge && <span className="ml-2 rounded-md bg-[#eef1f5] px-1.5 py-0.5 text-[11px] font-medium text-[#5e6b7b]">{item.badge}</span>}</span>
          <span className="mt-0.5 block truncate text-[12.5px] text-[#5e6b7b]">{sub ?? item.description}</span>
        </span>
      </Link>
    );
  };

  return (
    <>
      {/* Tab bar */}
      <nav aria-label="Main" className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-[#0a1728]/[0.07] bg-white/80 backdrop-blur-xl backdrop-saturate-[1.8] pb-[env(safe-area-inset-bottom)]">
        <ul className="mx-auto flex h-[58px] max-w-lg items-stretch">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tabActive(t.href);
            return (
              <li key={t.href} className="flex-1">
                <Link href={t.href} aria-current={active ? 'page' : undefined} className={`flex h-full flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium ${active ? 'text-[#0e1b2c]' : 'text-[#8a95a3]'}`}>
                  <Icon className={`h-[22px] w-[22px] ${active ? 'stroke-[2.2]' : ''}`} />
                  <span className="max-w-[72px] truncate">{t.label}</span>
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}
              className={`flex h-full w-full flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium ${!onTab ? 'text-[#0e1b2c]' : 'text-[#8a95a3]'}`}>
              <LayoutGrid className={`h-[22px] w-[22px] ${!onTab ? 'stroke-[2.2]' : ''}`} />
              <span>Menu</span>
            </button>
          </li>
        </ul>
      </nav>

      {/* Menu sheet */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-[#0A1728]/30 backdrop-blur-[2px] scrim-in" onClick={close} />
          <div className="sheet-up absolute inset-x-0 bottom-0 flex max-h-[90dvh] flex-col rounded-t-[22px] bg-[#fbfcfd] shadow-[0_-12px_40px_-12px_rgba(10,23,40,0.3)]">
            <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-[#d4dae1]" aria-hidden />
            <div className="flex items-start justify-between gap-3 px-5 pt-3 pb-3">
              <div className="min-w-0">
                <p className="truncate font-serif text-[20px] font-semibold leading-snug text-[#0e1b2c]">{contextLabel ?? 'AIC'}</p>
                {contextDetail && <p className="truncate text-[13px] text-[#5e6b7b]">{contextDetail}</p>}
              </div>
              <button type="button" onClick={close} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#eef1f5] text-[#0e1b2c]" aria-label="Close menu"><X className="h-5 w-5" /></button>
            </div>

            {total > 8 && (
              <div className="px-5 pb-2">
                <label className="flex h-11 items-center gap-2 rounded-xl bg-[#eef1f5] px-3">
                  <Search className="h-4 w-4 text-[#8a95a3]" />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the menu" className="w-full bg-transparent text-[16px] text-[#0e1b2c] outline-none placeholder:text-[#8a95a3]" aria-label="Search the menu" />
                </label>
              </div>
            )}

            <div className="overflow-y-auto overscroll-contain px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {matches ? (
                matches.length === 0 ? <p className="px-3 py-6 text-sm text-[#5e6b7b]">Nothing matches “{q}”.</p> :
                  <div className="py-1">{matches.map((i) => <Row key={i.href} item={i} sub={i.group} />)}</div>
              ) : (
                groups.map((g) => {
                  const isOpen = expanded.has(g.key);
                  return (
                    <div key={g.key} className="border-b border-[#eef1f5] last:border-0">
                      <button type="button" aria-expanded={isOpen}
                        onClick={() => setExpanded((s) => { const n = new Set(s); if (n.has(g.key)) n.delete(g.key); else n.add(g.key); return n; })}
                        className="flex w-full items-center justify-between px-3 py-3.5 text-left">
                        <span className="text-[15px] font-semibold text-[#0e1b2c]">{g.label} <span className="font-normal text-[#8a95a3]">{g.items.length}</span></span>
                        <ChevronDown className={`h-4 w-4 text-[#8a95a3] transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                      <div className={`grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                        <div className="overflow-hidden"><div className="pb-2">{g.items.map((i) => <Row key={i.href} item={i} />)}</div></div>
                      </div>
                    </div>
                  );
                })
              )}

              {!matches && (
                <div className="mt-3 rounded-2xl bg-white p-1.5 border border-[#eef1f5]">
                  <p className="px-3 pt-2 pb-1 text-[12.5px] text-[#8a95a3]">{userLabel}</p>
                  {accountItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link key={item.href} href={item.href} onClick={close} className="flex min-h-[48px] items-center gap-3 rounded-xl px-3 text-[15px] text-[#0e1b2c] active:bg-[#eef1f5]">
                        <Icon className="h-[18px] w-[18px] text-[#5e6b7b]" />{item.label}
                      </Link>
                    );
                  })}
                  {menuExtras.map((x) => (
                    <button key={x.label} type="button" onClick={() => { close(); x.onSelect(); }} className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] text-[#0e1b2c] active:bg-[#eef1f5]">
                      <x.icon className="h-[18px] w-[18px] text-[#5e6b7b]" />{x.label}
                    </button>
                  ))}
                  <button type="button" onClick={() => signOut({ callbackUrl: '/login' })} className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] text-[#b42318] active:bg-[#eef1f5]">
                    <LogOut className="h-[18px] w-[18px]" />Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
