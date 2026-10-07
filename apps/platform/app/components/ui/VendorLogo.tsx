'use client';

import { useState } from 'react';
import { LOGOS, LOCAL_LOGOS } from '@/lib/logos';

/**
 * A vendor's mark in a small white tile, for connector and AI product rows.
 *
 * Marks come from lib/logos (Simple Icons). For a vendor not carried there,
 * an official file in public/logos/<key>.svg (or .png), listed in LOCAL_LOGOS, is used;
 * otherwise the vendor's initials, so a row never shows a broken image.
 */
export function VendorLogo({ id, name, size = 40 }: { id: string; name: string; size?: number }) {
  const mark = LOGOS[id];
  const [failed, setFailed] = useState(false);
  const ext = failed ? null : LOCAL_LOGOS[id] ?? null;
  const inner = Math.round(size * 0.55);
  const tile = 'shrink-0 inline-flex items-center justify-center rounded-xl border border-[#dde2e8] bg-white';

  if (mark) {
    return (
      <span className={tile} style={{ width: size, height: size }} title={name}>
        <svg role="img" aria-label={`${name} logo`} viewBox="0 0 24 24" width={inner} height={inner} fill={mark.hex}>
          <path d={mark.path} />
        </svg>
      </span>
    );
  }
  if (ext) {
    return (
      <span className={tile} style={{ width: size, height: size }} title={name}>
        <img src={`/logos/${id}.${ext}`} alt={`${name} logo`} width={inner} height={inner} style={{ objectFit: 'contain', width: inner, height: inner }} onError={() => setFailed(true)} />
      </span>
    );
  }
  const initials = name.replace(/\(.*?\)/g, '').split(/[\s-]+/).filter((w) => /^[A-Za-z0-9]/.test(w)).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return (
    <span aria-hidden="true" className={`${tile} bg-[#f5f7f9] text-[#0e1b2c] font-semibold`} style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }} title={name}>
      {initials}
    </span>
  );
}
