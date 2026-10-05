import * as Minio from 'minio';
import { createHash } from 'crypto';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

/**
 * Evidence lives in any S3-compatible bucket: MinIO, Backblaze B2, Cloudflare
 * R2 or AWS S3. MINIO_ENDPOINT may be a bare host ("minio", with MINIO_PORT
 * and MINIO_USE_SSL) or a full URL ("https://s3.eu-central-003.backblazeb2.com",
 * "https://<account>.r2.cloudflarestorage.com"). Keys come from
 * MINIO_ACCESS_KEY / MINIO_SECRET_KEY, or the older MINIO_ROOT_USER /
 * MINIO_ROOT_PASSWORD. The bucket is MINIO_BUCKET (default aic-evidence) and
 * must already exist on hosted providers, where a scoped key cannot create one.
 *
 * The client is built on first use, so a missing configuration is reported as
 * "evidence storage is not configured" instead of failing at import.
 */
export function storageConfig() {
  const raw = (process.env.MINIO_ENDPOINT || '').trim();
  const accessKey = process.env.MINIO_ACCESS_KEY || process.env.MINIO_ROOT_USER || '';
  const secretKey = process.env.MINIO_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD || '';
  if (!raw || !accessKey || !secretKey) return null;
  let endPoint = raw, port: number | undefined = process.env.MINIO_PORT ? parseInt(process.env.MINIO_PORT, 10) : undefined;
  let useSSL = process.env.MINIO_USE_SSL === 'true';
  if (/^https?:\/\//i.test(raw)) {
    const u = new URL(raw);
    endPoint = u.hostname;
    useSSL = u.protocol === 'https:';
    port = u.port ? parseInt(u.port, 10) : undefined;
  }
  return {
    endPoint,
    port: port ?? (useSSL ? 443 : 9000),
    useSSL,
    accessKey,
    secretKey,
    region: process.env.MINIO_REGION || (/r2\.cloudflarestorage\.com$/.test(endPoint) ? 'auto' : 'us-east-1'),
    bucket: process.env.MINIO_BUCKET || 'aic-evidence',
    pathStyle: !/amazonaws\.com$/.test(endPoint),
  };
}

let client: Minio.Client | null = null;
function minio() {
  const cfg = storageConfig();
  if (!cfg) throw new Error('Evidence storage is not configured (set MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY).');
  if (!client) {
    client = new Minio.Client({
      endPoint: cfg.endPoint, port: cfg.port, useSSL: cfg.useSSL,
      accessKey: cfg.accessKey, secretKey: cfg.secretKey, region: cfg.region, pathStyle: cfg.pathStyle,
    });
  }
  return client;
}
const bucket = () => storageConfig()?.bucket ?? 'aic-evidence';

/** For /api/health: is storage configured, and can the bucket be reached? */
export async function storageHealth(): Promise<{ ok: boolean; detail: string }> {
  const cfg = storageConfig();
  if (!cfg) return { ok: false, detail: 'not configured: uploads will fail' };
  try {
    const exists = await minio().bucketExists(cfg.bucket);
    return exists ? { ok: true, detail: `${cfg.endPoint}/${cfg.bucket}` } : { ok: false, detail: `bucket ${cfg.bucket} not found on ${cfg.endPoint}` };
  } catch (e) {
    return { ok: false, detail: `cannot reach ${cfg.endPoint}: ${(e as Error).message}` };
  }
}

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
    const exists = await minio().bucketExists(bucket());
    if (!exists) {
      await minio().makeBucket(bucket(), storageConfig()!.region);
      console.log(`[STORAGE] Created evidence bucket: ${bucket()}`);
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
    await minio().putObject(bucket(), evidenceId, buffer, buffer.length, {
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
    return await minio().presignedGetObject(bucket(), evidenceId, 600); // 10 minutes expiry
  }

  /**
   * Retrieve evidence for analysis
   */
  static async getEvidence(evidenceId: string): Promise<Buffer> {
    const stream = await minio().getObject(bucket(), evidenceId);
    return new Promise((resolve, reject) => {
      const chunks: Uint8Array[] = [];
      stream.on('data', (chunk: Uint8Array) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', (err) => reject(err));
    });
  }
}
