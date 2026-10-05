'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import AdminShell from './components/AdminShell';
import { ViewAsPicker } from '@/app/components/workspace/ViewAsPicker';
import { STAFF_NAV, visibleGroups } from '@/app/components/workspace/nav';
import type { WorkspaceUser } from '@/lib/workspace';

/**
 * Where AIC staff land after signing in.
 *
 * There was no /admin page. Staff were sent to the client dashboard instead,
 * which needs an organisation they do not have. This lists what this person's
 * role can reach, grouped as the menus are — and nothing else. No figures: a
 * staff home showing numbers it has not computed is the thing this codebase
 * keeps having to remove.
 */
export default function StaffHome() {
  const { data: session } = useSession();
  const user = (session?.user ?? {}) as WorkspaceUser & { name?: string | null };
  const groups = visibleGroups(STAFF_NAV, user);
  const first = user.name?.split(' ')[0];

  return (
    <AdminShell>
      <div className="mb-10">
        <h1 className="font-serif text-[30px] md:text-[34px] leading-tight font-semibold text-[#0e1b2c]">{first ? `Welcome back, ${first}` : 'Staff workspace'}</h1>
        <p className="text-[#5e6b7b] text-sm max-w-xl leading-relaxed">
          Assessment work, the register and AIC&apos;s own administration. You see what your role can act on;
          everything else stays out of the way.
        </p>
      </div>

      <ViewAsPicker />

      {groups.length === 0 && session && (
        <p className="text-[#5e6b7b] text-sm">Your account has no staff capabilities yet. Ask a super admin to grant them.</p>
      )}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((group) => (
          <section key={group.key} className="rounded-2xl border border-[#dde2e8] bg-[#f5f7f9] p-5">
            <h2 className="text-[15px] font-semibold text-[#0e1b2c]">{group.label}</h2>
            <p className="text-[12.5px] text-[#8a95a3] mt-1 mb-4">{group.summary}</p>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="flex items-start gap-3 rounded-xl px-2.5 py-2 hover:bg-[#eef1f5] transition-colors"
                    >
                      <span className="mt-0.5 w-8 h-8 shrink-0 rounded-lg bg-[#f5f7f9] flex items-center justify-center text-[#5e6b7b]">
                        <Icon className="w-4 h-4" />
                      </span>
                      <span>
                        <span className="block text-[13px] font-semibold text-[#0e1b2c]">{item.label}</span>
                        <span className="block text-[12px] text-[#8a95a3] leading-snug">{item.description}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </AdminShell>
  );
}
