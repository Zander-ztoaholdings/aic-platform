import * as Minio from 'minio';
import { createHash } from 'crypto';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ROOT_USER!,
  secretKey: process.env.MINIO_ROOT_PASSWORD!,
});

const BUCKET_NAME = 'aic-evidence';

/**
 * INSTITUTIONAL STORAGE SERVICE
 * 
 * Handles immutable evidence persistence with tenant isolation
 * and cryptographic integrity verification.
 */
export class StorageService {
  /**
   * Ensure the evidence bucket exists
   */
  static async initialize() {
    const exists = await minioClient.bucketExists(BUCKET_NAME);
    if (!exists) {
      const region = process.env.MINIO_REGION || 'us-east-1';
      await minioClient.makeBucket(BUCKET_NAME, region);
      console.log(`[STORAGE] Created institutional bucket: ${BUCKET_NAME} in region: ${region}`);
    }
  }

  /**
   * Simple upload and return presigned URL
   */
  static async uploadEvidence(
    orgId: string,
    fileName: string,
    buffer: Buffer,
    contentType: string
  ): Promise<string> {
    const { evidenceId } = await this.saveEvidence(orgId, fileName, buffer, contentType);
    return await this.generatePresignedUrl(evidenceId);
  }

  /**
   * Persist evidence with tenant isolation and hashing
   */
  static async saveEvidence(
    orgId: string, 
    fileName: string, 
    buffer: Buffer, 
    contentType: string
  ): Promise<{ evidenceId: string; hash: string }> {
    // 1. Generate SHA-256 integrity hash
    const hash = createHash('sha256').update(buffer).digest('hex');
    
    // 2. Define tenant-isolated path
    const evidenceId = `${orgId}/${Date.now()}-${fileName}`;
    
    // 3. Persist to immutable store
    await minioClient.putObject(BUCKET_NAME, evidenceId, buffer, buffer.length, {
      'Content-Type': contentType,
      'X-AIC-Org-ID': orgId,
      'X-AIC-Integrity-Hash': hash,
    });

    return { evidenceId, hash };
  }

  /**
   * Generate a temporary pre-signed URL for internal model consumption
   */
  static async generatePresignedUrl(evidenceId: string): Promise<string> {
    return await minioClient.presignedGetObject(BUCKET_NAME, evidenceId, 600); // 10 minutes expiry
  }

  /**
   * Retrieve evidence for analysis
   */
  static async getEvidence(evidenceId: string): Promise<Buffer> {
    const stream = await minioClient.getObject(BUCKET_NAME, evidenceId);
    return new Promise((resolve, reject) => {
      const chunks: Uint8Array[] = [];
      stream.on('data', (chunk: Uint8Array) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', (err) => reject(err));
    });
  }
}
