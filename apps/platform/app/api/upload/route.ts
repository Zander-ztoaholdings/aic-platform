import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { getSession } from '../../../lib/auth';
import { v4 as uuidv4 } from 'uuid';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

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

    const data = await request.formData();
    const file: File | null = data.get('file') as unknown as File;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = file.name.split('.').pop();
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

    // Local disk fallback
    const uploadsDir = join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadsDir, { recursive: true });
    await writeFile(join(uploadsDir, filename), buffer);
    return NextResponse.json({ success: true, url: `/uploads/${filename}` });
  } catch (error) {
    console.error('Upload Error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
