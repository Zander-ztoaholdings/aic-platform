import { issueToken, TOKEN_TTL } from './auth-tokens';
import { sendEmail, type SendResult } from './email';
import { appUrl } from './app-url';

/**
 * Email verification. Not a sign-in gate — a new organisation can start work
 * immediately — but anything AIC publishes about an organisation on the
 * strength of what one person said (an AIC Aware badge) waits until that
 * person has shown they control the address they registered with.
 */
export async function sendVerificationEmail(userId: string, email: string, name?: string | null): Promise<SendResult> {
  // Other outstanding links (an invite, a reset) stay valid: verification is
  // additive and should not cancel them.
  const token = await issueToken(userId, TOKEN_TTL.verify, { revokePrevious: false });
  return sendEmail({
    to: email,
    subject: 'Confirm your email for AIC',
    paragraphs: [
      `Hello${name ? ` ${name.split(' ')[0]}` : ''},`,
      'Please confirm this is your email address. It keeps your account recoverable, and it is needed before AIC issues anything public in your organisation’s name, such as an AIC Aware badge.',
    ],
    action: { label: 'Confirm my email', url: `${appUrl()}/verify-email?token=${token}` },
    footnote: 'The link expires in 48 hours. If you did not create an AIC account, you can ignore this email.',
  });
}
