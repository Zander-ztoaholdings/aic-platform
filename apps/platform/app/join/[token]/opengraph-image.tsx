import { ImageResponse } from 'next/og';
import { publicLink } from '@/lib/onboarding-links';

/**
 * The picture a client onboarding link shows when it is pasted into email,
 * WhatsApp, LinkedIn or Teams. Same card as the website's share images: navy
 * ground, white headline, brass rule. It names the organisation the link was
 * made for, which the page itself already shows to whoever holds the link,
 * and nothing else about it.
 */
export const runtime = 'nodejs';
export const alt = 'Start onboarding with AIC';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let org: string | null = null;
  let open = false;
  try {
    const l = await publicLink(token);
    open = l?.state === 'open';
    org = open ? (l?.orgName ?? null) : null;
  } catch { /* the card still renders without the name */ }

  const title = !open ? 'Start with AIC' : org ? `Onboarding for ${org}`.slice(0, 90) : 'Your onboarding with AIC';
  const fontSize = title.length > 60 ? 56 : title.length > 36 ? 66 : 76;

  return new ImageResponse(
    (
      <div style={{ background: '#0a1728', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '72px 80px', fontFamily: 'serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ display: 'flex', color: '#ffffff', fontSize: 34, fontWeight: 700, letterSpacing: 2 }}>AIC</div>
          <div style={{ display: 'flex', width: 10, height: 10, borderRadius: 10, background: '#c9920a' }} />
          <div style={{ display: 'flex', color: 'rgba(255,255,255,0.6)', fontSize: 24, fontFamily: 'sans-serif' }}>AI Integrity Certification</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', color: 'rgba(255,255,255,0.6)', fontSize: 26, marginBottom: 22, fontFamily: 'sans-serif' }}>{open ? 'Your invitation to register' : 'aiccertified.cloud'}</div>
          <div style={{ display: 'flex', color: '#ffffff', fontSize, fontWeight: 700, lineHeight: 1.1, maxWidth: 1040 }}>{title}</div>
          <div style={{ display: 'flex', color: 'rgba(255,255,255,0.7)', fontSize: 28, marginTop: 26, fontFamily: 'sans-serif', maxWidth: 980 }}>
            Register in about ten minutes, then set up your workspace with an AIC assessor alongside.
          </div>
        </div>
        <div style={{ display: 'flex', width: 120, height: 4, background: '#a8772a' }} />
      </div>
    ),
    size,
  );
}
