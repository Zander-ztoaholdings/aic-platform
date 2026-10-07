/**
 * The AI products AIC records use of, beyond API spend per model.
 *
 * API usage (tokens and cost per model) has its own table and pages. This is
 * the other half: the AI people use inside tools the organisation already
 * pays for, and the AI services running in its cloud accounts. Each product
 * is read by the connector for the system it lives in, with that vendor's own
 * reporting API, or imported from the vendor's admin export where no API
 * exists.
 *
 * Safe to import in the browser: descriptions only, no calling code.
 */

export type AiProduct =
  | 'claude_seats' | 'claude_code' | 'chatgpt_workspace' | 'm365_copilot' | 'github_copilot'
  | 'gemini_workspace' | 'aws_bedrock' | 'azure_openai' | 'vertex_ai';

export type AiProductDef = {
  key: AiProduct;
  name: string;
  vendor: string;
  /** Who or what each row is about. */
  subject: 'person' | 'model';
  /** What the activity number counts, in the plural. Empty when the vendor reports only a last-active date. */
  unit: string;
  /** Words that, in a declared system's name, show it covers this product. */
  keywords: string[];
  /** Where AIC reads it, in the client's words. */
  via: string;
};

export const AI_PRODUCTS: Record<AiProduct, AiProductDef> = {
  claude_seats: { key: 'claude_seats', name: 'Claude (Enterprise seats)', vendor: 'Anthropic', subject: 'person', unit: 'messages', keywords: ['claude'], via: 'Claude Enterprise analytics key' },
  claude_code: { key: 'claude_code', name: 'Claude Code', vendor: 'Anthropic', subject: 'person', unit: 'sessions', keywords: ['claude code', 'claude'], via: 'Anthropic admin key' },
  chatgpt_workspace: { key: 'chatgpt_workspace', name: 'ChatGPT workspace', vendor: 'OpenAI', subject: 'person', unit: 'messages', keywords: ['chatgpt', 'openai'], via: 'User export from ChatGPT workspace analytics' },
  m365_copilot: { key: 'm365_copilot', name: 'Microsoft 365 Copilot', vendor: 'Microsoft', subject: 'person', unit: '', keywords: ['m365 copilot', 'microsoft 365 copilot', 'microsoft copilot', 'copilot'], via: 'Microsoft 365 connection' },
  github_copilot: { key: 'github_copilot', name: 'GitHub Copilot', vendor: 'GitHub', subject: 'person', unit: '', keywords: ['github copilot', 'copilot'], via: 'GitHub connection' },
  gemini_workspace: { key: 'gemini_workspace', name: 'Gemini in Google Workspace', vendor: 'Google', subject: 'person', unit: 'actions', keywords: ['gemini'], via: 'Google Workspace connection' },
  aws_bedrock: { key: 'aws_bedrock', name: 'Amazon Bedrock', vendor: 'Amazon Web Services', subject: 'model', unit: 'requests', keywords: ['bedrock'], via: 'AWS connection' },
  azure_openai: { key: 'azure_openai', name: 'Azure OpenAI and AI Foundry', vendor: 'Microsoft Azure', subject: 'model', unit: 'requests', keywords: ['azure openai', 'ai foundry', 'foundry', 'azure ai'], via: 'Azure connection' },
  vertex_ai: { key: 'vertex_ai', name: 'Vertex AI', vendor: 'Google Cloud', subject: 'model', unit: 'requests', keywords: ['vertex', 'gemini'], via: 'Google Cloud connection' },
};

export const AI_PRODUCT_KEYS = Object.keys(AI_PRODUCTS) as AiProduct[];
export const isAiProduct = (v: unknown): v is AiProduct => typeof v === 'string' && v in AI_PRODUCTS;

/** Products that can be imported from a vendor's own export, because the vendor offers no API for them on every plan. */
export const IMPORTABLE: AiProduct[] = ['chatgpt_workspace', 'claude_seats'];

/**
 * One reading: a person's (or a model's) use of a product on one day.
 * `day` is the vendor's reporting day, YYYY-MM-DD. For vendors that report a
 * snapshot (a seat with a last-active date) it is the day AIC read it.
 */
export type AiUseRecord = {
  product: AiProduct;
  subjectType: 'person' | 'model';
  subject: string;
  displayName?: string | null;
  day: string;
  lastActiveAt?: string | null;
  activity: number;
  metrics?: Record<string, string | number | boolean | null>;
};

/** What a source returned: readings, and plain notes for anything it could not read (a permission not granted, a plan without the API). */
export type AiUseOutput = { records: AiUseRecord[]; notes: string[]; facts?: Record<string, number | string | null> };

export const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** A declared system covers a product when its name carries one of the product's words. */
export function declaredFor(product: AiProduct, systemNames: string[]): string | null {
  const kw = AI_PRODUCTS[product].keywords;
  return systemNames.find((n) => kw.some((k) => n.toLowerCase().includes(k))) ?? null;
}
