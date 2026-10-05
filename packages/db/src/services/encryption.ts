import { createCipheriv, createDecipheriv, randomBytes, scryptSync, createHash } from 'crypto';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

/**
 * Field-level encryption (AES-256-GCM) for stored secrets: provider admin
 * keys, MFA secrets, exam content.
 *
 * VERSION 2 (Oct 2026), and why.
 *
 * Version 1 derived its key with scrypt(ENCRYPTION_KEY, 'salt') — a fixed,
 * public salt — and fell back to a key of 32 zero bytes when ENCRYPTION_KEY
 * was unset outside production. Ciphertexts carried no key identifier, so a
 * key could never be rotated without decrypting everything under the old one
 * in a single step nobody had written.
 *
 * Version 2:
 *   - Keys are 32 random bytes, given as 64 hex characters or base64.
 *     A passphrase still works but is stretched with a salt derived from the
 *     passphrase itself, and logs a warning asking for a proper key.
 *   - Ciphertext is `v2:<keyId>:<iv>:<tag>:<data>`, so several keys can be
 *     live at once. ENCRYPTION_KEYS="2026b:<key>,2026a:<key>" — the first is
 *     used to encrypt, all are tried to decrypt. ENCRYPTION_KEY alone is
 *     treated as a single key with id "k1".
 *   - Version 1 ciphertexts (iv:tag:data) still decrypt, with the version 1
 *     derivation, until scripts/reencrypt.ts has rewritten them.
 *   - There is no zero-key fallback. Without a key, encrypting throws.
 */

const ALGORITHM = 'aes-256-gcm';
type Key = { id: string; key: Buffer };

let warned = false;

function parseKey(raw: string): Buffer {
  const v = raw.trim();
  if (/^[0-9a-f]{64}$/i.test(v)) return Buffer.from(v, 'hex');
  const b = Buffer.from(v, 'base64');
  if (b.length === 32 && /^[A-Za-z0-9+/=_-]+$/.test(v)) return b;
  if (!warned) {
    warned = true;
    console.warn('[SECURITY] ENCRYPTION_KEY is a passphrase, not 32 random bytes. Generate one with `openssl rand -hex 32`.');
  }
  const salt = createHash('sha256').update(`aic-encryption-v2:${v}`).digest();
  return scryptSync(v, salt, 32);
}

function keys(): Key[] {
  const list = process.env.ENCRYPTION_KEYS;
  if (list) {
    return list.split(',').map((pair) => {
      const i = pair.indexOf(':');
      if (i < 1) throw new Error('[SECURITY] ENCRYPTION_KEYS must look like "id:key,id:key".');
      return { id: pair.slice(0, i).trim(), key: parseKey(pair.slice(i + 1)) };
    });
  }
  if (process.env.ENCRYPTION_KEY) return [{ id: 'k1', key: parseKey(process.env.ENCRYPTION_KEY) }];
  return [];
}

/** Version 1 derivation, kept only to read what version 1 wrote. */
function legacyKey(): Buffer | null {
  const pass = process.env.ENCRYPTION_KEY_LEGACY || process.env.ENCRYPTION_KEY;
  return pass ? scryptSync(pass, 'salt', 32) : Buffer.alloc(32, 0);
}

const UNREADABLE = '[ENCRYPTED_DATA_UNREADABLE]';

export class EncryptionService {
  static readonly UNREADABLE = UNREADABLE;

  /** Encrypt with the current key. Throws if no key is configured. */
  static encrypt(text: string): string {
    const [current] = keys();
    if (!current) throw new Error('[SECURITY] No ENCRYPTION_KEY or ENCRYPTION_KEYS configured; refusing to store a secret.');
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, current.key, iv);
    const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return ['v2', current.id, iv.toString('base64url'), tag.toString('base64url'), data.toString('base64url')].join(':');
  }

  /** Decrypt either version. Returns UNREADABLE (never throws) if it cannot. */
  static decrypt(value: string | null | undefined): string {
    if (!value) return '';
    try {
      if (value.startsWith('v2:')) {
        const [, id, iv, tag, data] = value.split(':');
        const k = keys().find((x) => x.id === id);
        if (!k) throw new Error(`no key with id ${id}`);
        const d = createDecipheriv(ALGORITHM, k.key, Buffer.from(iv, 'base64url'));
        d.setAuthTag(Buffer.from(tag, 'base64url'));
        return Buffer.concat([d.update(Buffer.from(data, 'base64url')), d.final()]).toString('utf8');
      }
      const [ivHex, tagHex, dataHex] = value.split(':');
      const d = createDecipheriv(ALGORITHM, legacyKey()!, Buffer.from(ivHex, 'hex'));
      d.setAuthTag(Buffer.from(tagHex, 'hex'));
      let out = d.update(dataHex, 'hex', 'utf8');
      out += d.final('utf8');
      return out;
    } catch {
      console.error('[SECURITY] Decryption failed. Possible key mismatch or data corruption.');
      return UNREADABLE;
    }
  }

  /** Is this value ciphertext AIC wrote (either version), rather than plain text? */
  static isEncrypted(value: string | null | undefined): boolean {
    if (!value) return false;
    return value.startsWith('v2:') || /^[0-9a-f]{32}:[0-9a-f]{32}:[0-9a-f]+$/i.test(value);
  }

  /** For columns that held plain text before they were encrypted (MFA secrets). */
  static decryptOrPlain(value: string | null | undefined): string {
    if (!value) return '';
    return this.isEncrypted(value) ? this.decrypt(value) : value;
  }

  /** Already under the current key, so a re-encryption pass can skip it. */
  static isCurrent(value: string | null | undefined): boolean {
    const [current] = keys();
    return !!value && !!current && value.startsWith(`v2:${current.id}:`);
  }
}
