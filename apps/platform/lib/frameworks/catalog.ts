/**
 * The frameworks AIC maps evidence to.
 *
 * Each framework is a list of its requirements (clauses, criteria, controls or
 * articles, whatever the framework calls them), and each requirement names the
 * common controls (lib/common-controls.ts) that usually support it. Evidence
 * is collected once, against the common controls, and every framework reads
 * from it. That is how one MFA check counts for SOC 2 CC6.1, ISO 27001 A.8.5
 * and HIPAA 164.312(d) at the same time.
 *
 * The data files were compiled in October 2026 from the publishers' own
 * documents where they are public, listed in each file's `sources`. Titles are
 * short headings or paraphrases, not the standard's text: several of these
 * standards are copyrighted and licensed per reader. A requirement with no
 * common controls is shown as "not mapped" rather than quietly dropped, so a
 * reader can see what AIC does not cover.
 *
 * A mapping says "this kind of evidence usually supports this requirement".
 * It is not an auditor's conclusion, and the pages say so.
 */
import popia from './data/popia.json';
import soc2 from './data/soc2.json';
import iso27001 from './data/iso27001.json';
import gdpr from './data/gdpr.json';
import hipaa from './data/hipaa.json';
import hitrust from './data/hitrust.json';
import usdp from './data/usdp.json';
import nistAiRmf from './data/nist_ai_rmf.json';
import iso42001 from './data/iso42001.json';
import cmmc from './data/cmmc.json';
import cjis from './data/cjis.json';
import nis2 from './data/nis2.json';
import dora from './data/dora.json';
import cps234 from './data/cps234.json';
import euAiAct from './data/eu_ai_act.json';
import essentialEight from './data/essential_eight.json';
import cyberEssentials from './data/cyber_essentials.json';
import fedramp from './data/fedramp.json';
import cri from './data/cri.json';
import nistCsf from './data/nist_csf.json';

export type CatalogueRequirement = { id: string; title: string; controls: string[] };

export type CatalogueFramework = {
  key: string;
  name: string;
  fullName: string;
  publisher: string;
  version: string;
  region: string;
  appliesTo: string;
  note: string;
  sources: string[];
  requirements: CatalogueRequirement[];
};

/** Broad grouping for the catalogue page. */
export type FrameworkGroup = 'ai' | 'security' | 'privacy' | 'sector' | 'government';

const GROUP: Record<string, FrameworkGroup> = {
  popia: 'privacy', gdpr: 'privacy', usdp: 'privacy', hipaa: 'sector',
  soc2: 'security', iso27001: 'security', nist_csf: 'security', cyber_essentials: 'security', essential_eight: 'security',
  iso42001: 'ai', eu_ai_act: 'ai', nist_ai_rmf: 'ai',
  hitrust: 'sector', dora: 'sector', cps234: 'sector', cri: 'sector', nis2: 'sector',
  cmmc: 'government', cjis: 'government', fedramp: 'government',
};

export const GROUP_LABEL: Record<FrameworkGroup, string> = {
  ai: 'AI governance',
  security: 'Information security',
  privacy: 'Privacy',
  sector: 'Sector and regional',
  government: 'Government',
};

/** In the order the catalogue shows them: home market first, then broadly as Vanta lists them. */
export const CATALOGUE: (CatalogueFramework & { group: FrameworkGroup })[] = [
  popia, soc2, iso27001, gdpr, hipaa, hitrust, usdp, nistAiRmf, iso42001, cmmc, cjis, nis2, dora, cps234, euAiAct,
  essentialEight, cyberEssentials, fedramp, cri, nistCsf,
].map((f) => ({ ...(f as CatalogueFramework), group: GROUP[(f as CatalogueFramework).key] ?? 'sector' }));

export const CATALOGUE_BY_KEY: Record<string, (typeof CATALOGUE)[number]> = Object.fromEntries(CATALOGUE.map((f) => [f.key, f]));

/** What an organisation sees until it chooses for itself: the frameworks AIC showed before the catalogue existed. */
export const DEFAULT_SELECTION = ['popia', 'iso42001', 'eu_ai_act', 'iso27001'];

/** Custom frameworks are addressed as `custom:<uuid>`. */
export const customKey = (id: string) => `custom:${id}`;
export const isCatalogueKey = (k: string) => k in CATALOGUE_BY_KEY;
