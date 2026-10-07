import Link from 'next/link';
import { publicLink } from '@/lib/onboarding-links';
import { JoinFrame } from './JoinFrame';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Start with AIC',
  description: 'Your invitation to register with AI Integrity Certification: about ten minutes, then your workspace with an AIC assessor alongside.',
  robots: { index: false, follow: false },
  openGraph: { title: 'Start with AIC', description: 'Your invitation to register with AI Integrity Certification.', siteName: 'AIC', type: 'website' as const },
  twitter: { card: 'summary_large_image' as const, title: 'Start with AIC', description: 'Your invitation to register with AI Integrity Certification.' },
};

const STEPS = [
  { t: 'Register your organisation', d: 'Five short questions: who you are, the Division you operate in, and the person accountable. About ten minutes.' },
  { t: 'Confirm your email', d: 'So we know the account is yours.' },
  { t: 'Set up your workspace', d: 'A guide takes you page by page: your AI systems, frameworks, connected systems, policies and registers. Stop and start whenever you like.' },
  { t: 'Meet your AIC assessor', d: 'An AIC assessor is assigned to your organisation as soon as you register, and is there when you are ready for assessment.' },
];

/**
 * The page a client onboarding link opens. It explains what happens and
 * sends them into registration with what AIC already knows filled in.
 */
export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const l = await publicLink(token);
  const open = l?.state === 'open';
  const who = l?.contactName?.split(' ')[0];

  if (!open) {
    return (
      <JoinFrame title="This link can no longer be used" subtitle={!l ? 'We could not find it. Check that the whole link was copied.' : l.state === 'used' ? 'It has already been used to register an organisation. If that was you, sign in instead.' : l.state === 'expired' ? 'It has expired. Ask your contact at AIC for a new one, or register directly.' : 'It was withdrawn. Ask your contact at AIC for a new one, or register directly.'}>
        <div className="flex flex-wrap gap-3">
          <Link href="/login" className="inline-flex h-11 items-center rounded-full bg-[#0e1b2c] px-5 text-[14px] font-medium text-white hover:bg-[#22344a]">Sign in</Link>
          <Link href="/signup" className="inline-flex h-11 items-center rounded-full border border-[#dde2e8] bg-white px-5 text-[14px] font-medium text-[#0e1b2c] hover:border-[#a8772a]">Register directly</Link>
        </div>
      </JoinFrame>
    );
  }

  const qs = new URLSearchParams({ invite: token, ...(l.orgName ? { organisation: l.orgName } : {}) });
  return (
    <JoinFrame
      title={who ? `Welcome, ${who}` : 'Welcome to AIC'}
      subtitle={<>AIC has set up onboarding{l.orgName ? <> for <span className="font-semibold text-[#0e1b2c]">{l.orgName}</span></> : null}. Here is what happens next.</>}
    >
      <ol className="space-y-3">
        {STEPS.map((s, i) => (
          <li key={s.t} className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0e1b2c] text-[13px] font-semibold text-white">{i + 1}</span>
            <span><span className="block text-[15px] font-semibold text-[#0e1b2c]">{s.t}</span><span className="block text-[13.5px] leading-relaxed text-[#5e6b7b]">{s.d}</span></span>
          </li>
        ))}
      </ol>
      <Link href={`/signup?${qs}`} className="mt-6 flex h-12 w-full items-center justify-center rounded-full bg-[#0e1b2c] text-[15px] font-medium text-white hover:bg-[#22344a]">Start registration</Link>
      <p className="mt-3 text-center text-[13px] text-[#5e6b7b]">Already registered? <Link href="/login" className="font-medium text-[#0e1b2c] underline decoration-[#a8772a] underline-offset-2">Sign in</Link></p>
      <p className="mt-5 text-[12px] leading-relaxed text-[#8a95a3]">This link is valid until {new Date(l.expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}. Registering does not commit you to certification.</p>
    </JoinFrame>
  );
}
