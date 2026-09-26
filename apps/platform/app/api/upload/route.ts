import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { requireOrgCapability } from '@/lib/guard';
import { canManageCompliance } from '@/lib/roles';

const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_EXT = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'ppt', 'pptx', 'txt', 'md', 'json',
  'png', 'jpg', 'jpeg', 'webp', 'zip',
]);

function getS3Client(): S3Client | null {
  if (!process.env.MINIO_ENDPOINT) return null;
  return new S3Client({
    endpoint: process.env.MINIO_ENDPOINT,
    region: process.env.MINIO_REGION ?? 'us-east-1',
    credentials: {
      accessKeyId: process.env.MINIO_ACCESS_KEY ?? '',
      secretAccessKey: process.env.MINIO_SECRET_KEY ?? '',
    },
    forcePathStyle: true,
  });
}

export async function POST(request: NextRequest) {
  try {
    const session: any = await getSession();
    if (!session || !session.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const refusal = requireOrgCapability(session?.user?.role, canManageCompliance, 'upload evidence');
    if (refusal) return refusal;

    const data = await request.formData();
    const file: File | null = data.get('file') as unknown as File;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ success: false, error: 'File is larger than 25 MB.' }, { status: 413 });
    }
    // The extension comes from the client. Allowlisted so a file named
    // "x.html" cannot be stored as HTML and later served from this origin.
    const ext = (file.name.split('.').pop() ?? '').toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      return NextResponse.json(
        { success: false, error: `Files of type .${ext || '?'} are not accepted as evidence.` },
        { status: 415 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filename = `${uuidv4()}.${ext}`;

    const s3 = getS3Client();
    if (s3) {
      const bucket = process.env.MINIO_BUCKET ?? 'aic-evidence';
      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: `evidence/${session.user.orgId}/${filename}`,
        Body: buffer,
        ContentType: file.type || 'application/octet-stream',
      }));
      const url = `${process.env.MINIO_ENDPOINT}/${bucket}/evidence/${session.user.orgId}/${filename}`;
      return NextResponse.json({ success: true, url });
    }

    // No object storage configured. This used to write the file into
    // public/uploads — served to anyone, without a session, at a guessable
    // path — and in the standalone production build that directory is not
    // served at all, so the upload "succeeded" and the evidence was lost.
    // Client evidence goes to private storage or nowhere.
    console.error('[UPLOAD] MINIO_ENDPOINT is not set; refusing to store evidence on local disk.');
    return NextResponse.json(
      { success: false, error: 'Evidence storage is not configured. Please contact AIC support.' },
      { status: 503 }
    );
  } catch (error) {
    console.error('Upload Error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
