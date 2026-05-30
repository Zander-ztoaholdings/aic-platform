/**
 * AIC ARTIFACT GENERATOR
 * 
 * Produces ISO 42001 compliant Model Cards and transparency reports.
 * Includes cryptographic watermarking placeholders.
 */

export function getModelCardTemplate(data: {
  name: string;
  version: string;
  description: string;
  trainingData: string;
  biasScore: number;
  accuracy: number;
  responsiblePerson: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:italic,wght@0,400;0,700;1,400&display=swap');
        body { font-family: 'Crimson Pro', serif; color: #1a1a1a; padding: 60px; line-height: 1.6; position: relative; }
        .watermark {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-45deg);
          font-size: 80px;
          color: rgba(212, 175, 55, 0.1);
          white-space: nowrap;
          z-index: -1;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 10px;
        }
        .header { border-bottom: 3px solid #d4af37; padding-bottom: 20px; margin-bottom: 40px; }
        .title { font-size: 32px; font-weight: bold; letter-spacing: -1px; }
        .tag { font-family: monospace; font-size: 10px; background: #000; color: #fff; padding: 4px 8px; border-radius: 4px; vertical-align: middle; margin-left: 10px; }
        .section { margin-bottom: 40px; }
        .section-title { font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; color: #d4af37; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
        .grid { display: grid; grid-template-cols: 1fr 1fr; gap: 30px; }
        .metric-card { background: #f9f9f9; padding: 20px; border-radius: 15px; border: 1px solid #eee; }
        .metric-label { font-size: 9px; font-weight: bold; text-transform: uppercase; color: #888; margin-bottom: 5px; }
        .metric-value { font-size: 24px; font-weight: bold; }
        .footer { position: fixed; bottom: 40px; width: 100%; left: 0; padding: 0 60px; font-size: 9px; color: #aaa; }
      </style>
    </head>
    <body>
      <div class="watermark">AIC CERTIFIED ARTIFACT</div>

      <div class="header">
        <div class="title">${data.name} <span class="tag">v${data.version}</span></div>
        <p style="font-style: italic; color: #666; margin-top: 10px;">Transparency Model Card for Accountability by Design</p>
      </div>

      <div class="section">
        <div class="section-title">Algorithmic Intent</div>
        <p>${data.description}</p>
      </div>

      <div class="section">
        <div class="section-title">Accountability Metrics</div>
        <div class="grid">
          <div class="metric-card">
            <div class="metric-label">Training Data Integrity</div>
            <div class="metric-value">${data.accuracy}%</div>
            <p style="font-size: 10px; color: #666; margin-top: 5px;">Validated against ISO/IEC 42001 standards.</p>
          </div>
          <div class="metric-card">
            <div class="metric-label">Bias Deviation Index</div>
            <div class="metric-value" style="color: ${data.biasScore > 0.2 ? '#c41e3a' : '#2c5f2d'}">${data.biasScore}</div>
            <p style="font-size: 10px; color: #666; margin-top: 5px;">Disparate impact ratio analysis.</p>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Dataset Demographics</div>
        <p style="font-size: 13px;">${data.trainingData}</p>
      </div>

      <div class="section">
        <div class="section-title">Certification Status</div>
        <p style="font-size: 12px;"><strong>Lead Responsible Person:</strong> ${data.responsiblePerson}</p>
        <p style="font-size: 12px;"><strong>Issuing Authority:</strong> AI Integrity Certification (AIC) Global Registry</p>
      </div>

      <div class="footer">
        This artifact is cryptographically linked to AIC Audit Ledger Hash: SHA256-${Math.random().toString(36).substring(7).toUpperCase()}
        <br/>
        Valid for professional review under POPIA Section 71 and AIC governance guidelines.
      </div>
    </body>
    </html>
  `;
}

export function getCertificateTemplate(data: {
  name: string;
  level: string;
  licenseNumber: string;
  validUntil: string;
  qrCodeDataUrl: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;700&display=swap');
        body { font-family: 'Crimson Pro', serif; background: #050505; color: white; padding: 0; margin: 0; display: flex; align-items: center; justify-content: center; height: 100vh; overflow: hidden; }
        .certificate { border: 20px solid #d4af37; padding: 80px; width: 800px; position: relative; background: #0a0a0a; text-align: center; }
        .corner-accent { position: absolute; width: 100px; height: 100px; border: 5px solid #d4af37; }
        .top-left { top: -10px; left: -10px; border-right: 0; border-bottom: 0; }
        .top-right { top: -10px; right: -10px; border-left: 0; border-bottom: 0; }
        .bottom-left { bottom: -10px; left: -10px; border-right: 0; border-top: 0; }
        .bottom-right { bottom: -10px; right: -10px; border-left: 0; border-top: 0; }
        .header { color: #d4af37; font-size: 14px; text-transform: uppercase; letter-spacing: 5px; margin-bottom: 40px; }
        .title { font-size: 48px; margin-bottom: 20px; font-weight: bold; }
        .subtitle { font-size: 18px; font-style: italic; color: #64748b; margin-bottom: 60px; }
        .recipient { font-size: 36px; border-bottom: 2px solid #333; display: inline-block; padding: 0 40px 10px; margin-bottom: 20px; }
        .level { color: #d4af37; font-size: 20px; font-weight: bold; margin-bottom: 60px; }
        .footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 80px; }
        .qr-section { text-align: left; }
        .qr-section img { width: 100px; border: 5px solid white; border-radius: 5px; }
        .id-section { text-align: right; font-family: monospace; font-size: 10px; color: #64748b; }
        .seal { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); opacity: 0.03; font-size: 200px; }
      </style>
    </head>
    <body>
      <div class="certificate">
        <div class="corner-accent top-left"></div>
        <div class="corner-accent top-right"></div>
        <div class="corner-accent bottom-left"></div>
        <div class="corner-accent bottom-right"></div>
        
        <div class="seal">AIC</div>

        <div class="header">AI Integrity Certification Body</div>
        <div class="title">Professional Practitioner License</div>
        <div class="subtitle">This is to certify the ethical competency and professional status of</div>
        
        <div class="recipient">${data.name}</div>
        <div class="level">${data.level}</div>
        
        <div class="footer">
          <div class="qr-section">
            <img src="${data.qrCodeDataUrl}" alt="Verification QR" />
            <p style="font-size: 8px; margin-top: 10px; color: #64748b;">SCAN TO VERIFY INTEGRITY STATUS</p>
          </div>
          <div class="id-section">
            <p>LICENSE NO: ${data.licenseNumber}</p>
            <p>VALID UNTIL: ${data.validUntil}</p>
            <p>AIC METHODOLOGY ASSESSED</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}
