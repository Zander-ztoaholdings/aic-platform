import { jsPDF } from 'jspdf';

export async function generateCertificatePDF(data: {
    orgName: string;
    tier: string;
    orgId: string;
    issuedDate: string;
    expiryDate: string;
}) {
    const doc = new jsPDF({
        orientation: 'l', // Landscape for certificates
        unit: 'mm',
        format: 'a4'
    });

    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();

    // 1. Background / Border
    doc.setFillColor(250, 249, 246); // Gallery White
    doc.rect(0, 0, width, height, 'F');
    
    // Double Border
    doc.setDrawColor(212, 175, 55); // AIC Gold
    doc.setLineWidth(1);
    doc.rect(10, 10, width - 20, height - 20, 'S');
    doc.setLineWidth(0.2);
    doc.rect(12, 12, width - 24, height - 24, 'S');

    // 2. Header
    doc.setTextColor(18, 18, 18);
    doc.setFont('serif', 'bold');
    doc.setFontSize(40);
    doc.text('AIC.', width / 2, 40, { align: 'center' });
    
    doc.setFont('mono', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(212, 175, 55);
    doc.text('AI INTEGRITY CERTIFICATION', width / 2, 48, { align: 'center', charSpace: 2 });

    // 3. Main Text
    doc.setTextColor(80, 80, 80);
    doc.setFont('serif', 'italic');
    doc.setFontSize(18);
    doc.text('This document officially certifies that', width / 2, 75, { align: 'center' });

    doc.setTextColor(18, 18, 18);
    doc.setFont('serif', 'bold');
    doc.setFontSize(32);
    doc.text(data.orgName, width / 2, 90, { align: 'center' });

    doc.setTextColor(80, 80, 80);
    doc.setFont('serif', 'italic');
    doc.setFontSize(18);
    doc.text('has successfully met the requirements for', width / 2, 105, { align: 'center' });

    // 4. Tier Badge
    const tierLabel = `${data.tier.replace('_', ' ')}: HUMAN-ACCOUNTABLE`;
    doc.setTextColor(data.tier === 'TIER_1' ? 196 : 212, data.tier === 'TIER_1' ? 30 : 175, data.tier === 'TIER_1' ? 58 : 55);
    doc.setFont('mono', 'bold');
    doc.setFontSize(22);
    doc.text(tierLabel, width / 2, 125, { align: 'center', charSpace: 1 });

    // 5. Compliance Statement
    doc.setTextColor(120, 120, 120);
    doc.setFont('serif', 'normal');
    doc.setFontSize(11);
    const statement = "Validated in accordance with the AIC Human Accountability Framework and POPIA Section 71 requirements regarding automated decision-making and meaningful human intervention.";
    const splitStatement = doc.splitTextToSize(statement, 180);
    doc.text(splitStatement, width / 2, 145, { align: 'center' });

    // 6. Footer Details
    doc.setFont('mono', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    
    // Bottom Left
    doc.text(`CERTIFICATE ID: AIC-2026-${data.orgId.substring(0, 8).toUpperCase()}`, 30, 180);
    doc.text(`ISSUED: ${data.issuedDate}`, 30, 185);
    
    // Bottom Right
    doc.text(`VALID UNTIL: ${data.expiryDate}`, width - 30, 180, { align: 'right' });
    doc.text('LOCATION: JOHANNESBURG, SA', width - 30, 185, { align: 'right' });

    // 7. Simulated Signature
    doc.setDrawColor(18, 18, 18);
    doc.line(width / 2 - 30, 180, width / 2 + 30, 180);
    doc.setFont('serif', 'italic');
    doc.setFontSize(12);
    doc.setTextColor(18, 18, 18);
    doc.text('Zander Wilken', width / 2, 175, { align: 'center' });
    doc.setFont('mono', 'bold');
    doc.setFontSize(7);
    doc.text('FOUNDER & LEAD AUDITOR', width / 2, 185, { align: 'center' });

    // Save
    doc.save(`AIC-Certificate-${data.orgName.replace(/\s+/g, '-')}.pdf`);
}
