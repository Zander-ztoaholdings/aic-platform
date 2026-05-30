import { jsPDF } from 'jspdf';

export const generateIntegritySnapshot = (orgData: any, scoreData: any) => {
    const doc = new jsPDF();
    const timestamp = new Date().toLocaleDateString();

    // Institutional Header
    doc.setFillColor(18, 18, 18);
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(212, 175, 55);
    doc.setFont("serif", "bold");
    doc.setFontSize(24);
    doc.text("AIC PULSE", 20, 25);
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont("mono", "normal");
    doc.text("MONTHLY INTEGRITY SNAPSHOT", 140, 25);

    // Body
    doc.setTextColor(18, 18, 18);
    doc.setFontSize(14);
    doc.setFont("serif", "normal");
    doc.text(`Organization: ${orgData.name}`, 20, 60);
    doc.text(`Reporting Period: ${timestamp}`, 20, 70);

    // Score Circle (Square for PDF simplicity)
    doc.setDrawColor(212, 175, 55);
    doc.setLineWidth(1);
    doc.rect(140, 55, 40, 40);
    doc.setFontSize(30);
    doc.text(`${scoreData.score}%`, 145, 82);
    doc.setFontSize(8);
    doc.text("INTEGRITY SCORE", 145, 90);

    // Categories
    let y = 110;
    doc.setFontSize(12);
    doc.setFont("serif", "bold");
    doc.text("Departmental Breakdown", 20, y);
    y += 10;
    
    doc.setFont("serif", "normal");
    Object.entries(scoreData.breakdown).forEach(([name, val]: any) => {
        doc.text(`${name}:`, 20, y);
        doc.text(`${val}%`, 160, y);
        y += 8;
    });

    // Findings
    y += 10;
    doc.setFont("serif", "bold");
    doc.text("Lead Auditor Findings", 20, y);
    y += 10;
    doc.setFont("serif", "italic");
    doc.setFontSize(10);
    scoreData.recommendations.forEach((rec: string) => {
        const lines = doc.splitTextToSize(`• ${rec}`, 170);
        doc.text(lines, 20, y);
        y += (lines.length * 5);
    });

    // Footer
    doc.setFont("mono", "normal");
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text("VERIFIED BY AIC IMMUTABLE TRUST REGISTRY", 20, 280);
    doc.text(`CERTIFICATE_ID: AIC-REF-${orgData.id.substring(0,8)}`, 140, 280);

    doc.save(`AIC_Snapshot_${orgData.name.replace(/\s/g, '_')}.pdf`);
};
