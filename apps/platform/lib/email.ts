/**
 * Transactional email, through Resend's HTTP API (no SDK: one POST).
 *
 * Nothing on the platform sent email before this. Invites and password resets
 * wrote their links to the server log and nowhere else, so an invited
 * colleague never heard about it and "forgot password" told people a link had
 * been sent when none had. That also put live credentials-equivalent links in
 * the logs; this module never logs a link in production.
 *
 * Configuration: RESEND_API_KEY, and EMAIL_FROM (defaults to
 * "AIC <no-reply@aiccertified.cloud>" — the domain must be verified in Resend).
 */

export interface EmailMessage {
  to: string;
  subject: string;
  /** Plain paragraphs. Rendered to both text and a simple, branded HTML. */
  paragraphs: string[];
  action?: { label: string; url: string };
  footnote?: string;
  /** Where replies go, e.g. the AIC person who sent it, so the recipient can check with a human. */
  replyTo?: string;
}

export interface SendResult {
  sent: boolean;
  reason?: 'not-configured' | 'provider-error';
}

const DEFAULT_FROM = 'AIC <no-reply@aiccertified.cloud>';

function escape(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function renderEmail(msg: EmailMessage): { html: string; text: string } {
  const text = [
    ...msg.paragraphs,
    ...(msg.action ? [`${msg.action.label}: ${msg.action.url}`] : []),
    ...(msg.footnote ? ['', msg.footnote] : []),
    '',
    'AI Integrity Certification · aiccertified.cloud',
  ].join('\n\n');

  const p = (t: string) =>
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151">${escape(t)}</p>`;
  const button = msg.action
    ? `<p style="margin:28px 0"><a href="${escape(msg.action.url)}" style="display:inline-block;background:#0A1728;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 22px;border-radius:999px">${escape(msg.action.label)}</a></p>
       <p style="margin:0 0 16px;font-size:12px;line-height:1.5;color:#9ca3af">Or paste this into your browser:<br><span style="color:#6b7280;word-break:break-all">${escape(msg.action.url)}</span></p>`
    : '';
  const foot = msg.footnote ? `<p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#9ca3af">${escape(msg.footnote)}</p>` : '';

  const html = `<!doctype html><html><body style="margin:0;background:#f4f5f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:20px;padding:36px 32px">
<tr><td>
<div style="font-family:Georgia,serif;font-size:20px;font-weight:700;color:#0A1728;margin-bottom:28px">AIC<span style="color:#c9920a">.</span></div>
${msg.paragraphs.map(p).join('')}
${button}
${foot}
</td></tr></table>
<p style="font-size:11px;color:#9ca3af;margin-top:20px">AI Integrity Certification · aiccertified.cloud</p>
</td></tr></table></body></html>`;

  return { html, text };
}

export async function sendEmail(msg: EmailMessage): Promise<SendResult> {
  const env = process.env;
  const key = env['RESEND_API_KEY'];
  if (!key) {
    if (env.NODE_ENV !== 'production') {
      // Development only: the link is the whole point of the email.
      console.info(`[EMAIL:dev] to=${msg.to} subject="${msg.subject}"${msg.action ? ` link=${msg.action.url}` : ''}`);
    } else {
      console.error(`[EMAIL] RESEND_API_KEY is not set; "${msg.subject}" to ${msg.to} was not sent.`);
    }
    return { sent: false, reason: 'not-configured' };
  }

  const { html, text } = renderEmail(msg);
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env['EMAIL_FROM'] || DEFAULT_FROM, to: [msg.to], subject: msg.subject, html, text, ...(msg.replyTo ? { reply_to: msg.replyTo } : {}) }),
    });
    if (!res.ok) {
      console.error(`[EMAIL] Resend refused "${msg.subject}" to ${msg.to}: ${res.status} ${await res.text().catch(() => '')}`);
      return { sent: false, reason: 'provider-error' };
    }
    return { sent: true };
  } catch (error) {
    console.error(`[EMAIL] Could not reach Resend for "${msg.subject}" to ${msg.to}:`, error);
    return { sent: false, reason: 'provider-error' };
  }
}
