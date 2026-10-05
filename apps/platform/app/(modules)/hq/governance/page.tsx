import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Eyebrow } from '@/app/components/ui/Eyebrow';

/**
 * The HQ front door.
 *
 * This page used to be a staff-provisioning screen that asked for a password
 * in a browser prompt, posted to an /api/users route that does not exist, and
 * "toggled" permissions only in local state. Real account and permission
 * management lives at /admin/users and /admin/permissions, which write to the
 * database and the admin log. HQ had no menu of its own either, so most of its
 * pages could only be reached by typing the address. This lists them.
 */

const SECTIONS: { title: string; items: { href: string; label: string; description: string }[] }[] = [
  {
    title: 'Growth',
    items: [
      { href: '/hq/growth/revenue', label: 'Pipeline', description: 'Leads by stage, from the commercial pipeline.' },
      { href: '/hq/crm', label: 'CRM', description: 'Every lead and where it came from.' },
      { href: '/hq/subscribers', label: 'Newsletter subscribers', description: 'Sign-ups for The Pulse, with a CSV export.' },
      { href: '/hq/cms', label: 'Public insights', description: 'Articles published on the public site.' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { href: '/hq/operations/qc', label: 'Quality control', description: 'Evidence decisions and how consistently they are made.' },
      { href: '/hq/intelligence/engine', label: 'Audit engine', description: 'Whether the engine is reachable, and what it has run.' },
      { href: '/hq/training', label: 'Assessor academy', description: 'Curriculum and the lead assessor exam.' },
    ],
  },
  {
    title: 'People',
    items: [
      { href: '/hq/people/performance', label: 'Staff activity', description: 'What each staff member has recorded, from the logs.' },
      { href: '/hq/people/hr', label: 'Roles', description: 'AIC’s own roles and who holds them.' },
      { href: '/admin/users', label: 'Users', description: 'Create, suspend and change accounts. Every change is logged.' },
      { href: '/admin/permissions', label: 'Permissions', description: 'What each staff role may do.' },
    ],
  },
  {
    title: 'Regulation',
    items: [
      { href: '/hq/governance/regulator', label: 'Information Regulator', description: 'POPIA and AIC’s position with the regulator.' },
      { href: '/hq/governance/legal', label: 'Regulatory stack', description: 'The laws and standards AIC maps to.' },
      { href: '/hq/governance/sadc', label: 'SADC mapping', description: 'Data-protection law across the region.' },
      { href: '/hq/governance/expansion', label: 'Expansion', description: 'Markets beyond South Africa.' },
    ],
  },
];

export default function HqHome() {
  return (
    <div className="max-w-5xl space-y-8">
      <header>
        <Eyebrow>HQ</Eyebrow>
        <h1 className="font-serif text-[30px] md:text-[34px] leading-tight font-semibold text-[#0e1b2c]">AIC headquarters</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[#5e6b7b] max-w-2xl">
          AIC’s own business: growth, operations, people and regulation. Client assessment work stays under Assessments and Register.
        </p>
      </header>

      {SECTIONS.map((s) => (
        <section key={s.title}>
          <h2 className="mb-3 text-base font-semibold text-[#0e1b2c]">{s.title}</h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {s.items.map((i) => (
              <li key={i.href}>
                <Link
                  href={i.href}
                  className="lift group flex h-full items-start justify-between gap-3 rounded-xl border border-[#dde2e8] bg-white p-4 transition-colors hover:border-[#a8772a]"
                >
                  <span>
                    <span className="block text-sm font-semibold text-[#0e1b2c]">{i.label}</span>
                    <span className="mt-1 block text-[13px] leading-relaxed text-[#5e6b7b]">{i.description}</span>
                  </span>
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[#9aa5b1] group-hover:text-[#8a6a1f]" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
