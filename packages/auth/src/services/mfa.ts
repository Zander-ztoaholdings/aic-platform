import crypto from 'crypto';

/**
 * Institutional MFA Service
 * Manual implementation of TOTP (RFC 6238) to ensure zero-dependency reliability.
 */
export class MFAService {
  /**
   * Generates a random base32 secret for TOTP.
   */
  static generateSecret(length = 20): string {
    const randomBuffer = crypto.randomBytes(length);
    return this.base32Encode(randomBuffer);
  }

  /**
   * Verifies a TOTP token against a secret.
   * Allows for a 1-step window (30 seconds) of clock drift.
   */
  static verifyToken(secret: string, token: string): boolean {
    const decodedSecret = this.base32Decode(secret);
    const counter = Math.floor(Date.now() / 30000);

    // Check current, previous, and next window for drift resilience
    for (let i = -1; i <= 1; i++) {
      if (this.generateTOTP(decodedSecret, counter + i) === token) {
        return true;
      }
    }
    return false;
  }

  /**
   * Generates the otpauth:// URI for QR code generation.
   */
  static getOTPAuthURI(secret: string, accountName: string, issuer = 'AIC Platform'): string {
    return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&digits=6&period=30`;
  }

  private static generateTOTP(secret: Buffer, counter: number): string {
    const counterBuffer = Buffer.alloc(8);
    // Write counter as big-endian 64-bit integer
    for (let i = 7; i >= 0; i--) {
      counterBuffer[i] = counter & 0xff;
      counter = counter >> 8;
    }

    const hmac = crypto.createHmac('sha1', secret);
    hmac.update(counterBuffer);
    const hmacResult = hmac.digest();

    const offset = hmacResult[hmacResult.length - 1] & 0xf;
    const code = (
      ((hmacResult[offset] & 0x7f) << 24) |
      ((hmacResult[offset + 1] & 0xff) << 16) |
      ((hmacResult[offset + 2] & 0xff) << 8) |
      (hmacResult[offset + 3] & 0xff)
    ) % 1000000;

    return code.toString().padStart(6, '0');
  }

  private static base32Encode(buffer: Buffer): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0;
    let value = 0;
    let output = '';

    for (let i = 0; i < buffer.length; i++) {
      value = (value << 8) | buffer[i];
      bits += 8;
      while (bits >= 5) {
        output += alphabet[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }
    if (bits > 0) {
      output += alphabet[(value << (5 - bits)) & 31];
    }
    return output;
  }

  private static base32Decode(base32: string): Buffer {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const cleaned = base32.toUpperCase().replace(/=+$/, '');
    const length = cleaned.length;
    const buffer = Buffer.alloc(Math.floor((length * 5) / 8));
    
    let bits = 0;
    let value = 0;
    let index = 0;

    for (let i = 0; i < length; i++) {
      const charValue = alphabet.indexOf(cleaned[i]);
      if (charValue === -1) throw new Error('Invalid base32 character');
      
      value = (value << 5) | charValue;
      bits += 5;
      
      if (bits >= 8) {
        buffer[index++] = (value >>> (bits - 8)) & 255;
        bits -= 8;
      }
    }
    return buffer;
  }
}
