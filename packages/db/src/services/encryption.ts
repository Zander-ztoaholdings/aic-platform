import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY 
  ? scryptSync(process.env.ENCRYPTION_KEY, 'salt', 32) 
  : Buffer.alloc(32, 0); // FALLBACK FOR DEV ONLY

/**
 * INSTITUTIONAL ENCRYPTION SERVICE
 * 
 * Provides field-level encryption for PII (Personally Identifiable Information).
 * Uses AES-256-GCM for authenticated encryption.
 */
export class EncryptionService {
  /**
   * Encrypt a sensitive string
   */
  static encrypt(text: string): string {
    if (!process.env.ENCRYPTION_KEY && process.env.NODE_ENV === 'production') {
      throw new Error("[SECURITY] ENCRYPTION_KEY missing in production");
    }

    const iv = randomBytes(16);
    const cipher = createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().toString('hex');
    
    // Format: iv:authTag:encryptedData
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  /**
   * Decrypt a sensitive string
   */
  static decrypt(encryptedData: string | null | undefined): string {
    if (!encryptedData) return '';
    try {
      const [ivHex, authTagHex, encryptedText] = encryptedData.split(':');
      
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const decipher = createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
      
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch {
      console.error('[SECURITY] Decryption failed. Possible key mismatch or data corruption.');
      return '[ENCRYPTED_DATA_UNREADABLE]';
    }
  }
}
