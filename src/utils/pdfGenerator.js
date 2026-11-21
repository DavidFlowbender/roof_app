import { jsPDF } from 'jspdf';
import { formatLength, formatArea } from './units';
import { formatCurrency } from './materials';

export async function generateQuotePDF({
  geometry,
  materials,
  clientInfo = {},
  contractorInfo = {},
  unitSystem = 'metric',
}) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  let currentY = 18;

  // Colors
  const primaryColor = [15, 23, 42]; // Slate 900
  const accentColor = [16, 185, 129]; // Emerald 500
  const headerBg = [30, 41, 59]; // Slate 800
  const textDark = [30, 41, 59];
  const textMuted = [100, 116, 139];

  // 1. Header Banner
  doc.setFillColor(...headerBg);
  doc.rect(0, 0, pageWidth, 32, 'F');

  // Accent line
  doc.setFillColor(...accentColor);
  doc.rect(0, 31, pageWidth, 1.5, 'F');

  // S "S" Logo Badge in Banner
  doc.setFillColor(...accentColor);
  doc.roundedRect(margin, 9, 14, 14, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('S', margin + 7, 18.8, { align: 'center' });

  // Title in Banner
  const isWcQuote = materials?.buildingStage === 'wc';
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text(isWcQuote ? 'WATER COLLECTOR QUOTATION (WC)' : 'OFFICIAL ROOFING QUOTATION', margin + 18, 15.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.8);
  doc.setTextColor(203, 213, 225);
  doc.text(
    isWcQuote
      ? 'Sijitek Solutions • Rainwater Gutters, Miters & Downspout Specification'
      : 'Sijitek Solutions • Bill of Quantities & Material Specification',
    margin + 18,
    22.5
  );

  // Quote Reference & Date (top right)
  const quoteRef = clientInfo.quoteNumber || `RF-${Date.now().toString().slice(-6)}`;
  const quoteDate = clientInfo.date || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  doc.setFontSize(9);
  doc.text(`Quote Ref: ${quoteRef}`, pageWidth - margin, 15, { align: 'right' });
  doc.text(`Date: ${quoteDate}`, pageWidth - margin, 21, { align: 'right' });
  doc.text('Validity: 30 Days', pageWidth - margin, 27, { align: 'right' });

  currentY = 42;

  // 2. Contractor & Client Information (2 Columns)
  // Left: Contractor Details
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...textDark);
  doc.text('CONTRACTOR / ESTIMATOR:', margin, currentY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...textMuted);
  doc.text(contractorInfo.name || 'Sijitek Solutions', margin, currentY + 6);
  doc.text(contractorInfo.phone || '+234 810 000 0000', margin, currentY + 11);
  doc.text(contractorInfo.email || 'info@sijiteksolutions.com', margin, currentY + 16);
  doc.text(contractorInfo.address || 'Lagos, Nigeria', margin, currentY + 21);

  // Right: Client Details
  const rightColX = pageWidth / 2 + 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...textDark);
  doc.text('PREPARED FOR (CLIENT):', rightColX, currentY);

  const stageLabel =
    materials.buildingStage === 'wc' ? (materials.profile?.name || 'Water Collector System') :
    materials.buildingStage === 'foundation' ? 'Foundation Level (Presets Applied)' :
    materials.buildingStage === 'parapet' ? 'Parapet Level (Flashing & Trough)' :
    materials.buildingStage === 'woodwork' ? 'Woodwork Level (Measured Carcass)' : 'Standard';

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...textMuted);
  doc.text(`Client Name: ${clientInfo.name || 'Valued Customer'}`, rightColX, currentY + 6);
  doc.text(`Project Site: ${clientInfo.site || 'Site Address Pending'}`, rightColX, currentY + 11);
  doc.text(`Phone / Contact: ${clientInfo.phone || 'N/A'}`, rightColX, currentY + 16);
  doc.text(`Roof Type: ${(geometry.roofType || 'Gable').toUpperCase()} ROOF`, rightColX, currentY + 21);
  doc.text(`Site Stage: ${stageLabel}`, rightColX, currentY + 26);

  currentY += 36;

  // 3. Technical Roof Geometry Summary Card
  doc.setFillColor(248, 250, 252); // light slate background
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, currentY, pageWidth - 2 * margin, 24, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...textDark);
  doc.text('KEY ROOF MEASUREMENTS', margin + 4, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...textMuted);

  const L = geometry?.buildingDimensions?.length || 0;
  const B = geometry?.buildingDimensions?.breadth || 0;
  const colW = (pageWidth - 2 * margin) / 4;

  doc.text(`Building Size:`, margin + 4, currentY + 13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textDark);
  doc.text(`${formatLength(L, unitSystem)} × ${formatLength(B, unitSystem)}`, margin + 4, currentY + 18);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textMuted);
  doc.text(`Slanting H / Kingpost:`, margin + 4 + colW, currentY + 13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textDark);
  doc.text(
    `H:${formatLength(geometry.rafterLength, unitSystem)} | KP:${formatLength(geometry.roofHeight, unitSystem)} (${geometry.pitchDegrees}°)`,
    margin + 4 + colW,
    currentY + 18
  );

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textMuted);
  doc.text(`Total Roof Area:`, margin + 4 + colW * 2, currentY + 13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textDark);
  doc.text(`${formatArea(geometry.totalArea, unitSystem)} (+${geometry.wastePercentage}% waste)`, margin + 4 + colW * 2, currentY + 18);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...textMuted);
  doc.text(`Ridges & Gutters:`, margin + 4 + colW * 3, currentY + 13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textDark);
  doc.text(`R: ${formatLength(geometry.totalRidge, unitSystem)} | G: ${formatLength(geometry.totalGutter, unitSystem)}`, margin + 4 + colW * 3, currentY + 18);

  currentY += 32;

  // 4. Bill of Quantities (BOQ) Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...textDark);
  doc.text('BILL OF QUANTITIES (BOQ)', margin, currentY);

  currentY += 5;

  // Table Header
  const tableX = margin;
  const tableWidth = pageWidth - 2 * margin;
  const rowHeight = 6.8;

  const renderTableHeader = () => {
    doc.setFillColor(...primaryColor);
    doc.rect(tableX, currentY, tableWidth, rowHeight, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);

    colPositions.forEach((col) => {
      doc.text(col.title, col.x, currentY + 4.8);
    });
    currentY += rowHeight;
  };

  const colPositions = [
    { x: tableX + 3, w: 10, title: '#' },
    { x: tableX + 13, w: 80, title: 'Item Description & Specification' },
    { x: tableX + 93, w: 20, title: 'Qty' },
    { x: tableX + 113, w: 18, title: 'Unit' },
    { x: tableX + 131, w: 23, title: 'Unit Price' },
    { x: tableX + 154, w: tableWidth - 154, title: 'Total Amount' },
  ];

  renderTableHeader();

  // Table Body Rows
  const items = materials.items || [];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);

  items.forEach((item, index) => {
    // Check page break
    if (currentY + rowHeight > pageHeight - 35) {
      doc.addPage();
      currentY = 20;
      renderTableHeader();
    }

    const isEven = index % 2 === 0;
    doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
    doc.rect(tableX, currentY, tableWidth, rowHeight, 'F');
    doc.setDrawColor(241, 245, 249);
    doc.line(tableX, currentY + rowHeight, tableX + tableWidth, currentY + rowHeight);

    doc.setTextColor(...textDark);
    doc.text(String(index + 1), colPositions[0].x, currentY + 4.6);

    doc.setFont('helvetica', 'bold');
    doc.text(item.name.substring(0, 42), colPositions[1].x, currentY + 4.6);

    doc.setFont('helvetica', 'normal');
    doc.text(String(item.quantity), colPositions[2].x, currentY + 4.6);
    doc.text(item.unit, colPositions[3].x, currentY + 4.6);
    doc.text(formatCurrency(item.unitPrice, materials.currencyCode), colPositions[4].x, currentY + 4.6);
    doc.text(formatCurrency(item.total, materials.currencyCode), colPositions[5].x, currentY + 4.6);

    currentY += rowHeight;
  });

  let nextRowNum = items.length + 1;

  // Labor Row (only when > 0)
  if ((materials.summary.laborTotal || 0) > 0) {
    if (currentY + rowHeight > pageHeight - 35) {
      doc.addPage();
      currentY = 20;
      renderTableHeader();
    }
    doc.setFillColor(241, 245, 249);
    doc.rect(tableX, currentY, tableWidth, rowHeight, 'F');
    doc.setTextColor(...textDark);
    doc.text(String(nextRowNum++), colPositions[0].x, currentY + 4.6);
    doc.setFont('helvetica', 'bold');
    doc.text('Skilled Roofing Installation & Workmanship', colPositions[1].x, currentY + 4.6);
    doc.setFont('helvetica', 'normal');
    doc.text(String(geometry.totalArea), colPositions[2].x, currentY + 4.6);
    doc.text('m²', colPositions[3].x, currentY + 4.6);
    doc.text('-', colPositions[4].x, currentY + 4.6);
    doc.text(formatCurrency(materials.summary.laborTotal, materials.currencyCode), colPositions[5].x, currentY + 4.6);
    currentY += rowHeight;
  }

  // Transport Row (only when > 0)
  if ((materials.summary.transportTotal || 0) > 0) {
    if (currentY + rowHeight > pageHeight - 35) {
      doc.addPage();
      currentY = 20;
      renderTableHeader();
    }
    doc.setFillColor(248, 250, 252);
    doc.rect(tableX, currentY, tableWidth, rowHeight, 'F');
    doc.setTextColor(...textDark);
    doc.text(String(nextRowNum++), colPositions[0].x, currentY + 4.6);
    doc.setFont('helvetica', 'bold');
    doc.text('Transport & Site Logistics', colPositions[1].x, currentY + 4.6);
    doc.setFont('helvetica', 'normal');
    doc.text('1', colPositions[2].x, currentY + 4.6);
    doc.text('trip', colPositions[3].x, currentY + 4.6);
    doc.text('-', colPositions[4].x, currentY + 4.6);
    doc.text(formatCurrency(materials.summary.transportTotal, materials.currencyCode), colPositions[5].x, currentY + 4.6);
    currentY += rowHeight;
  }

  currentY += 4;

  // 5. Total Cost Box
  const hasLabor = (materials.summary.laborTotal || 0) > 0;
  const hasTransport = (materials.summary.transportTotal || 0) > 0;
  const summaryRows = 1 + (hasLabor ? 1 : 0) + (hasTransport ? 1 : 0);
  const summaryBoxH = 14 + summaryRows * 6;
  const summaryBoxW = 78;
  const summaryBoxX = pageWidth - margin - summaryBoxW;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(summaryBoxX, currentY, summaryBoxW, summaryBoxH, 2, 2, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...textMuted);
  let sumY = currentY + 6;
  doc.text('Materials Subtotal:', summaryBoxX + 4, sumY);
  doc.text(formatCurrency(materials.summary.materialsSubtotal, materials.currencyCode), summaryBoxX + summaryBoxW - 4, sumY, { align: 'right' });

  if (hasLabor) {
    sumY += 6;
    doc.text('Labor & Workmanship:', summaryBoxX + 4, sumY);
    doc.text(formatCurrency(materials.summary.laborTotal, materials.currencyCode), summaryBoxX + summaryBoxW - 4, sumY, { align: 'right' });
  }
  if (hasTransport) {
    sumY += 6;
    doc.text('Transport & Logistics:', summaryBoxX + 4, sumY);
    doc.text(formatCurrency(materials.summary.transportTotal, materials.currencyCode), summaryBoxX + summaryBoxW - 4, sumY, { align: 'right' });
  }

  doc.setDrawColor(...accentColor);
  doc.line(summaryBoxX + 4, sumY + 3, summaryBoxX + summaryBoxW - 4, sumY + 3);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...textDark);
  doc.text('GRAND TOTAL:', summaryBoxX + 4, sumY + 9);
  doc.setTextColor(5, 150, 105); // emerald dark
  doc.text(formatCurrency(materials.summary.grandTotal, materials.currencyCode), summaryBoxX + summaryBoxW - 4, sumY + 9, { align: 'right' });

  currentY += summaryBoxH + 8;

  // 6. Terms & Signature Block
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...textDark);
  doc.text('ESTIMATE TERMS & ACCEPTANCE', margin, currentY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...textMuted);
  doc.text('1. Quantities include waste allowance. Any on-site changes to roof height or overhang will adjust final quantities.', margin, currentY + 5);
  doc.text('2. Payment Terms: 70% advance on material procurement, 30% upon completion of roofing installation.', margin, currentY + 9);

  // Signature Lines
  currentY += 18;
  doc.setDrawColor(148, 163, 184);
  doc.line(margin, currentY, margin + 55, currentY);
  doc.line(rightColX, currentY, rightColX + 55, currentY);

  doc.setFontSize(8);
  doc.setTextColor(...textDark);
  doc.text('Contractor Signature & Seal', margin, currentY + 5);
  doc.text('Client Acceptance Signature & Date', rightColX, currentY + 5);

  // Footer Branding
  doc.setFontSize(7.5);
  doc.setTextColor(...textMuted);
  doc.text('Generated by RoofCalc Pro — Powered by Sijitek Solutions', pageWidth / 2, pageHeight - 8, { align: 'center' });

  // Save the PDF
  const filename = `Roof_Quotation_${(clientInfo.name || 'Estimate').replace(/\s+/g, '_')}_${quoteRef}.pdf`;
  doc.save(filename);
}
