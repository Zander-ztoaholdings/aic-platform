import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 're_123');

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export class NotificationService {
  /**
   * Send a system-generated email notification.
   */
  static async sendEmail(options: EmailOptions) {
    if (!process.env.RESEND_API_KEY) {
      console.warn('[NOTIFICATIONS] Resend API key missing. Email logged to console.');
      console.log(`[EMAIL] To: ${options.to} | Subject: ${options.subject}`);
      return { success: true, id: 'mock_id' };
    }

    try {
      const { data, error } = await resend.emails.send({
        from: 'AIC Intelligence <alerts@aic-pulse.org>',
        to: options.to,
        subject: options.subject,
        html: options.html,
      });

      if (error) {
        console.error('[NOTIFICATIONS] Resend Error:', error);
        return { success: false, error };
      }

      return { success: true, id: data?.id };
    } catch (err) {
      console.error('[NOTIFICATIONS] Unexpected failure:', err);
      return { success: false, error: err };
    }
  }

  /**
   * Notify an institution of a critical bias drift alert.
   */
  static async notifyBiasAlert(email: string, orgName: string, modelName: string) {
    return this.sendEmail({
      to: email,
      subject: `[CRITICAL] Bias Drift Detected: ${modelName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; border: 1px solid #eee; padding: 40px; border-radius: 8px;">
          <h2 style="color: #D4AF37;">Institutional Intelligence Alert</h2>
          <p>Dear Administrator at <strong>${orgName}</strong>,</p>
          <p>Our autonomous monitoring engine has detected a significant statistical drift in your AI model: <strong>${modelName}</strong>.</p>
          <p>This drift exceeds the fairness bounds established during your last audit session. Immediate human intervention is recommended to maintain compliance status.</p>
          <div style="margin-top: 30px;">
            <a href="https://platform.aic-pulse.org/incidents" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Review Incident</a>
          </div>
          <p style="margin-top: 40px; color: #999; font-size: 12px;">This is an automated notification from the AIC Sovereign-Grade Governance Platform.</p>
        </div>
      `
    });
  }
}
