'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

interface Route {
  label: string;
  href: string;
}

interface Department {
  id: string;
  label: string;
  icon: React.ReactNode;
  routes: Route[];
}

export default function HQShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

  // Handle Cmd+K for search
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const departments: Department[] = [
    {
      id: 'governance',
      label: 'Governance',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
      routes: [
        { label: 'Regulatory Stack', href: '/governance/legal' },
        { label: 'Information Regulator', href: '/governance/regulator' },
        { label: 'SADC Mapping', href: '/governance/sadc' },
        { label: 'Constitutional Rights', href: '/governance/constitution' }
      ]
    },
    {
      id: 'operations',
      label: 'Operations',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
      routes: [
        { label: 'Audit Queue', href: '/audits' },
        { label: 'Quality Control', href: '/operations/qc' },
        { label: 'Verification Board', href: '/verification' }
      ]
    },
    {
      id: 'growth',
      label: 'Growth',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
      routes: [
        { label: 'Enterprise CRM', href: '/crm' },
        { label: 'Pipeline Velocity', href: '/growth/revenue' },
        { label: 'Insurance Partners', href: '/growth/insurance' }
      ]
    },
    {
      id: 'intelligence',
      label: 'Intelligence',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
      routes: [
        { label: 'Audit Engine Ops', href: '/intelligence/engine' },
        { label: 'XAI Research', href: '/intelligence/xai' },
        { label: 'Data Lake', href: '/intelligence/data' }
      ]
    },
    {
      id: 'people',
      label: 'People',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
      routes: [
        { label: 'Auditor Training', href: '/training' },
        { label: 'Performance', href: '/people/performance' },
        { label: 'HR Registry', href: '/people/hr' }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-white text-[#0e1b2c] flex first-cap text-[12px]">
      <AnimatePresence>
        {searchOpen && (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] bg-white backdrop-blur-xl flex items-center justify-center p-4 sm:p-6"
            >
                <motion.div
                    initial={{ scale: 0.95, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    className="w-full max-w-2xl bg-white border border-[#dde2e8] rounded-xl p-6 md:p-12 shadow-[0_0_50px_rgba(212,175,55,0.15)]"
                >
                    <div className="flex items-center gap-6 mb-12">
                        <svg className="w-6 h-6 text-[#8a6a1f]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        <input
                            autoFocus
                            placeholder="QUERY REGISTRY..."
                            className="bg-transparent border-none text-2xl font-serif text-[#0e1b2c] outline-none w-full"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                        <button onClick={() => setSearchOpen(false)} className="text-gray-600 hover:text-[#0e1b2c]">ESC</button>
                    </div>

                    <div className="space-y-8">
                        <div>
                            <p className="text-[11px] text-gray-600 mb-4 tracking-[0.4em]">Suggested Commands</p>
                            <div className="grid grid-cols-2 gap-4">
                                {['/verify-id', '/audit-queue', '/revenue-report', '/training-log'].map(cmd => (
                                    <div key={cmd} className="p-4 bg-[#f5f7f9] border border-[#dde2e8] rounded-xl text-gray-500 font-mono text-[11px] hover:border-aic-copper/30 hover:text-[#0e1b2c] transition-all cursor-pointer">
                                        {cmd}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>

      {/* Universal HQ Navigation */}
      <aside className="w-20 bg-white border-r border-[#dde2e8] flex flex-col items-center py-8 gap-8 fixed h-full z-30">
        <div className="h-10 w-10 rounded-xl bg-aic-copper/10 border border-aic-copper/30 flex items-center justify-center text-[#8a6a1f] font-serif font-bold text-xl mb-8">A</div>
        {departments.map((dept) => (
            <Link
                key={dept.id}
                href={dept.routes[0].href}
                className={`p-4 rounded-2xl transition-all duration-500 hover:bg-[#eef1f5] group relative ${pathname.startsWith('/' + dept.id) ? 'bg-aic-copper/10 text-aic-copper border border-aic-copper/20 shadow-none' : 'text-gray-600'}`}
            >
                {dept.icon}
                <span className="absolute left-full ml-4 px-3 py-1 bg-aic-copper text-black rounded font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                    {dept.label}
                </span>
            </Link>
        ))}
      </aside>

      {/* Department Sidebar */}
      <aside className="w-64 ml-20 bg-white border-r border-[#dde2e8] p-5 md:p-8 flex flex-col fixed h-full z-20 shadow-2xl">
        <div className="mb-12">
            <p className="text-[12px] text-gray-600 first-cap mb-2">AIC_CORPORATE_OS</p>
            <h2 className="text-xs font-bold text-[#0e1b2c] tracking-[0.3em]">
                {departments.find(d => pathname.includes(d.id))?.label.toUpperCase() || 'COMMAND'}
            </h2>
        </div>

        <nav className="space-y-2 flex-1">
            {departments.find(d => pathname.includes(d.id))?.routes.map((route) => (
                <Link
                    key={route.href}
                    href={route.href}
                    className={`block py-3 px-4 rounded-lg transition-all border ${
                        pathname === route.href
                        ? 'bg-[#f5f7f9] border-[#dde2e8] text-[#0e1b2c] shadow-xl'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-[#eef1f5]'
                    }`}
                >
                    {route.label}
                </Link>
            ))}
        </nav>

        <div className="mt-auto pt-8 border-t border-[#dde2e8] opacity-30">
            <p className="text-[11px] tracking-[0.5em] text-gray-500">ENCRYPTED_SESSION_v4.0</p>
        </div>
      </aside>

      {/* Content Engine */}
      <main className="flex-1 ml-[20rem] min-h-screen bg-white">
        <header className="sticky top-0 z-10 bg-white backdrop-blur-xl border-b border-[#dde2e8] px-6 md:px-12 py-8 flex justify-between items-center">
            <div className="flex items-center gap-4">
                <div className="h-1.5 w-1.5 rounded-full bg-aic-copper animate-pulse shadow-none"></div>
                <h3 className="text-[11.5px] font-bold tracking-[0.4em] text-[#0e1b2c]">INTER_COMPANY_SYNC_ACTIVE</h3>
            </div>
            <div className="flex items-center gap-8">
                <div className="text-right">
                    <p className="text-[11px] text-gray-500">USER_TOKEN</p>
                    <p className="text-[11px] text-[#0e1b2c] font-bold">Z. WILKEN_ADMIN</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-white border border-[#dde2e8]"></div>
            </div>
        </header>
        <div className="p-6 md:p-12 max-w-7xl mx-auto">
            {children}
        </div>
      </main>
    </div>
  );
}
