/**
 * The option sets the signup wizard asks from, kept out of the component so
 * the questions can be reviewed as questions rather than read out of JSX.
 *
 * Two of these are not marketing questions. `AFFECTS_INDIVIDUALS` and
 * `SOLELY_AUTOMATED` are the two conditions POPIA Section 71 actually turns
 * on — a decision made solely by automated means that has legal consequences
 * for, or substantially affects, a data subject. Asking them at registration
 * means every organisation on the platform has said, in its own words and on
 * the record, whether it is inside Section 71 or not. "Not sure" is a
 * permitted answer because it is frequently the true one, and an organisation
 * that does not know is a more useful thing to know than a forced yes.
 */

export interface DivisionOption {
  value: number;
  label: string;
  tagline: string;
  who: string;
}

/** Mirrors lib/standard.ts DIVISIONS — modes of operation, not grades. */
export const DIVISIONS: DivisionOption[] = [
  {
    value: 1,
    label: 'Sovereign',
    tagline: 'We make decisions. Humans make them.',
    who: 'No AI is used in consequential decisions.',
  },
  {
    value: 2,
    label: 'Supervised',
    tagline: 'AI assists. Humans decide.',
    who: 'AI recommends; a named human makes every consequential decision.',
  },
  {
    value: 3,
    label: 'Reviewed',
    tagline: 'AI decides. Humans review patterns and cases.',
    who: 'AI makes operational decisions; humans review periodically and investigate flagged cases.',
  },
  {
    value: 4,
    label: 'Monitored',
    tagline: 'AI decides at scale. Humans monitor the system.',
    who: 'AI decides at volume; humans oversee aggregate behaviour rather than individual decisions.',
  },
  {
    value: 5,
    label: 'Artificial',
    tagline: 'We build what others decide with.',
    who: 'Builders and vendors, whose accountability runs upstream to their customers’ decisions.',
  },
];

/**
 * Jurisdiction matters more here than it would on most signup forms: POPIA is
 * South African law, and an organisation outside it is being assessed against
 * the same standard for a different reason. Southern Africa first, then the
 * markets AIC actually sees, then Other.
 */
export const COUNTRIES = [
  'South Africa',
  'Namibia',
  'Botswana',
  'Zimbabwe',
  'Zambia',
  'Mozambique',
  'Lesotho',
  'Eswatini',
  'Kenya',
  'Nigeria',
  'Ghana',
  'Rwanda',
  'Mauritius',
  'United Kingdom',
  'Ireland',
  'Netherlands',
  'Germany',
  'France',
  'Portugal',
  'Spain',
  'United Arab Emirates',
  'United States',
  'Canada',
  'Australia',
  'India',
  'Singapore',
  'Other',
];

/**
 * Sector decides which sectoral regulator sits alongside the Information
 * Regulator for this organisation — the FSCA, the Council for Medical
 * Schemes, the NCR and so on. It is not a demographic field.
 */
export const SECTORS = [
  'Financial services & banking',
  'Insurance',
  'Healthcare & medical schemes',
  'Education & training',
  'Retail & e-commerce',
  'Telecommunications',
  'Public sector & government',
  'Legal & professional services',
  'Mining & resources',
  'Manufacturing',
  'Logistics & transport',
  'Technology & software',
  'Media & publishing',
  'Energy & utilities',
  'Agriculture',
  'Property & construction',
  'Non-profit & NGO',
  'Other',
];

export const SIZE_BANDS = [
  '1–10 people',
  '11–50 people',
  '51–200 people',
  '201–1 000 people',
  '1 001–5 000 people',
  'More than 5 000 people',
];

export const AI_SYSTEM_BANDS = [
  'None yet',
  '1–3 systems',
  '4–10 systems',
  '11–50 systems',
  'More than 50',
];

/** Stored as the literal string, so a report never has to guess what a null meant. */
export const TRI_STATE = ['Yes', 'No', 'Not sure'];

export const REFERRAL_SOURCES = [
  'Search',
  'Referred by a client',
  'LinkedIn',
  'Event or workshop',
  'Regulator or industry body',
  'Press or article',
  'Insurer or broker',
  'Other',
];
