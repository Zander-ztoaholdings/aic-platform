import jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const PRIVATE_KEY = process.env.PLATFORM_PRIVATE_KEY?.replace(/\\n/g, '\n');
const PUBLIC_KEY = process.env.PLATFORM_PUBLIC_KEY?.replace(/\\n/g, '\n');

/**
 * INSTITUTIONAL SIGNING SERVICE
 * 
 * Manages asymmetric cryptographic signing for service-to-service 
 * communication. Enforces short-lived identity tokens.
 */
export class SigningService {
  /**
   * Generate an OIDC-compliant JWT for internal service calls
   */
  static async generateServiceToken(targetService: string, orgId?: string): Promise<string> {
    if (!PRIVATE_KEY) {
      console.warn("[SECURITY] Missing PLATFORM_PRIVATE_KEY. Falling back to insecure mode.");
      return "INSECURE_DEV_TOKEN";
    }

    return jwt.sign(
      { 
        iss: 'aic-platform',
        aud: targetService,
        orgId: orgId || 'SYSTEM',
      },
      PRIVATE_KEY,
      { 
        algorithm: 'RS256',
        expiresIn: '5m' // Extremely short-lived for security
      }
    );
  }

  /**
   * Verify a token from another internal service
   */
  static verifyServiceToken(token: string) {
    if (!PUBLIC_KEY) return null;
    try {
      return jwt.verify(token, PUBLIC_KEY, { algorithms: ['RS256'] });
    } catch {
      return null;
    }
  }
}
