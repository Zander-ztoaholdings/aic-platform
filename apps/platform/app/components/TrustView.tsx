import { BadgeCheck, Award, UserRound, ScrollText, Layers, Activity, Boxes, Mail } from 'lucide-react';
import type { TrustView as View } from '@/lib/trust';

const WEB = (process.env.NEXT_PUBLIC_AIC_WEB_URL || 'https://aiccertified.cloud').replace(/\/+$/, '');
const date = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

function Who({ by }: { by: 'aic' | 'observed' | 'declared' }) {
  const t = by === 'aic' ? 'Issued by AIC' : by === 'observed' ? 'Observed by AIC' : 'Declared by the organisation';
  const c = by === 'declared' ? 'bg-[#eef1f5] text-[#5e6b7b]' : 'bg-[#a8772a]/10 text-[#8a6a1f]';
  return <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-medium ${c}`}>{t}</span>;
}

function Block({ icon: Icon, title, by, children }: { icon: typeof Award; title: string; by: 'aic' | 'observed' | 'declared'; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#dde2e8] bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-[#0e1b2c]"><Icon className="h-4 w-4 text-[#8a6a1f]" />{title}</h2>
        <Who by={by} />
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** The public Trust page body. Used by /trust/[slug] and by the preview in settings. */
export function TrustView({ v }: { v: View }) {
  const nothing = !v.badge && !v.certificate && !v.accountablePerson && !v.policies && !v.frameworks && !v.monitoring && !v.systems;
  return (
    <div className="space-y-4">
      {v.intro && <p className="text-[15px] leading-relaxed text-[#5e6b7b] whitespace-pre-line">{v.intro}</p>}

      {nothing && <p className="rounded-2xl border border-[#dde2e8] bg-white p-6 text-sm text-[#5e6b7b]">Nothing has been published here yet.</p>}

      {(v.badge || v.certificate) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {v.badge && (
            <Block icon={BadgeCheck} title="AIC Aware" by="aic">
              <p className="text-sm text-[#0e1b2c]">
                {v.badge.status === 'valid' ? 'Holds a current AIC Aware badge' : 'AIC Aware badge has expired'}, code <span className="font-medium">{v.badge.code}</span>.
              </p>
              <p className="mt-1 text-[13px] text-[#5e6b7b]">Issued {date(v.badge.issuedAt)}, valid until {date(v.badge.expiresAt)}. AIC Aware is a self-declaration by a named accountable person, not a certification.</p>
              <a href={`${WEB}/registry/aware/${v.badge.code}`} className="mt-3 inline-block text-[13px] font-medium text-[#8a6a1f] hover:underline underline-offset-2">Verify on aiccertified.cloud</a>
            </Block>
          )}
          {v.certificate && (
            <Block icon={Award} title="AIC certificate" by="aic">
              <p className="text-sm text-[#0e1b2c]">Certificate <span className="font-medium">{v.certificate.number}</span>{v.certificate.status !== 'ACTIVE' ? `, ${v.certificate.status.toLowerCase()}` : ''}.</p>
              <p className="mt-1 text-[13px] text-[#5e6b7b]">{v.certificate.standard ?? 'AIC standard'}. Issued {date(v.certificate.issued)}, expires {date(v.certificate.expires)}.</p>
              <a href={`${WEB}/verify/${v.certificate.number}`} className="mt-3 inline-block text-[13px] font-medium text-[#8a6a1f] hover:underline underline-offset-2">Verify on aiccertified.cloud</a>
            </Block>
          )}
        </div>
      )}

      {v.accountablePerson && (
        <Block icon={UserRound} title="Accountable person" by="declared">
          <p className="text-sm text-[#0e1b2c]"><span className="font-medium">{v.accountablePerson.name}</span>{v.accountablePerson.jobTitle ? `, ${v.accountablePerson.jobTitle}` : ''}</p>
          <p className="mt-1 text-[13px] text-[#5e6b7b]">Signed AIC&apos;s accountable person declaration on {date(v.accountablePerson.since)}: answerable, as an individual, for how this organisation uses AI in decisions about people.</p>
        </Block>
      )}

      {v.frameworks && v.frameworks.length > 0 && (
        <Block icon={Layers} title="Framework coverage" by="observed">
          <ul className="space-y-3">
            {v.frameworks.map((f) => (
              <li key={f.key}>
                <div className="flex justify-between gap-3 text-[13px]"><span className="text-[#0e1b2c]">{f.name}</span><span className="text-[#5e6b7b]">{f.evidenced} of {f.total} controls evidenced</span></div>
                <div className="mt-1 h-1.5 rounded-full bg-[#eef1f5]"><div className="h-1.5 rounded-full bg-[#a8772a]" style={{ width: `${f.total ? (f.evidenced / f.total) * 100 : 0}%` }} /></div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12px] text-[#8a95a3]">Evidenced means AIC holds evidence towards the control: a passing check, a published and accepted policy, or a document an assessor accepted. It is not a certification of the framework.</p>
        </Block>
      )}

      {v.monitoring && (
        <Block icon={Activity} title="Continuous monitoring" by="observed">
          <p className="text-sm text-[#0e1b2c]">AIC reads {v.monitoring.connectors.join(', ')} with read-only access{v.monitoring.lastChecked ? `, last on ${date(v.monitoring.lastChecked)}` : ''}.</p>
          {v.monitoring.areas.length > 0 && (
            <ul className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
              {v.monitoring.areas.map((a) => (
                <li key={a.area} className="rounded-xl bg-[#f5f7f9] px-3 py-2.5">
                  <div className="text-[12px] text-[#5e6b7b]">{a.area}</div>
                  <div className="text-sm font-medium text-[#0e1b2c]">{a.passing} of {a.total} checks passing</div>
                </li>
              ))}
            </ul>
          )}
        </Block>
      )}

      {v.policies && (
        <Block icon={ScrollText} title="Published policies" by="declared">
          <ul className="divide-y divide-[#eef1f5]">
            {v.policies.map((p) => (
              <li key={p.title} className="flex flex-col sm:flex-row sm:justify-between gap-1 py-2.5 text-[13px]">
                <span className="text-[#0e1b2c]">{p.title} <span className="text-[#8a95a3]">version {p.version}</span></span>
                <span className="text-[#5e6b7b]">Accepted by {p.accepted} of {p.members} people</span>
              </li>
            ))}
          </ul>
        </Block>
      )}

      {v.systems && (
        <Block icon={Boxes} title="AI systems" by="declared">
          <ul className="divide-y divide-[#eef1f5]">
            {v.systems.map((s) => (
              <li key={s.name} className="py-2.5 text-[13px]">
                <div className="text-[#0e1b2c] font-medium">{s.name}</div>
                {s.purpose && <div className="text-[#5e6b7b]">{s.purpose}</div>}
              </li>
            ))}
          </ul>
        </Block>
      )}

      {v.contactEmail && (
        <p className="flex items-center gap-2 text-[13px] text-[#5e6b7b]"><Mail className="h-4 w-4" />Questions about this page: <a href={`mailto:${v.contactEmail}`} className="font-medium text-[#8a6a1f] hover:underline underline-offset-2">{v.contactEmail}</a></p>
      )}
    </div>
  );
}
