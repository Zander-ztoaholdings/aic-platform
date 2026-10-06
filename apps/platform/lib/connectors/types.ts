/**
 * Connectors: the systems AIC reads beyond GitHub, Microsoft 365 and the AI
 * providers (which have their own code in lib/integrations).
 *
 * Every connector is read-only. The organisation creates a read-only
 * credential in its own system (an API token, a service account, a client
 * id and secret), pastes it into AIC, and AIC stores it encrypted in
 * integrations.secret_ciphertext. Nothing is written back.
 *
 * A connector has two halves, kept in separate files so the browser never
 * loads the calling code:
 *   - its description (lib/connectors/catalog.ts): name, the fields to fill
 *     in, setup steps, and the checks it runs, each mapped to common controls;
 *   - its implementation (lib/connectors/providers/*.ts): `run` reads the
 *     system and returns check results; `accounts` lists who has an account,
 *     for access reviews and the leavers check; `people` lists employees,
 *     for HR systems.
 */
import type { CheckResult } from '../integrations/catalog';
import type { Account } from '../registers/accounts';

export type ConnectorCategory = 'cloud' | 'identity' | 'code' | 'ticketing' | 'comms' | 'hr' | 'endpoint' | 'security' | 'observability' | 'crm' | 'password';

export const CATEGORY_LABEL: Record<ConnectorCategory, string> = {
  cloud: 'Cloud', identity: 'Identity', code: 'Code', ticketing: 'Work tracking', comms: 'Communication', hr: 'HR and payroll',
  endpoint: 'Devices', security: 'Security', observability: 'Monitoring', crm: 'Sales', password: 'Passwords',
};

export type ConnectorField = {
  key: string;
  label: string;
  kind: 'text' | 'secret' | 'url' | 'select' | 'textarea';
  placeholder?: string;
  help?: string;
  options?: { value: string; label: string }[];
  optional?: boolean;
};

export type ConnectorCheckDef = {
  key: string;
  title: string;
  why: string;
  fix: string;
  /** Framework references, as in lib/integrations/catalog (verbatim control ids only). */
  controls: string[];
  /** Common control keys (lib/common-controls) this check is evidence for. */
  common: string[];
};

export type ConnectorDef = {
  key: string;
  name: string;
  category: ConnectorCategory;
  /** One sentence: what AIC reads, in plain words. */
  reads: string;
  /** Steps to create the read-only credential, in the provider's own words for menus. */
  setup: string[];
  fields: ConnectorField[];
  checks: ConnectorCheckDef[];
  /** Lists accounts for access reviews and the leavers check. */
  accounts?: boolean;
  /** Lists employees with start and end dates (HR systems). */
  people?: boolean;
  /** Plan or licence the provider requires for this, where it matters. */
  plan?: string;
  docs: string;
  /** Uses an existing connection rather than its own credential (Azure and Intune reuse Microsoft 365). */
  uses?: 'microsoft';
  /**
   * Whether the connector has been run against a live account. Built from the
   * provider's documentation until then; the page says so.
   */
  verified: boolean;
};

export type Credentials = Record<string, string>;

export type PersonRecord = {
  externalId: string;
  name: string;
  email: string | null;
  jobTitle: string | null;
  department: string | null;
  startDate: string | null;
  endDate: string | null;
};

export type RunContext = {
  /** Now, injectable for tests. */
  now: Date;
  /** Microsoft tenant id, for connectors that reuse the Microsoft 365 connection. */
  microsoftTenant?: string | null;
};

export type RunOutput = {
  results: CheckResult[];
  /** A label for the connection, e.g. the Okta domain or the AWS account id. */
  label?: string;
};

export type ConnectorImpl = {
  run(creds: Credentials, ctx: RunContext): Promise<RunOutput>;
  accounts?(creds: Credentials, ctx: RunContext): Promise<Account[]>;
  people?(creds: Credentials, ctx: RunContext): Promise<PersonRecord[]>;
};

export class ConnectorError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
