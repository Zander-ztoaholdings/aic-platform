import { NextResponse } from 'next/server';
import { auth } from '@aic/auth';
import { getSystemDb, users, eq } from '@aic/db';
import { checkRateLimit } from '@/lib/rate-limit';
import { sendVerificationEmail } from '@/lib/verification';

/** Send (another) verification link to the signed-in user's address. */
export async function POST() {
  const session = await auth();
  const userId = session?.user?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await checkRateLimit(`verify-resend:${userId}`, 3, 60 * 60_000)).allowed) {
    return NextResponse.json({ error: 'A link was sent recently. Please check your inbox, or try again in an hour.' }, { status: 429 });
  }

  const [user] = await getSystemDb()
    .select({ email: users.email, name: users.name, emailVerified: users.emailVerified })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.emailVerified) return NextResponse.json({ success: true, alreadyVerified: true });

  const r = await sendVerificationEmail(userId, user.email, user.name);
  if (!r.sent) return NextResponse.json({ error: 'The email could not be sent. Please try again later.' }, { status: 503 });
  return NextResponse.json({ success: true, message: `A verification link is on its way to ${user.email}.` });
}
