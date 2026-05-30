import puppeteer from 'puppeteer';

export async function generatePDF(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  
  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: {
      top: '20px',
      right: '20px',
      bottom: '20px',
      left: '20px',
    },
  });

  await browser.close();
  return Buffer.from(pdf);
}

export function getReportTemplate(data: any): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Times New Roman', serif; color: #1a1a1a; padding: 40px; }
        .header { border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 40px; }
        .title { font-size: 24px; font-weight: bold; text-transform: uppercase; }
        .subtitle { font-size: 14px; color: #666; margin-top: 5px; }
        .section { margin-bottom: 30px; }
        .section-title { font-size: 18px; font-weight: bold; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-bottom: 15px; }
        .grid { display: grid; grid-template-cols: 1fr 1fr; gap: 20px; }
        .metric-box { border: 1px solid #eee; padding: 15px; border-radius: 8px; }
        .metric-label { font-size: 10px; color: #888; text-transform: uppercase; }
        .metric-value { font-size: 20px; font-weight: bold; }
        .footer { position: fixed; bottom: 20px; font-size: 10px; color: #aaa; text-align: center; width: 100%; }
        .compliant { color: #10b981; }
        .remediation { color: #f59e0b; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">AI Integrity Certification</div>
        <div class="subtitle">Official Compliance Report • ${data.monthYear}</div>
      </div>

      <div class="section">
        <div class="section-title">Institutional Profile</div>
        <div class="grid">
          <div>
            <p><strong>Organization:</strong> ${data.orgName}</p>
            <p><strong>ID:</strong> ${data.orgId}</p>
          </div>
          <div>
            <p><strong>Compliance Tier:</strong> ${data.tier}</p>
            <p><strong>Status:</strong> <span class="${data.auditStatus === 'COMPLIANT' ? 'compliant' : 'remediation'}">${data.auditStatus}</span></p>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Integrity Intelligence</div>
        <div class="grid">
          <div class="metric-box">
            <div class="metric-label">Composite Integrity Score</div>
            <div class="metric-value">${data.integrityScore}%</div>
          </div>
          <div class="metric-box">
            <div class="metric-label">Active Incidents</div>
            <div class="metric-value">${data.findingsCount}</div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">POPIA Section 71 Attestation</div>
        <p style="font-size: 12px; line-height: 1.6;">
          This document serves as technical evidence of institutional adherence to South African Algorithmic Rights. 
          The integrity score reflects real-time telemetry from registered AI decision systems, verified against 
          AIC technical standards for human agency, explainability, and empathy.
        </p>
      </div>

      <div class="footer">
        © 2026 AI Integrity Certification • Generated securely on ${new Date().toUTCString()} • Hash: ${data.id?.substring(0,8)}
      </div>
    </body>
    </html>
  `;
}
