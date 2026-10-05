import type { integrations } from '@aic/db';
import type { Account } from '../registers/accounts';

/** Accounts from a connector-based integration (filled in as connectors are added). */
export async function connectorAccounts(_i: typeof integrations.$inferSelect): Promise<Account[] | null> {
  return null;
}
