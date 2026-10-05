import { createHash } from 'crypto';

/** SHA-256 over a published policy version's title and body — the fingerprint shown beside each version. */
export const bodyHash = (title: string, body: string) =>
  createHash('sha256').update(`${title}\n\n${body}`).digest('hex');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Route ids reach Postgres as uuid; anything else is simply "not found". */
export const isUuid = (v: string) => UUID.test(v);
