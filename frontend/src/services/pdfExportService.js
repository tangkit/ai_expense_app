import { jsPDF } from 'jspdf';
import { EXPENSE_CATEGORY_LABELS } from '../constants/expenseTypes';

/**
 * Generate a professional PDF expense report with receipts attached
 */
export async function exportToPDF(expenses, claimInfo, uploadedReceipts, companyTemplate = null) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPosition = margin;

  // Sort expenses by date
  const sortedExpenses = [...expenses].sort((a, b) => new Date(a.date) - new Date(b.date));

  // Calculate totals
  const totalAmount = expenses.reduce((sum, exp) => sum + (exp.total || 0), 0);
  const byCategory = expenses.reduce((acc, exp) => {
    const cat = exp.category || 'Other';
    if (!acc[cat]) acc[cat] = { count: 0, total: 0 };
    acc[cat].count++;
    acc[cat].total += exp.total || 0;
    return acc;
  }, {});

  // ==================== COVER PAGE ====================
  // Company header (if template exists)
  if (companyTemplate) {
    doc.setFontSize(10);
    doc.setTextColor(128, 128, 128);
    doc.text(`Template: ${companyTemplate.name}`, margin, yPosition);
    yPosition += 10;
  }

  // Title
  doc.setFontSize(24);
  doc.setTextColor(33, 37, 41);
  doc.setFont('helvetica', 'bold');
  doc.text('EXPENSE REPORT', pageWidth / 2, yPosition + 20, { align: 'center' });
  yPosition += 35;

  // Claim Name
  if (claimInfo.claimName) {
    doc.setFontSize(16);
    doc.setFont('helvetica', 'normal');
    doc.text(claimInfo.claimName, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;
  }

  // Horizontal line
  doc.setDrawColor(59, 130, 246);
  doc.setLineWidth(1);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 20;

  // Claim Details Box
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, yPosition, pageWidth - 2 * margin, 60, 3, 3, 'F');

  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  const detailsStartY = yPosition + 12;
  const col1X = margin + 10;
  const col2X = pageWidth / 2 + 10;

  // Left column
  doc.setFont('helvetica', 'bold');
  doc.text('Traveler:', col1X, detailsStartY);
  doc.setFont('helvetica', 'normal');
  doc.text(claimInfo.travelerName || 'Not specified', col1X + 40, detailsStartY);

  doc.setFont('helvetica', 'bold');
  doc.text('Department:', col1X, detailsStartY + 12);
  doc.setFont('helvetica', 'normal');
  doc.text(claimInfo.department || 'Not specified', col1X + 40, detailsStartY + 12);

  doc.setFont('helvetica', 'bold');
  doc.text('Submission Date:', col1X, detailsStartY + 24);
  doc.setFont('helvetica', 'normal');
  doc.text(formatDate(claimInfo.submissionDate) || formatDate(new Date()), col1X + 55, detailsStartY + 24);

  // Right column
  doc.setFont('helvetica', 'bold');
  doc.text('Total Expenses:', col2X, detailsStartY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(14);
  doc.setTextColor(16, 185, 129);
  doc.text(`$${totalAmount.toFixed(2)}`, col2X + 55, detailsStartY);

  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'bold');
  doc.text('Number of Items:', col2X, detailsStartY + 12);
  doc.setFont('helvetica', 'normal');
  doc.text(`${expenses.length}`, col2X + 55, detailsStartY + 12);

  doc.setFont('helvetica', 'bold');
  doc.text('Report Generated:', col2X, detailsStartY + 24);
  doc.setFont('helvetica', 'normal');
  doc.text(formatDate(new Date()), col2X + 55, detailsStartY + 24);

  yPosition += 70;

  // Business Purpose
  if (claimInfo.businessPurpose) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(33, 37, 41);
    doc.text('Business Purpose:', margin, yPosition);
    yPosition += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    const purposeLines = doc.splitTextToSize(claimInfo.businessPurpose, pageWidth - 2 * margin);
    doc.text(purposeLines, margin, yPosition);
    yPosition += purposeLines.length * 5 + 15;
  }

  // Category Summary
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(33, 37, 41);
  doc.text('Summary by Category', margin, yPosition);
  yPosition += 10;

  Object.entries(byCategory).forEach(([category, data]) => {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const categoryLabel = EXPENSE_CATEGORY_LABELS[category] || category;
    doc.text(`${categoryLabel}: ${data.count} item(s) - $${data.total.toFixed(2)}`, margin + 5, yPosition);
    yPosition += 7;
  });

  // ==================== EXPENSE DETAILS PAGE ====================
  doc.addPage();
  yPosition = margin;

  // Section header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(33, 37, 41);
  doc.text('Expense Details', margin, yPosition);
  yPosition += 5;

  // Underline
  doc.setDrawColor(59, 130, 246);
  doc.setLineWidth(0.5);
  doc.line(margin, yPosition, margin + 50, yPosition);
  yPosition += 15;

  // Table header
  const colWidths = [25, 45, 35, 25, 25, 25];
  const headers = ['Date', 'Vendor', 'Category', 'Amount', 'Tax', 'Total'];

  doc.setFillColor(59, 130, 246);
  doc.rect(margin, yPosition - 5, pageWidth - 2 * margin, 10, 'F');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);

  let xPos = margin + 3;
  headers.forEach((header, idx) => {
    doc.text(header, xPos, yPosition + 2);
    xPos += colWidths[idx];
  });

  yPosition += 10;

  // Table rows
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(33, 37, 41);

  sortedExpenses.forEach((expense, index) => {
    // Check if we need a new page
    if (yPosition > pageHeight - 40) {
      doc.addPage();
      yPosition = margin;

      // Repeat header on new page
      doc.setFillColor(59, 130, 246);
      doc.rect(margin, yPosition - 5, pageWidth - 2 * margin, 10, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      xPos = margin + 3;
      headers.forEach((header, idx) => {
        doc.text(header, xPos, yPosition + 2);
        xPos += colWidths[idx];
      });
      yPosition += 10;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(33, 37, 41);
    }

    // Alternating row colors
    if (index % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, yPosition - 4, pageWidth - 2 * margin, 8, 'F');
    }

    doc.setFontSize(8);
    xPos = margin + 3;

    // Date
    doc.text(formatDate(expense.date) || '-', xPos, yPosition);
    xPos += colWidths[0];

    // Vendor (truncate if too long)
    const vendorText = (expense.vendor || '-').substring(0, 20);
    doc.text(vendorText, xPos, yPosition);
    xPos += colWidths[1];

    // Category
    const categoryLabel = EXPENSE_CATEGORY_LABELS[expense.category] || expense.category || '-';
    doc.text(categoryLabel.substring(0, 15), xPos, yPosition);
    xPos += colWidths[2];

    // Amount
    doc.text(`$${(expense.amount || 0).toFixed(2)}`, xPos, yPosition);
    xPos += colWidths[3];

    // Tax
    doc.text(`$${(expense.tax || 0).toFixed(2)}`, xPos, yPosition);
    xPos += colWidths[4];

    // Total
    doc.setFont('helvetica', 'bold');
    doc.text(`$${(expense.total || 0).toFixed(2)}`, xPos, yPosition);
    doc.setFont('helvetica', 'normal');

    yPosition += 8;

    // Add companion info for meals if exists
    if (expense.companionName) {
      doc.setFontSize(7);
      doc.setTextColor(107, 114, 128);
      doc.text(`    Companion: ${expense.companionName}`, margin + 3, yPosition);
      doc.setTextColor(33, 37, 41);
      yPosition += 6;
    }
  });

  // Total row
  yPosition += 5;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 8;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL:', pageWidth - margin - 60, yPosition);
  doc.setTextColor(16, 185, 129);
  doc.text(`$${totalAmount.toFixed(2)}`, pageWidth - margin - 25, yPosition);

  // ==================== HOTEL ITEMIZATION (if applicable) ====================
  const hotelExpenses = sortedExpenses.filter(exp => exp.hotelItemization && exp.hotelItemization.length > 0);

  if (hotelExpenses.length > 0) {
    doc.addPage();
    yPosition = margin;

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(33, 37, 41);
    doc.text('Hotel Stay Itemization', margin, yPosition);
    yPosition += 15;

    hotelExpenses.forEach(hotel => {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`${hotel.vendor} - ${formatDate(hotel.date)}`, margin, yPosition);
      yPosition += 10;

      hotel.hotelItemization.forEach((night, idx) => {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text(
          `Night ${idx + 1} (${night.nightDate}): Room $${night.roomRate.toFixed(2)} | Tax $${night.roomTax.toFixed(2)} | Total $${night.dailyTotal.toFixed(2)}`,
          margin + 10,
          yPosition
        );
        yPosition += 7;
      });

      yPosition += 10;
    });
  }

  // ==================== RECEIPTS APPENDIX ====================
  console.log('=== PDF Export: Receipts Section ===');
  console.log('uploadedReceipts:', uploadedReceipts);
  console.log('uploadedReceipts length:', uploadedReceipts?.length || 0);

  if (uploadedReceipts && uploadedReceipts.length > 0) {
    doc.addPage();
    yPosition = margin;

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(33, 37, 41);
    doc.text('Appendix: Receipts', margin, yPosition);
    yPosition += 5;

    doc.setDrawColor(59, 130, 246);
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, margin + 60, yPosition);
    yPosition += 15;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('The following receipts are attached in chronological order:', margin, yPosition);
    yPosition += 15;

    // Sort receipts by upload date
    const sortedReceipts = [...uploadedReceipts].sort(
      (a, b) => new Date(a.uploadedAt) - new Date(b.uploadedAt)
    );

    for (let i = 0; i < sortedReceipts.length; i++) {
      const receipt = sortedReceipts[i];

      console.log(`=== Processing Receipt ${i + 1} ===`);
      console.log('Receipt object:', {
        id: receipt.id,
        fileName: receipt.fileName,
        fileType: receipt.fileType,
        base64Length: receipt.base64?.length || 0,
        base64Start: receipt.base64?.substring(0, 100) || 'NO BASE64',
        uploadedAt: receipt.uploadedAt
      });

      // Check if we need a new page
      if (yPosition > pageHeight - 100) {
        doc.addPage();
        yPosition = margin;
      }

      // Receipt header
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(33, 37, 41);
      doc.text(`Receipt ${i + 1}: ${receipt.fileName}`, margin, yPosition);
      yPosition += 6;

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(107, 114, 128);
      doc.text(`Uploaded: ${formatDateTime(receipt.uploadedAt)}`, margin, yPosition);
      yPosition += 10;

      // Determine if this is an image we can embed
      const isImage = receipt.fileType?.startsWith('image/') ||
                      receipt.base64?.startsWith('data:image');
      const hasBase64 = receipt.base64 && receipt.base64.length > 0;

      console.log('isImage:', isImage, 'hasBase64:', hasBase64);

      // Try to embed image if it's an image type
      if (hasBase64 && isImage) {
        try {
          const imgWidth = pageWidth - 2 * margin;
          const maxHeight = 150;

          // Determine the image format from the data URL or file type
          let imageFormat = 'JPEG';
          if (receipt.base64.includes('data:image/png')) {
            imageFormat = 'PNG';
          } else if (receipt.base64.includes('data:image/gif')) {
            imageFormat = 'GIF';
          } else if (receipt.base64.includes('data:image/webp')) {
            imageFormat = 'WEBP';
          } else if (receipt.fileType === 'image/png') {
            imageFormat = 'PNG';
          } else if (receipt.fileType === 'image/gif') {
            imageFormat = 'GIF';
          }

          console.log('Adding image with format:', imageFormat);

          // Add the image - jsPDF accepts data URLs directly
          doc.addImage(receipt.base64, imageFormat, margin, yPosition, imgWidth, maxHeight, undefined, 'MEDIUM');
          yPosition += maxHeight + 15;
          console.log('Image added successfully');
        } catch (err) {
          console.error('Failed to add image:', err);
          doc.setFontSize(9);
          doc.setTextColor(239, 68, 68);
          doc.text(`[Image could not be embedded: ${err.message}]`, margin, yPosition);
          yPosition += 15;
        }
      } else {
        console.log('Not embedding - either not an image or no base64 data');
        // For PDFs or unsupported formats, just note the attachment
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(margin, yPosition, pageWidth - 2 * margin, 30, 2, 2, 'F');
        doc.setFontSize(9);
        doc.setTextColor(107, 114, 128);
        doc.text(`File: ${receipt.fileName}`, margin + 10, yPosition + 12);
        doc.text(`Type: ${receipt.fileType || 'unknown'}`, margin + 10, yPosition + 22);
        if (!hasBase64) {
          doc.text(`(No image data available)`, margin + 10, yPosition + 32);
          yPosition += 10;
        }
        yPosition += 40;
      }
    }
  } else {
    console.log('No uploadedReceipts to include in PDF');
  }

  // ==================== FOOTER ON ALL PAGES ====================
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(156, 163, 175);
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
    doc.text(
      `Generated by Expense Claim Assistant`,
      margin,
      pageHeight - 10
    );
  }

  // Generate filename
  const dateStr = new Date().toISOString().split('T')[0];
  const claimName = claimInfo.claimName
    ? claimInfo.claimName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)
    : 'expense_report';
  const filename = `${claimName}_${dateStr}.pdf`;

  // Save the PDF
  doc.save(filename);

  return filename;
}

// Helper functions
function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default { exportToPDF };
