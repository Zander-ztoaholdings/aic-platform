import { NextResponse } from 'next/server';
import { auth } from '@aic/auth';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Mocking ISO 17024 data for the prototype
  return NextResponse.json({
    cpd: {
      progress: 65,
      hoursEarned: 26,
      hoursRequired: 40,
      status: 'COMPLIANT',
      cycle: 'Jan 2026 - Dec 2026'
    },
    exams: [
      { id: '1', name: 'ISO 42001 Lead Implementation', status: 'LOCKED', requirement: 'Complete AIMS module' },
      { id: '2', name: 'Algorithmic Fairness & Bias Ethics', status: 'AVAILABLE', requirement: 'None' },
      { id: '3', name: 'POPIA Section 71 Advanced Auditor', status: 'COMPLETED', date: 'Feb 12, 2026' },
    ],
    identity: {
      level: 'LEVEL 2 AUDITOR',
      licenseNumber: 'AIC-ZA-2026-0042',
      validUntil: 'Dec 31, 2026'
    }
  });
}
