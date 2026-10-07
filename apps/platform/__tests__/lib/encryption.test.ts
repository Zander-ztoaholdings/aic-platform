// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { createCipheriv, randomBytes, scryptSync } from 'crypto';
import { EncryptionService } from '@aic/db';

const K1 = 'a'.repeat(64);
const K2 = 'b'.repeat(64);

function v1(text: string, pass: string) {
  const key = scryptSync(pass, 'salt', 32);
  const iv = randomBytes(16);
  const c = createCipheriv('aes-256-gcm', key, iv);
  let e = c.update(text, 'utf8', 'hex');
  e += c.final('hex');
  return `${iv.toString('hex')}:${c.getAuthTag().toString('hex')}:${e}`;
}

describe('encryption v2', () => {
  beforeEach(() => { delete process.env.ENCRYPTION_KEYS; process.env.ENCRYPTION_KEY = K1; });

  it('round-trips and labels the key', () => {
    const c = EncryptionService.encrypt('sk-admin-secret');
    expect(c.startsWith('v2:k1:')).toBe(true);
    expect(EncryptionService.decrypt(c)).toBe('sk-admin-secret');
    expect(EncryptionService.isCurrent(c)).toBe(true);
  });

  it('rotates: old ciphertext still reads, new writes use the new key', () => {
    const old = EncryptionService.encrypt('x');
    process.env.ENCRYPTION_KEYS = `k2:${K2},k1:${K1}`;
    expect(EncryptionService.decrypt(old)).toBe('x');
    expect(EncryptionService.isCurrent(old)).toBe(false);
    expect(EncryptionService.encrypt('y').startsWith('v2:k2:')).toBe(true);
  });

  it('reads version 1 written without a key after a key is set', () => {
    const zero = Buffer.alloc(32, 0);
    const iv = randomBytes(16);
    const c = createCipheriv('aes-256-gcm', zero, iv);
    const e = c.update('JBSWY3DPEHPK3PXP', 'utf8', 'hex') + c.final('hex');
    const stored = `${iv.toString('hex')}:${c.getAuthTag().toString('hex')}:${e}`;
    expect(EncryptionService.decryptOrPlain(stored)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('reads a plain-text MFA secret stored before encryption', () => {
    expect(EncryptionService.decryptOrPlain('JBSWY3DPEHPK3PXP')).toBe('JBSWY3DPEHPK3PXP');
  });

  it('still reads version 1 ciphertext', () => {
    process.env.ENCRYPTION_KEY = 'a passphrase';
    expect(EncryptionService.decrypt(v1('legacy', 'a passphrase'))).toBe('legacy');
  });

  it('refuses to encrypt with no key, and never decrypts with a wrong one', () => {
    const c = EncryptionService.encrypt('x');
    delete process.env.ENCRYPTION_KEY;
    expect(() => EncryptionService.encrypt('x')).toThrow(/No ENCRYPTION_KEY/);
    process.env.ENCRYPTION_KEY = K2;
    expect(EncryptionService.decrypt(c)).toBe(EncryptionService.UNREADABLE);
  });

  it('treats plain MFA secrets as plain', () => {
    expect(EncryptionService.decryptOrPlain('JBSWY3DPEHPK3PXP')).toBe('JBSWY3DPEHPK3PXP');
    expect(EncryptionService.decryptOrPlain(EncryptionService.encrypt('JBSWY3DPEHPK3PXP'))).toBe('JBSWY3DPEHPK3PXP');
  });
});
