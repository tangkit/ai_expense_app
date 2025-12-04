import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { format } from 'date-fns';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  SPREADSHEET_COLUMNS,
  HOTEL_ITEMIZED_COLUMNS
} from '../constants/expenseTypes';

/**
 * Sanitize a string for use in filenames
 */
function sanitizeFilename(str) {
  if (!str) return '';
  return str
    .trim()
    .replace(/[^a-zA-Z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .substring(0, 50); // Limit length
}

/**
 * Generate filename with employee name prefix and date stamp
 */
function generateFileName(baseName, employeeName, extension) {
  const dateStr = format(new Date(), 'yyyy-MM-dd');
  const sanitizedName = sanitizeFilename(employeeName);
  const prefix = sanitizedName ? `${sanitizedName}_` : '';
  return `${prefix}${baseName}_${dateStr}.${extension}`;
}

/**
 * Get file extension from MIME type
 */
function getExtensionFromMimeType(mimeType) {
  const mimeToExt = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/heic': '.heic',
    'image/heif': '.heif',
    'application/pdf': '.pdf'
  };
  return mimeToExt[mimeType] || '.bin';
}

/**
 * Sanitize string for PDF WinAnsi encoding
 * WinAnsi fonts cannot encode certain Unicode characters like U+202F (narrow no-break space)
 */
function sanitizeForPdf(str) {
  if (!str) return '';
  return String(str)
    .replace(/\u202F/g, ' ')      // Narrow no-break space -> regular space
    .replace(/\u00A0/g, ' ')      // Non-breaking space -> regular space
    .replace(/[\u2000-\u200F]/g, ' ')  // Various Unicode spaces
    .replace(/[\u2028-\u202F]/g, ' ')  // Line/paragraph separators
    .replace(/[\u2018\u2019]/g, "'")   // Smart single quotes -> ASCII
    .replace(/[\u201C\u201D]/g, '"')   // Smart double quotes -> ASCII
    .replace(/\u2013/g, '-')      // En dash -> hyphen
    .replace(/\u2014/g, '--')     // Em dash -> double hyphen
    .replace(/[^\x00-\x7F\xA0-\xFF]/g, ''); // Remove other non-WinAnsi chars
}

/**
 * Create a PDF containing all uploaded receipts using pdf-lib
 * Each receipt page has a header with receipt info drawn on top
 */
async function createReceiptsPDF(uploadedReceipts, employeeName) {
  console.log('=== createReceiptsPDF called (pdf-lib) ===');
  console.log('Number of receipts:', uploadedReceipts?.length || 0);

  if (!uploadedReceipts || uploadedReceipts.length === 0) {
    console.log('No receipts to include in PDF');
    return null;
  }

  // Debug: Log full receipt data structure
  uploadedReceipts.forEach((r, idx) => {
    console.log(`Receipt ${idx + 1} structure:`, {
      id: r.id,
      fileName: r.fileName,
      fileType: r.fileType,
      uploadedAt: r.uploadedAt,
      hasBase64: !!r.base64,
      base64Length: r.base64?.length || 0
    });
  });

  try {
    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Helper function to draw header on a page
    const drawReceiptHeader = (page, receiptNum, totalReceipts, fileName, uploadDate, receiptPageNum = null, receiptTotalPages = null) => {
      const { height } = page.getSize();
      const headerY = height - 25; // Position near top of page

      // Draw semi-transparent white background for header
      page.drawRectangle({
        x: 0,
        y: height - 55,
        width: 595,
        height: 55,
        color: rgb(1, 1, 1),
        opacity: 0.9
      });

      // Receipt X of Y
      page.drawText(sanitizeForPdf(`Receipt ${receiptNum} of ${totalReceipts}`), {
        x: 20, y: headerY, size: 11, font: helveticaBold, color: rgb(0.13, 0.15, 0.16)
      });

      // File name (truncate if too long)
      const truncatedFileName = fileName.length > 50 ? fileName.substring(0, 47) + '...' : fileName;
      page.drawText(sanitizeForPdf(`File: ${truncatedFileName}`), {
        x: 20, y: headerY - 14, size: 9, font: helveticaFont, color: rgb(0.28, 0.33, 0.41)
      });

      // Uploaded date
      page.drawText(sanitizeForPdf(`Uploaded: ${uploadDate}`), {
        x: 20, y: headerY - 26, size: 8, font: helveticaFont, color: rgb(0.42, 0.45, 0.5)
      });

      // Receipt page X of Y (for multi-page receipts)
      if (receiptPageNum !== null && receiptTotalPages !== null) {
        page.drawText(`Receipt page ${receiptPageNum} of ${receiptTotalPages}`, {
          x: 400, y: headerY, size: 9, font: helveticaFont, color: rgb(0.42, 0.45, 0.5)
        });
      }

      // Draw line under header
      page.drawLine({
        start: { x: 20, y: height - 58 },
        end: { x: 575, y: height - 58 },
        thickness: 0.5,
        color: rgb(0.78, 0.78, 0.78)
      });
    };

    // Add cover/title page
    const titlePage = pdfDoc.addPage([595, 842]); // A4 size
    const { width, height } = titlePage.getSize();

    // Title
    titlePage.drawText('EXPENSE RECEIPTS', {
      x: width / 2 - 100,
      y: height - 80,
      size: 24,
      font: helveticaBold,
      color: rgb(0.13, 0.15, 0.16)
    });

    let yPos = height - 130;

    if (employeeName) {
      titlePage.drawText(sanitizeForPdf(`Employee: ${employeeName}`), {
        x: width / 2 - 80,
        y: yPos,
        size: 12,
        font: helveticaFont,
        color: rgb(0.28, 0.33, 0.41)
      });
      yPos -= 20;
    }

    titlePage.drawText(`Total Receipts: ${uploadedReceipts.length}`, {
      x: width / 2 - 50,
      y: yPos,
      size: 12,
      font: helveticaFont,
      color: rgb(0.28, 0.33, 0.41)
    });
    yPos -= 20;

    titlePage.drawText(sanitizeForPdf(`Generated: ${format(new Date(), 'MMMM d, yyyy')}`), {
      x: width / 2 - 70,
      y: yPos,
      size: 12,
      font: helveticaFont,
      color: rgb(0.28, 0.33, 0.41)
    });

    // Sort receipts by upload date
    const sortedReceipts = [...uploadedReceipts].sort(
      (a, b) => new Date(a.uploadedAt) - new Date(b.uploadedAt)
    );
    const totalReceipts = sortedReceipts.length;

    // Process each receipt
    for (let i = 0; i < sortedReceipts.length; i++) {
      const receipt = sortedReceipts[i];
      const receiptNum = i + 1;
      const uploadDate = receipt.uploadedAt
        ? format(new Date(receipt.uploadedAt), 'MMM d, yyyy h:mm a')
        : 'Unknown';

      console.log(`\n=== Processing receipt ${receiptNum}/${totalReceipts} ===`);
      console.log('  fileName:', receipt.fileName);
      console.log('  fileType:', receipt.fileType);

      if (!receipt.base64) {
        console.log('  ERROR: No base64 data for this receipt!');
        // Add error page
        const errorPage = pdfDoc.addPage([595, 842]);
        drawReceiptHeader(errorPage, receiptNum, totalReceipts, receipt.fileName, uploadDate);
        errorPage.drawText('Receipt data not available - file was not properly stored.', {
          x: 50, y: 700, size: 10, font: helveticaFont, color: rgb(0.73, 0.11, 0.11)
        });
        continue;
      }

      // Extract raw base64 data (remove data URL prefix if present)
      const base64Data = receipt.base64.includes(',')
        ? receipt.base64.split(',')[1]
        : receipt.base64;
      const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

      const base64Start = receipt.base64.substring(0, 50).toLowerCase();
      const isPDF = receipt.fileType === 'application/pdf' || base64Start.includes('data:application/pdf');
      const isImage = receipt.fileType?.startsWith('image/') || base64Start.includes('data:image');

      console.log('  isPDF:', isPDF, 'isImage:', isImage);

      if (isPDF) {
        // For PDF files, copy all pages and add header to each
        console.log('  Merging PDF pages with headers...');
        try {
          const sourcePdf = await PDFDocument.load(binaryData);
          const pageCount = sourcePdf.getPageCount();
          console.log(`  Source PDF has ${pageCount} pages`);

          // Add separator page first
          const separatorPage = pdfDoc.addPage([595, 842]);
          separatorPage.drawText(`Receipt ${receiptNum} of ${totalReceipts}`, {
            x: 50, y: 800, size: 14, font: helveticaBold, color: rgb(0.13, 0.15, 0.16)
          });
          separatorPage.drawText(sanitizeForPdf(`File: ${receipt.fileName}`), {
            x: 50, y: 778, size: 11, font: helveticaFont, color: rgb(0.28, 0.33, 0.41)
          });
          separatorPage.drawText(sanitizeForPdf(`Uploaded: ${uploadDate}`), {
            x: 50, y: 758, size: 9, font: helveticaFont, color: rgb(0.42, 0.45, 0.5)
          });
          separatorPage.drawText(`Total pages in this receipt: ${pageCount}`, {
            x: 50, y: 738, size: 9, font: helveticaFont, color: rgb(0.42, 0.45, 0.5)
          });
          separatorPage.drawLine({
            start: { x: 50, y: 720 },
            end: { x: 545, y: 720 },
            thickness: 0.5,
            color: rgb(0.78, 0.78, 0.78)
          });
          separatorPage.drawText('The following pages contain the original PDF receipt with headers:', {
            x: 50, y: 700, size: 10, font: helveticaFont, color: rgb(0.09, 0.64, 0.29)
          });

          // Copy each page from source PDF and add header
          const copiedPages = await pdfDoc.copyPages(sourcePdf, sourcePdf.getPageIndices());
          for (let pageIdx = 0; pageIdx < copiedPages.length; pageIdx++) {
            const copiedPage = copiedPages[pageIdx];
            // Add the page to the document first
            pdfDoc.addPage(copiedPage);
            // Draw header on the copied page
            drawReceiptHeader(
              copiedPage,
              receiptNum,
              totalReceipts,
              receipt.fileName,
              uploadDate,
              pageIdx + 1,
              pageCount
            );
          }

          console.log(`  SUCCESS: Merged ${pageCount} pages from PDF with headers`);
        } catch (pdfError) {
          console.error('  FAILED to merge PDF:', pdfError);
          // Add error page
          const errorPage = pdfDoc.addPage([595, 842]);
          drawReceiptHeader(errorPage, receiptNum, totalReceipts, receipt.fileName, uploadDate);
          errorPage.drawText('[PDF could not be embedded]', {
            x: 50, y: 700, size: 10, font: helveticaFont, color: rgb(0.73, 0.11, 0.11)
          });
          errorPage.drawText(sanitizeForPdf(`Error: ${pdfError.message}`), {
            x: 50, y: 680, size: 9, font: helveticaFont, color: rgb(0.42, 0.45, 0.5)
          });
          errorPage.drawText('Original file is available in the receipts/ folder', {
            x: 50, y: 660, size: 9, font: helveticaFont, color: rgb(0.09, 0.64, 0.29)
          });
        }
      } else if (isImage) {
        // For image files, create page with header and embed image below
        console.log('  Embedding image with header...');
        try {
          let image;
          const isPng = receipt.fileType === 'image/png' || base64Start.includes('data:image/png');
          const isJpg = receipt.fileType === 'image/jpeg' || base64Start.includes('data:image/jpeg') || base64Start.includes('data:image/jpg');

          if (isPng) {
            image = await pdfDoc.embedPng(binaryData);
          } else if (isJpg) {
            image = await pdfDoc.embedJpg(binaryData);
          } else {
            // Try JPEG first (most common), fallback to PNG
            try {
              image = await pdfDoc.embedJpg(binaryData);
            } catch {
              image = await pdfDoc.embedPng(binaryData);
            }
          }

          // Calculate dimensions to fit below header
          const imgDims = image.scale(1);
          const maxWidth = 555; // 595 - 2*20 margin
          const maxHeight = 720; // 842 - 60 header - 50 bottom - 12 margin
          let scale = 1;

          if (imgDims.width > maxWidth || imgDims.height > maxHeight) {
            const scaleX = maxWidth / imgDims.width;
            const scaleY = maxHeight / imgDims.height;
            scale = Math.min(scaleX, scaleY);
          }

          const scaledWidth = imgDims.width * scale;
          const scaledHeight = imgDims.height * scale;

          // Add separator page first
          const separatorPage = pdfDoc.addPage([595, 842]);
          separatorPage.drawText(`Receipt ${receiptNum} of ${totalReceipts}`, {
            x: 50, y: 800, size: 14, font: helveticaBold, color: rgb(0.13, 0.15, 0.16)
          });
          separatorPage.drawText(sanitizeForPdf(`File: ${receipt.fileName}`), {
            x: 50, y: 778, size: 11, font: helveticaFont, color: rgb(0.28, 0.33, 0.41)
          });
          separatorPage.drawText(sanitizeForPdf(`Uploaded: ${uploadDate}`), {
            x: 50, y: 758, size: 9, font: helveticaFont, color: rgb(0.42, 0.45, 0.5)
          });
          separatorPage.drawText('Image receipt (1 page)', {
            x: 50, y: 738, size: 9, font: helveticaFont, color: rgb(0.42, 0.45, 0.5)
          });
          separatorPage.drawLine({
            start: { x: 50, y: 720 },
            end: { x: 545, y: 720 },
            thickness: 0.5,
            color: rgb(0.78, 0.78, 0.78)
          });
          separatorPage.drawText('The following page contains the receipt image with header:', {
            x: 50, y: 700, size: 10, font: helveticaFont, color: rgb(0.09, 0.64, 0.29)
          });

          // Add page with image
          const imagePage = pdfDoc.addPage([595, 842]);

          // Draw header
          drawReceiptHeader(imagePage, receiptNum, totalReceipts, receipt.fileName, uploadDate, 1, 1);

          // Center the image below header
          const imgX = (595 - scaledWidth) / 2;
          const imgY = 842 - 70 - scaledHeight; // Below header

          imagePage.drawImage(image, {
            x: imgX,
            y: Math.max(30, imgY), // Ensure at least 30px from bottom
            width: scaledWidth,
            height: scaledHeight
          });

          console.log(`  SUCCESS: Image embedded with header (${scaledWidth.toFixed(0)}x${scaledHeight.toFixed(0)})`);
        } catch (imgError) {
          console.error('  FAILED to embed image:', imgError);
          // Add error page
          const errorPage = pdfDoc.addPage([595, 842]);
          drawReceiptHeader(errorPage, receiptNum, totalReceipts, receipt.fileName, uploadDate);
          errorPage.drawText('[Image could not be embedded]', {
            x: 50, y: 700, size: 10, font: helveticaFont, color: rgb(0.73, 0.11, 0.11)
          });
          errorPage.drawText(sanitizeForPdf(`Error: ${imgError.message}`), {
            x: 50, y: 680, size: 9, font: helveticaFont, color: rgb(0.42, 0.45, 0.5)
          });
        }
      } else {
        // Unsupported format
        console.log('  Unsupported format');
        const infoPage = pdfDoc.addPage([595, 842]);
        drawReceiptHeader(infoPage, receiptNum, totalReceipts, receipt.fileName, uploadDate);
        infoPage.drawText('This file format is not supported for embedding.', {
          x: 50, y: 700, size: 10, font: helveticaFont, color: rgb(0.42, 0.45, 0.5)
        });
        infoPage.drawText('Original file is available in the receipts/ folder', {
          x: 50, y: 680, size: 10, font: helveticaFont, color: rgb(0.09, 0.64, 0.29)
        });
      }
    }

    // Add global page numbers to all pages
    const pages = pdfDoc.getPages();
    const totalPages = pages.length;
    for (let idx = 0; idx < pages.length; idx++) {
      const page = pages[idx];
      const { width } = page.getSize();
      page.drawText(`Page ${idx + 1} of ${totalPages}`, {
        x: width / 2 - 30,
        y: 15,
        size: 8,
        font: helveticaFont,
        color: rgb(0.61, 0.64, 0.69)
      });
    }

    console.log('=== Receipts PDF created successfully ===');
    console.log(`Total pages: ${totalPages}`);

    // Return as ArrayBuffer
    return await pdfDoc.save();
  } catch (error) {
    console.error('Failed to create receipts PDF:', error);
    // Fallback to simple jsPDF implementation
    return createSimpleReceiptsPDF(uploadedReceipts, employeeName);
  }
}

/**
 * Fallback: Create a simple PDF listing receipts (no embedding)
 */
function createSimpleReceiptsPDF(uploadedReceipts, employeeName) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPosition = margin;

  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('EXPENSE RECEIPTS', pageWidth / 2, yPosition + 30, { align: 'center' });
  yPosition += 50;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  if (employeeName) {
    doc.text(`Employee: ${employeeName}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 10;
  }
  doc.text(`Total Receipts: ${uploadedReceipts.length}`, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 30;

  doc.setFontSize(10);
  uploadedReceipts.forEach((receipt, idx) => {
    if (yPosition > 270) {
      doc.addPage();
      yPosition = margin;
    }
    doc.text(`${idx + 1}. ${receipt.fileName}`, margin, yPosition);
    yPosition += 8;
  });

  doc.text('Note: Original receipt files are available in the receipts/ folder of the zip.', margin, yPosition + 20);

  return doc.output('arraybuffer');
}

/**
 * Map common column name variations to expense field names
 */
const COLUMN_MAPPINGS = {
  // Date variations
  'date': 'date',
  'expense date': 'date',
  'transaction date': 'date',
  'receipt date': 'date',
  'expense_date': 'date',

  // Category variations
  'category': 'category',
  'expense type': 'category',
  'type': 'category',
  'expense category': 'category',

  // Vendor variations
  'vendor': 'vendor',
  'merchant': 'vendor',
  'payee': 'vendor',
  'supplier': 'vendor',
  'merchant name': 'vendor',
  'vendor name': 'vendor',

  // Description variations
  'description': 'description',
  'details': 'description',
  'memo': 'description',
  'notes': 'notes',
  'remarks': 'notes',
  'comments': 'notes',

  // Amount variations
  'amount': 'amount',
  'subtotal': 'amount',
  'net amount': 'amount',
  'expense amount': 'amount',
  'amount (local)': 'amount',
  'amount (reimbursed)': 'total',

  // Tax variations
  'tax': 'tax',
  'gst': 'tax',
  'vat': 'tax',
  'tax amount': 'tax',
  'sales tax': 'tax',
  'sst': 'tax',

  // Total variations
  'total': 'total',
  'total amount': 'total',
  'grand total': 'total',
  'gross amount': 'total',

  // Currency variations
  'currency': 'currency',
  'ccy': 'currency',
  'curr': 'currency',
  'currency code': 'currency',

  // Payment method variations
  'payment method': 'paymentMethod',
  'payment type': 'paymentMethod',
  'payment': 'paymentMethod',
  'paid by': 'paymentMethod',
  'payment mode': 'paymentMethod',

  // Receipt number variations
  'receipt number': 'receiptNumber',
  'receipt no': 'receiptNumber',
  'receipt #': 'receiptNumber',
  'invoice number': 'receiptNumber',
  'invoice no': 'receiptNumber',
  'invoice #': 'receiptNumber',
  'reference': 'receiptNumber',
  'ref no': 'receiptNumber',
  'booking#': 'receiptNumber',
  'reservation#': 'receiptNumber',

  // Companion/attendee variations
  'companion': 'companionName',
  'companion name': 'companionName',
  'attendee': 'companionName',
  'attendees': 'companionName',
  'guest': 'companionName',
  'guest name': 'companionName',
  'customer name': 'companionName',

  // Business purpose variations
  'business purpose': 'businessPurpose',
  'purpose': 'businessPurpose',
  'reason': 'businessPurpose',
  'justification': 'businessPurpose',

  // Project code variations
  'project code': 'projectCode',
  'project': 'projectCode',
  'cost center': 'projectCode',
  'cost centre': 'projectCode',
  'department': 'department',
  'dept': 'department',

  // Location variations
  'location': 'location',
  'city': 'location',
  'place': 'location',

  // Flight specific
  'airline': 'airline',
  'flight number': 'flightNumber',
  'flight no': 'flightNumber',
  'flight': 'flightNumber',
  'departure': 'departureCity',
  'departure city': 'departureCity',
  'from': 'departureCity',
  'arrival': 'arrivalCity',
  'arrival city': 'arrivalCity',
  'to': 'arrivalCity',
  'destination': 'arrivalCity',
  'passenger': 'passengerName',
  'passenger name': 'passengerName',
  'traveler': 'passengerName',
  'traveller': 'passengerName',

  // Hotel specific
  'hotel': 'vendor',
  'hotel name': 'vendor',
  'check in': 'checkInDate',
  'check-in': 'checkInDate',
  'check in date': 'checkInDate',
  'check out': 'checkOutDate',
  'check-out': 'checkOutDate',
  'check out date': 'checkOutDate',
  'nights': 'nights',
  'no of nights': 'nights',
};

/**
 * Get expense value for a given template column
 */
function getExpenseValueForColumn(expense, columnName) {
  const normalizedColumn = columnName.toLowerCase().trim();
  const fieldName = COLUMN_MAPPINGS[normalizedColumn];

  if (!fieldName) {
    // Try partial matching for columns not in mappings
    for (const [pattern, field] of Object.entries(COLUMN_MAPPINGS)) {
      if (normalizedColumn.includes(pattern) || pattern.includes(normalizedColumn)) {
        return getFieldValue(expense, field);
      }
    }
    return '';
  }

  return getFieldValue(expense, fieldName);
}

/**
 * Round a number to 2 decimal places
 */
function roundTo2Decimals(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/**
 * Get field value from expense object
 */
function getFieldValue(expense, fieldName) {
  switch (fieldName) {
    case 'date':
      return expense.date || '';
    case 'category':
      return EXPENSE_CATEGORY_LABELS[expense.category] || expense.category || '';
    case 'vendor':
      return expense.vendor || '';
    case 'description':
      return expense.description || '';
    case 'amount':
      return roundTo2Decimals(expense.amount || expense.subtotal || 0);
    case 'tax':
      return roundTo2Decimals(expense.tax || 0);
    case 'total':
      return roundTo2Decimals(expense.total || 0);
    case 'currency':
      return expense.currency || 'USD';
    case 'paymentMethod':
      return expense.paymentMethod || '';
    case 'receiptNumber':
      return expense.receiptNumber || '';
    case 'companionName':
      return expense.companionName || '';
    case 'businessPurpose':
      return expense.businessPurpose || '';
    case 'projectCode':
      return expense.projectCode || '';
    case 'department':
      return expense.department || '';
    case 'notes':
      return expense.notes || '';
    case 'airline':
      return expense.airline || '';
    case 'flightNumber':
      return expense.flightNumber || '';
    case 'departureCity':
      return expense.departureCity || '';
    case 'arrivalCity':
      return expense.arrivalCity || '';
    case 'passengerName':
      return expense.passengerName || '';
    case 'checkInDate':
      return expense.checkInDate || '';
    case 'checkOutDate':
      return expense.checkOutDate || '';
    case 'nights':
      return expense.hotelItemization?.length || '';
    case 'location':
      return expense.location || expense.arrivalCity || '';
    default:
      return expense[fieldName] || '';
  }
}

/**
 * Currency symbols and formats
 */
const CURRENCY_FORMATS = {
  // Southeast Asia
  'MYR': { symbol: 'RM', format: '"RM "#,##0.00', decimals: 2 },
  'SGD': { symbol: 'SGD', format: '"SGD "#,##0.00', decimals: 2 },
  'THB': { symbol: '฿', format: '"THB "#,##0.00', decimals: 2 },
  'IDR': { symbol: 'Rp', format: '"IDR "#,##0', decimals: 0 },
  'PHP': { symbol: '₱', format: '"PHP "#,##0.00', decimals: 2 },
  'VND': { symbol: '₫', format: '"VND "#,##0', decimals: 0 },
  'BND': { symbol: 'B$', format: '"BND "#,##0.00', decimals: 2 },
  'MMK': { symbol: 'K', format: '"MMK "#,##0', decimals: 0 },
  'KHR': { symbol: '៛', format: '"KHR "#,##0', decimals: 0 },
  'LAK': { symbol: '₭', format: '"LAK "#,##0', decimals: 0 },

  // East Asia
  'JPY': { symbol: '¥', format: '"¥ "#,##0', decimals: 0 },
  'CNY': { symbol: '¥', format: '"CNY "#,##0.00', decimals: 2 },
  'KRW': { symbol: '₩', format: '"₩ "#,##0', decimals: 0 },
  'TWD': { symbol: 'NT$', format: '"TWD "#,##0', decimals: 0 },
  'HKD': { symbol: 'HK$', format: '"HKD "#,##0.00', decimals: 2 },
  'MOP': { symbol: 'MOP$', format: '"MOP "#,##0.00', decimals: 2 },

  // South Asia
  'INR': { symbol: '₹', format: '"INR "#,##0.00', decimals: 2 },
  'PKR': { symbol: 'Rs', format: '"PKR "#,##0.00', decimals: 2 },
  'BDT': { symbol: '৳', format: '"BDT "#,##0.00', decimals: 2 },
  'LKR': { symbol: 'Rs', format: '"LKR "#,##0.00', decimals: 2 },
  'NPR': { symbol: 'Rs', format: '"NPR "#,##0.00', decimals: 2 },

  // Middle East
  'AED': { symbol: 'AED', format: '"AED "#,##0.00', decimals: 2 },
  'SAR': { symbol: 'SAR', format: '"SAR "#,##0.00', decimals: 2 },
  'QAR': { symbol: 'QAR', format: '"QAR "#,##0.00', decimals: 2 },
  'KWD': { symbol: 'KWD', format: '"KWD "#,##0.000', decimals: 3 },
  'BHD': { symbol: 'BHD', format: '"BHD "#,##0.000', decimals: 3 },
  'OMR': { symbol: 'OMR', format: '"OMR "#,##0.000', decimals: 3 },
  'ILS': { symbol: '₪', format: '"ILS "#,##0.00', decimals: 2 },

  // Europe
  'EUR': { symbol: '€', format: '"€ "#,##0.00', decimals: 2 },
  'GBP': { symbol: '£', format: '"£ "#,##0.00', decimals: 2 },
  'CHF': { symbol: 'CHF', format: '"CHF "#,##0.00', decimals: 2 },
  'SEK': { symbol: 'kr', format: '"SEK "#,##0.00', decimals: 2 },
  'NOK': { symbol: 'kr', format: '"NOK "#,##0.00', decimals: 2 },
  'DKK': { symbol: 'kr', format: '"DKK "#,##0.00', decimals: 2 },
  'PLN': { symbol: 'zł', format: '"PLN "#,##0.00', decimals: 2 },
  'CZK': { symbol: 'Kč', format: '"CZK "#,##0.00', decimals: 2 },
  'HUF': { symbol: 'Ft', format: '"HUF "#,##0', decimals: 0 },
  'RUB': { symbol: '₽', format: '"RUB "#,##0.00', decimals: 2 },
  'TRY': { symbol: '₺', format: '"TRY "#,##0.00', decimals: 2 },

  // Americas
  'USD': { symbol: 'USD', format: '"USD "#,##0.00', decimals: 2 },
  'CAD': { symbol: 'C$', format: '"CAD "#,##0.00', decimals: 2 },
  'MXN': { symbol: 'MX$', format: '"MXN "#,##0.00', decimals: 2 },
  'BRL': { symbol: 'R$', format: '"BRL "#,##0.00', decimals: 2 },
  'ARS': { symbol: 'AR$', format: '"ARS "#,##0.00', decimals: 2 },
  'CLP': { symbol: 'CL$', format: '"CLP "#,##0', decimals: 0 },
  'COP': { symbol: 'CO$', format: '"COP "#,##0', decimals: 0 },
  'PEN': { symbol: 'S/', format: '"PEN "#,##0.00', decimals: 2 },

  // Oceania
  'AUD': { symbol: 'A$', format: '"AUD "#,##0.00', decimals: 2 },
  'NZD': { symbol: 'NZ$', format: '"NZD "#,##0.00', decimals: 2 },
  'FJD': { symbol: 'FJ$', format: '"FJD "#,##0.00', decimals: 2 },

  // Africa
  'ZAR': { symbol: 'R', format: '"ZAR "#,##0.00', decimals: 2 },
  'EGP': { symbol: 'E£', format: '"EGP "#,##0.00', decimals: 2 },
  'NGN': { symbol: '₦', format: '"NGN "#,##0.00', decimals: 2 },
  'KES': { symbol: 'KSh', format: '"KES "#,##0.00', decimals: 2 },
};

/**
 * Format amount with currency symbol (always 2 decimal places)
 */
function formatCurrencyValue(amount, currencyCode) {
  const currency = CURRENCY_FORMATS[currencyCode?.toUpperCase()] || CURRENCY_FORMATS['USD'];
  return `${currency.symbol}${roundTo2Decimals(amount).toFixed(2)}`;
}

/**
 * Get currency number format for ExcelJS
 */
function getCurrencyFormat(currencyCode) {
  const currency = CURRENCY_FORMATS[currencyCode?.toUpperCase()] || CURRENCY_FORMATS['SGD'];
  return currency.format;
}

/**
 * Fetch exchange rates from backend API
 * Backend handles Alpha Vantage API calls securely
 * Returns { rates: { ... }, source: 'api' | 'fallback' }
 */
async function fetchExchangeRates(currencies) {
  // Filter out SGD and get unique currencies
  const uniqueCurrencies = [...new Set(
    currencies
      .map(c => c?.toUpperCase())
      .filter(c => c && c !== 'SGD')
  )];

  if (uniqueCurrencies.length === 0) {
    return { rates: { SGD: 1 }, source: 'none' };
  }

  try {
    const response = await fetch('/api/v1/currency/rates/bulk', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currencies: uniqueCurrencies,
        to_currency: 'SGD',
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const source = data.source || 'unknown';

      // Clear indication of where rates came from
      if (source === 'api') {
        console.log('%c✓ Exchange rates fetched from Alpha Vantage API', 'color: green; font-weight: bold');
      } else if (source === 'fallback') {
        console.log('%c⚠ Using fallback exchange rates (Alpha Vantage unavailable or no API key)', 'color: orange; font-weight: bold');
      }
      console.log('Exchange rates:', data.rates);

      return { rates: { SGD: 1, ...data.rates }, source };
    }

    console.warn('%c✗ Backend currency API failed, using local fallback rates', 'color: red; font-weight: bold');
    return { rates: getFallbackRates(uniqueCurrencies), source: 'local-fallback' };
  } catch (error) {
    console.error('%c✗ Error fetching exchange rates:', 'color: red; font-weight: bold', error);
    return { rates: getFallbackRates(uniqueCurrencies), source: 'local-fallback' };
  }
}

/**
 * Get fallback exchange rates to SGD (used when backend is unavailable)
 */
function getFallbackRates(currencies) {
  const fallbackRates = {
    'MYR': 0.29,
    'USD': 1.35,
    'EUR': 1.45,
    'GBP': 1.70,
    'JPY': 0.009,
    'CNY': 0.19,
    'THB': 0.039,
    'IDR': 0.000085,
    'PHP': 0.024,
    'VND': 0.000054,
    'KRW': 0.00098,
    'INR': 0.016,
    'AUD': 0.88,
    'NZD': 0.81,
    'HKD': 0.17,
    'TWD': 0.042,
    'SGD': 1,
  };

  const rates = { SGD: 1 };
  currencies.forEach(currency => {
    rates[currency] = fallbackRates[currency] || 1;
  });
  return rates;
}

/**
 * Expand expenses to include hotel nightly breakdown with itemized charges
 * Returns a flat array of rows to insert
 */
function expandExpensesForExport(expenses) {
  const expandedRows = [];

  expenses.forEach(expense => {
    if (expense.category === EXPENSE_CATEGORIES.HOTEL &&
        expense.hotelItemization &&
        expense.hotelItemization.length > 0) {
      const totalNights = expense.hotelItemization.length;

      // Expand hotel into nightly rows with itemized charges
      expense.hotelItemization.forEach((night, nightIndex) => {
        const nightLabel = `Night ${nightIndex + 1} of ${totalNights}`;
        const hasItemizedCharges = night.serviceCharge > 0 || night.roomTax > 0;

        if (hasItemizedCharges) {
          // Has itemized charges - create separate rows for each charge type

          // Room Charges row
          if (night.roomRate > 0) {
            expandedRows.push({
              ...expense,
              date: night.nightDate || expense.date,
              description: `${expense.vendor} - ${nightLabel}: Room Charges`,
              amount: roundTo2Decimals(night.roomRate),
              total: roundTo2Decimals(night.roomRate),
              isHotelNight: true,
              chargeType: 'room'
            });
          }

          // Service Charges row
          if (night.serviceCharge > 0) {
            expandedRows.push({
              ...expense,
              date: night.nightDate || expense.date,
              description: `${expense.vendor} - ${nightLabel}: Service Charges`,
              amount: roundTo2Decimals(night.serviceCharge),
              total: roundTo2Decimals(night.serviceCharge),
              isHotelNight: true,
              chargeType: 'service'
            });
          }

          // Taxes row
          if (night.roomTax > 0) {
            expandedRows.push({
              ...expense,
              date: night.nightDate || expense.date,
              description: `${expense.vendor} - ${nightLabel}: Taxes`,
              amount: roundTo2Decimals(night.roomTax),
              total: roundTo2Decimals(night.roomTax),
              isHotelNight: true,
              chargeType: 'tax'
            });
          }

          // Resort Fee row (if applicable)
          if (night.resortFee > 0) {
            expandedRows.push({
              ...expense,
              date: night.nightDate || expense.date,
              description: `${expense.vendor} - ${nightLabel}: Resort Fee`,
              amount: roundTo2Decimals(night.resortFee),
              total: roundTo2Decimals(night.resortFee),
              isHotelNight: true,
              chargeType: 'resort'
            });
          }

          // Parking Fee row (if applicable)
          if (night.parkingFee > 0) {
            expandedRows.push({
              ...expense,
              date: night.nightDate || expense.date,
              description: `${expense.vendor} - ${nightLabel}: Parking Fee`,
              amount: roundTo2Decimals(night.parkingFee),
              total: roundTo2Decimals(night.parkingFee),
              isHotelNight: true,
              chargeType: 'parking'
            });
          }

          // Other Fees row (if applicable)
          if (night.otherFees > 0) {
            expandedRows.push({
              ...expense,
              date: night.nightDate || expense.date,
              description: `${expense.vendor} - ${nightLabel}: Other Fees`,
              amount: roundTo2Decimals(night.otherFees),
              total: roundTo2Decimals(night.otherFees),
              isHotelNight: true,
              chargeType: 'other'
            });
          }
        } else {
          // No itemized charges - just show Accommodation
          expandedRows.push({
            ...expense,
            date: night.nightDate || expense.date,
            description: `${expense.vendor} - ${nightLabel}: Accommodation`,
            amount: roundTo2Decimals(night.roomRate || night.dailyTotal || 0),
            total: roundTo2Decimals(night.dailyTotal || night.roomRate || 0),
            isHotelNight: true,
            chargeType: 'accommodation'
          });
        }
      });
    } else {
      // Regular expense - add as single row
      expandedRows.push({
        ...expense,
        isHotelNight: false
      });
    }
  });

  return expandedRows;
}

/**
 * Find the footer section in the template using ExcelJS worksheet
 * Returns the 1-indexed row where footer starts, or -1 if not found
 */
function findFooterSectionExcelJS(worksheet, headerRowIndex, totalRows) {
  const footerKeywords = ['employee name', 'signature', 'approved by', 'approver', 'authorization', 'verified by', 'total expenses', 'grand total'];

  // Start searching from a few rows after header (headerRowIndex is 1-indexed)
  const searchStart = headerRowIndex + 3;

  for (let row = searchStart; row <= totalRows; row++) {
    // Check cells in this row for footer keywords
    for (let col = 1; col <= 10; col++) {
      const cell = worksheet.getCell(row, col);
      if (cell && cell.value) {
        const cellValue = String(cell.value).toLowerCase().trim();
        for (const keyword of footerKeywords) {
          if (cellValue.includes(keyword)) {
            console.log(`Found footer keyword "${keyword}" at row ${row}, col ${col}`);
            return row;
          }
        }
      }
    }
  }

  return -1; // No footer found
}

/**
 * Populate claim info fields in header and footer sections
 * Looks for cells containing keywords like "Employee Name:", "Position:", "Title:", etc.
 * and fills in the adjacent cell with the corresponding value
 */
function populateClaimInfoFields(worksheet, headerRow, totalRows, claimInfo) {
  console.log('=== Populating Claim Info Fields ===');

  // Define field mappings: keyword patterns -> claimInfo field
  // Note: Manager/Approver section fields and generic "Name:" are handled specially
  const fieldMappings = [
    { patterns: ['employee name', 'employee:', 'claimant name', 'claimant:'], field: 'employeeName', label: 'Employee Name' },
    { patterns: ['position', 'job title', 'title:', 'designation'], field: 'jobPosition', label: 'Job Position' },
    { patterns: ['department', 'dept', 'division'], field: 'department', label: 'Department' },
    { patterns: ['expense title', 'claim title', 'report title', 'title of expense'], field: 'expenseTitle', label: 'Expense Title' },
    { patterns: ['purpose', 'business purpose', 'trip purpose', 'reason'], field: 'businessPurpose', label: 'Business Purpose' },
    { patterns: ['submission date', 'date submitted', 'claim date', 'date:'], field: 'submissionDate', label: 'Submission Date' },
  ];

  // Track Manager/Approver section locations (row, column) for context-aware field filling
  const managerSectionLocations = [];

  // Helper function to check if a row/col is in the Manager/Approver section
  // (within 3 rows below a Manager/Approver label, same or adjacent column)
  const isInManagerSection = (rowNum, colNumber) => {
    for (const loc of managerSectionLocations) {
      if (rowNum > loc.row && rowNum <= loc.row + 3 && Math.abs(colNumber - loc.col) <= 2) {
        return true;
      }
    }
    return false;
  };

  // Helper function to fill a cell with proper handling
  const fillCell = (rowNum, colNumber, cellValue, value, label, isFooter = false) => {
    const nextCell = worksheet.getCell(rowNum, colNumber + 1);
    const section = isFooter ? 'footer ' : '';

    if (cellValue.endsWith(':') || !nextCell.value) {
      // Fill the next cell
      nextCell.value = value;
      console.log(`Filled ${label} at ${section}row ${rowNum}, col ${colNumber + 1}: "${value}"`);
    }
  };

  // First pass: Find Manager/Approver section labels and fill name UNDERNEATH
  const scanForManagerSection = (startRow, endRow, isFooter = false) => {
    for (let rowNum = startRow; rowNum <= endRow; rowNum++) {
      const row = worksheet.getRow(rowNum);
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const cellValue = cell.value ? String(cell.value).toLowerCase().trim() : '';

        // Check for Manager/Approver labels
        const managerPatterns = ['manager/approver', 'manager / approver', 'manager', 'approver', 'approved by', 'supervisor', 'reporting to'];
        for (const pattern of managerPatterns) {
          if (cellValue.includes(pattern)) {
            // Record this location
            managerSectionLocations.push({ row: rowNum, col: colNumber });
            console.log(`Found Manager/Approver section at row ${rowNum}, col ${colNumber}: "${cellValue}"`);

            // Fill name in the row BELOW, same column
            if (claimInfo.approverName) {
              const belowCell = worksheet.getCell(rowNum + 1, colNumber);
              // Only fill if the cell below is empty or contains a placeholder
              const belowValue = belowCell.value ? String(belowCell.value).trim() : '';
              if (!belowValue || belowValue === '' || belowValue.startsWith('[') || belowValue.startsWith('_')) {
                belowCell.value = claimInfo.approverName;
                console.log(`Filled Approver Name BELOW at row ${rowNum + 1}, col ${colNumber}: "${claimInfo.approverName}"`);
              }
            }
            return;
          }
        }
      });
    }
  };

  // Scan header and footer for Manager/Approver sections first
  scanForManagerSection(1, headerRow - 1, false);
  scanForManagerSection(headerRow + 1, totalRows, true);

  // Second pass: Fill other fields, with context-aware handling for Position and Name
  const scanAndFillFields = (startRow, endRow, isFooter = false) => {
    for (let rowNum = startRow; rowNum <= endRow; rowNum++) {
      const row = worksheet.getRow(rowNum);
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const cellValue = cell.value ? String(cell.value).toLowerCase().trim() : '';

        // Special handling for generic "Name:" field - context-aware
        // If it's in Manager/Approver section, use approverName; otherwise use employeeName
        if ((cellValue === 'name:' || cellValue === 'name') &&
            !cellValue.includes('employee') && !cellValue.includes('claimant')) {
          const inManagerSection = isInManagerSection(rowNum, colNumber);
          const fieldToUse = inManagerSection ? 'approverName' : 'employeeName';
          const labelToUse = inManagerSection ? 'Approver Name' : 'Employee Name';
          const value = claimInfo[fieldToUse];

          if (value) {
            console.log(`Name field at row ${rowNum} is ${inManagerSection ? 'IN' : 'NOT in'} Manager section, using ${fieldToUse}`);
            fillCell(rowNum, colNumber, cellValue, value, labelToUse, isFooter);
          }
          return;
        }

        // Special handling for Position field - context-aware
        const positionPatterns = ['position', 'job title', 'title:', 'designation'];
        for (const pattern of positionPatterns) {
          if (cellValue.includes(pattern) && !cellValue.includes('approver') && !cellValue.includes('manager')) {
            // Check if this Position is in the Manager/Approver section
            const inManagerSection = isInManagerSection(rowNum, colNumber);
            const fieldToUse = inManagerSection ? 'approverTitle' : 'jobPosition';
            const labelToUse = inManagerSection ? 'Approver Title' : 'Job Position';
            const value = claimInfo[fieldToUse];

            if (value) {
              console.log(`Position field at row ${rowNum} is ${inManagerSection ? 'IN' : 'NOT in'} Manager section, using ${fieldToUse}`);
              fillCell(rowNum, colNumber, cellValue, value, labelToUse, isFooter);
            }
            return;
          }
        }

        // Handle other standard field mappings
        for (const mapping of fieldMappings) {
          // Skip position patterns as they're handled above
          if (mapping.field === 'jobPosition') continue;

          for (const pattern of mapping.patterns) {
            if (cellValue.includes(pattern)) {
              const value = claimInfo[mapping.field];
              if (value) {
                fillCell(rowNum, colNumber, cellValue, value, mapping.label, isFooter);
              }
              return;
            }
          }
        }
      });
    }
  };

  // Fill fields in header and footer sections
  scanAndFillFields(1, headerRow - 1, false);
  scanAndFillFields(headerRow + 1, totalRows, true);
}

/**
 * Find the TOTAL row in the template data area
 * Returns the 1-indexed row number where TOTAL is found, or -1 if not found
 */
function findTotalRowExcelJS(worksheet, headerRowIndex, totalRows) {
  // Search for "TOTAL" in the first few columns of each row after header
  for (let row = headerRowIndex + 1; row <= totalRows; row++) {
    for (let col = 1; col <= 5; col++) {
      const cell = worksheet.getCell(row, col);
      if (cell && cell.value) {
        const cellValue = String(cell.value).toUpperCase().trim();
        // Match "TOTAL" but not "TOTAL EXPENSES" or "GRAND TOTAL" (those are footer)
        if (cellValue === 'TOTAL' || cellValue === 'TOTAL:') {
          console.log(`Found TOTAL row at row ${row}, col ${col}`);
          return row;
        }
      }
    }
  }
  return -1; // No TOTAL row found
}

/**
 * Populate the original company template with expense data using ExcelJS
 * Preserves original formatting, structure, TOTAL row, and footer section
 */
async function populateOriginalTemplateExcelJS(expenses, companyTemplate, claimInfo = null) {
  console.log('=== Populating Original Template with ExcelJS ===');
  console.log('Template name:', companyTemplate.name);
  console.log('Header row index (0-indexed):', companyTemplate.headerRowIndex);
  console.log('Columns:', companyTemplate.columns);
  console.log('Claim info:', claimInfo);

  // Decode base64 content back to ArrayBuffer
  const binaryString = atob(companyTemplate.fileContent);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Load the workbook with ExcelJS
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes.buffer);

  // Get the first worksheet
  const worksheet = workbook.worksheets[0];
  console.log('First sheet name:', worksheet.name);

  // ExcelJS uses 1-indexed rows, so convert headerRowIndex
  const headerRow = (companyTemplate.headerRowIndex || 0) + 1; // 1-indexed
  const dataStartRow = headerRow + 1; // Row after header

  // Get total rows
  const totalRows = worksheet.rowCount;
  console.log('Total rows in template:', totalRows);

  // Populate claim info fields in header/footer sections
  if (claimInfo) {
    populateClaimInfoFields(worksheet, headerRow, totalRows, claimInfo);
  }

  // Find TOTAL row to preserve it (before finding footer)
  const totalRowIndex = findTotalRowExcelJS(worksheet, headerRow, totalRows);
  console.log('TOTAL row found at row:', totalRowIndex >= 0 ? totalRowIndex : 'Not found');

  // Find footer section to preserve it
  const footerRowIndex = findFooterSectionExcelJS(worksheet, headerRow, totalRows);
  console.log('Footer section starts at row:', footerRowIndex >= 0 ? footerRowIndex : 'Not found');

  // Calculate available data rows (excluding TOTAL row and footer)
  let maxDataRows;
  if (totalRowIndex >= 0) {
    // TOTAL row exists - data rows are between header and TOTAL row
    maxDataRows = totalRowIndex - dataStartRow;
  } else if (footerRowIndex >= 0) {
    // No TOTAL row, but footer exists - leave one row before footer
    maxDataRows = footerRowIndex - dataStartRow - 1;
  } else {
    // No footer found, use reasonable default (30 rows for data)
    maxDataRows = 30;
  }

  console.log('Available data rows:', maxDataRows);

  // Expand hotel expenses into nightly rows first
  const expandedExpenses = expandExpensesForExport(expenses);
  console.log('Expenses after expansion:', expandedExpenses.length);

  // Sort ALL expanded expenses chronologically by date (earliest first)
  // This ensures hotel nights are interleaved with other expenses by date
  expandedExpenses.sort((a, b) => {
    const dateA = new Date(a.date || '1900-01-01');
    const dateB = new Date(b.date || '1900-01-01');
    return dateA - dateB;
  });
  console.log('Expenses sorted by date');

  // Get column mapping from template columns to actual Excel columns
  const columnIndices = [];
  const headerRowObj = worksheet.getRow(headerRow);

  // Find the actual column indices for each template column
  let templateColIndex = 0;
  headerRowObj.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const cellValue = cell.value ? String(cell.value).trim() : '';
    if (cellValue && templateColIndex < companyTemplate.columns.length) {
      if (cellValue === companyTemplate.columns[templateColIndex]) {
        columnIndices.push(colNumber);
        templateColIndex++;
      }
    }
  });

  // If we didn't find all columns, fall back to sequential columns starting from column 1
  if (columnIndices.length !== companyTemplate.columns.length) {
    console.log('Column mapping incomplete, using sequential columns');
    columnIndices.length = 0;
    for (let i = 0; i < companyTemplate.columns.length; i++) {
      columnIndices.push(i + 1);
    }
  }

  console.log('Column indices:', columnIndices);

  // Determine where to stop clearing data (exclude TOTAL row and footer)
  let dataEndRow;
  if (totalRowIndex >= 0) {
    // Stop one row before TOTAL row
    dataEndRow = totalRowIndex - 1;
  } else if (footerRowIndex >= 0) {
    dataEndRow = footerRowIndex - 2;
  } else {
    dataEndRow = dataStartRow + maxDataRows - 1;
  }

  // Clear only the data area cells (between header and TOTAL/footer)
  for (let row = dataStartRow; row <= dataEndRow; row++) {
    for (const colIndex of columnIndices) {
      const cell = worksheet.getCell(row, colIndex);
      // Clear value but preserve style
      cell.value = null;
    }
  }

  // Insert expense data rows
  const rowsToInsert = Math.min(expandedExpenses.length, maxDataRows);
  if (expandedExpenses.length > maxDataRows) {
    console.warn(`Warning: Only ${maxDataRows} rows available, but ${expandedExpenses.length} rows to insert`);
  }

  // Collect unique currencies and fetch exchange rates from backend
  const currencyList = expandedExpenses.map(e => e.currency).filter(Boolean);
  console.log('Currencies found:', currencyList);

  const { rates: exchangeRates, source: rateSource } = await fetchExchangeRates(currencyList);
  console.log('Exchange rates source:', rateSource);

  for (let expenseIndex = 0; expenseIndex < rowsToInsert; expenseIndex++) {
    const expense = expandedExpenses[expenseIndex];
    const rowIndex = dataStartRow + expenseIndex;

    // Get the local currency (original currency from receipt, before any conversion)
    // Priority: currencyConversion.originalCurrency > originalCurrency > currency > 'SGD'
    // This ensures Amount (Local) shows the ACTUAL receipt currency, not the reimbursement currency
    const localCurrency = (
      expense.currencyConversion?.originalCurrency ||
      expense.originalCurrency ||  // Direct field if exists
      expense.currency ||
      'SGD'
    ).toUpperCase();
    const exchangeRate = exchangeRates[localCurrency] || 1;
    const isSGD = localCurrency === 'SGD';

    // Debug: Log currency info for EVERY expense to trace the issue
    console.log(`[Expense ${expenseIndex + 1}] ${expense.vendor || expense.description}:`, {
      'expense.currency': expense.currency,
      'expense.originalCurrency': expense.originalCurrency,
      'expense.currencyConversion': expense.currencyConversion,
      'detected localCurrency': localCurrency,
      'isSGD': isSGD,
      'category': expense.category
    });

    // Log for first row to debug column mapping
    if (expenseIndex === 0) {
      console.log('Template columns:', companyTemplate.columns);
    }

    companyTemplate.columns.forEach((colName, idx) => {
      const colIndex = columnIndices[idx];
      const cell = worksheet.getCell(rowIndex, colIndex);
      const normalizedColName = colName.toLowerCase().trim();

      // Get the value for this column with special handling
      let value = getExpenseValueForColumn(expense, colName);

      // Special handling for Amount (Local) - show original currency as numeric with currency format
      if (normalizedColName.includes('amount') && normalizedColName.includes('local')) {
        const localAmount = expense.amount || expense.total || 0;
        // Get currency configuration (decimals vary by currency - JPY=0, KWD=3, most=2)
        const currencyConfig = CURRENCY_FORMATS[localCurrency];
        const decimals = currencyConfig?.decimals ?? 2; // Default to 2 decimals for unknown currencies
        // Round to correct number of decimals for this currency
        const roundedAmount = decimals === 0 ? Math.round(localAmount) :
          Math.round(localAmount * Math.pow(10, decimals)) / Math.pow(10, decimals);

        // Debug: Log original cell format BEFORE we change it
        const originalFormat = cell.numFmt;

        cell.value = roundedAmount;
        // Apply currency number format based on local currency
        const currencyFormat = currencyConfig?.format ||
          (decimals === 0 ? `"${localCurrency} "#,##0` : `"${localCurrency} "#,##0.${'0'.repeat(decimals)}`);

        // ExcelJS sometimes requires setting via style object to properly override template format
        cell.style = {
          ...cell.style,
          numFmt: currencyFormat
        };
        // Also set directly as backup
        cell.numFmt = currencyFormat;

        // Debug: Log the currency format being applied
        console.log(`[Amount Local] Row ${rowIndex}: ${expense.vendor || expense.description}`, {
          localCurrency,
          localAmount,
          roundedAmount,
          originalFormat,
          currencyConfig,
          newFormat: currencyFormat,
          'cell.numFmt after set': cell.numFmt,
          'cell.style.numFmt': cell.style?.numFmt
        });

        value = null; // Skip the default value assignment below
      }
      // Special handling for Conversion Rate / Exchange Rate column
      // Matches: "Conversion Rate", "Conv Rate", "Exchange Rate", "Rate", "Conv. Rate", "FX Rate"
      else if (
        (normalizedColName.includes('conversion') && normalizedColName.includes('rate')) ||
        (normalizedColName.includes('exchange') && normalizedColName.includes('rate')) ||
        (normalizedColName.includes('conv') && normalizedColName.includes('rate')) ||
        (normalizedColName.includes('fx') && normalizedColName.includes('rate')) ||
        (normalizedColName === 'rate')
      ) {
        // Only show rate if local currency is different from SGD
        if (isSGD) {
          value = ''; // No conversion needed for SGD
        } else {
          value = roundTo2Decimals(exchangeRate).toFixed(2); // Show 2 decimal places for rate
        }
        if (expenseIndex === 0) {
          console.log(`Conversion Rate column "${colName}" detected, value:`, value);
        }
      }
      // Special handling for Amount (Reimbursed) - show SGD converted amount as numeric with currency format
      else if (normalizedColName.includes('amount') && normalizedColName.includes('reimburs')) {
        const localAmount = expense.amount || expense.total || 0;
        // If already SGD, use the same value; otherwise convert
        const reimbursedAmount = isSGD ? localAmount : (localAmount * exchangeRate);
        // Set as numeric value (not string) so Excel can sum it
        cell.value = roundTo2Decimals(reimbursedAmount);
        // Apply SGD currency number format
        cell.numFmt = '"SGD "#,##0.00';
        value = null; // Skip the default value assignment below
      }

      // Set cell value
      if (value !== '' && value !== null && value !== undefined) {
        cell.value = value;
      }

      // Apply alignment and indent
      const existingAlignment = cell.alignment || {};

      // Description column - left align with indent
      if (normalizedColName.includes('description') || normalizedColName.includes('details')) {
        cell.alignment = {
          ...existingAlignment,
          horizontal: 'left',
          indent: 1
        };
      }
      // Amount (Reimbursed) column - right align, vertically centered, with indent
      else if (normalizedColName.includes('amount') && normalizedColName.includes('reimburs')) {
        cell.alignment = {
          ...existingAlignment,
          horizontal: 'right',
          vertical: 'middle',
          indent: 1
        };
      }
      // Date, Expense Type, Amount (Local) columns - add indent
      else if (normalizedColName.includes('date') ||
               normalizedColName.includes('expense type') ||
               normalizedColName.includes('type') ||
               normalizedColName.includes('amount')) {
        cell.alignment = {
          ...existingAlignment,
          indent: 1
        };
      }
    });
  }

  console.log('Populated', rowsToInsert, 'expense rows starting at row', dataStartRow);

  // Populate TOTAL row with Amount (Reimbursed) sum only
  // Note: Amount (Local) is not summed because expenses may have different currencies
  if (totalRowIndex >= 0) {
    console.log('=== Populating TOTAL row at row', totalRowIndex, '===');

    // Find Amount (Reimbursed) column index
    let amountReimbursedColIndex = -1;

    companyTemplate.columns.forEach((colName, idx) => {
      const normalizedColName = colName.toLowerCase().trim();
      if (normalizedColName.includes('amount') && normalizedColName.includes('reimburs')) {
        amountReimbursedColIndex = columnIndices[idx];
        console.log(`Found Amount (Reimbursed) column at index ${amountReimbursedColIndex}`);
      }
    });

    // Calculate sum for Amount (Reimbursed) only - all converted to SGD
    let sumReimbursed = 0;

    for (let i = 0; i < rowsToInsert; i++) {
      const expense = expandedExpenses[i];
      const localCurrency = (expense.currency || 'SGD').toUpperCase();
      const exchangeRate = exchangeRates[localCurrency] || 1;
      const isSGD = localCurrency === 'SGD';

      const localAmount = expense.amount || expense.total || 0;
      // Reimbursed amount: if already SGD use same value, otherwise convert
      const reimbursedAmount = isSGD ? localAmount : (localAmount * exchangeRate);
      sumReimbursed += roundTo2Decimals(reimbursedAmount);
    }

    // Round final sum
    sumReimbursed = roundTo2Decimals(sumReimbursed);
    console.log(`Total Amount (Reimbursed): ${sumReimbursed}`);

    // Populate the TOTAL row cell for Amount (Reimbursed)
    if (amountReimbursedColIndex >= 0) {
      const totalReimbursedCell = worksheet.getCell(totalRowIndex, amountReimbursedColIndex);
      // Set as numeric value with SGD currency format (so Excel can verify the sum)
      totalReimbursedCell.value = sumReimbursed;
      totalReimbursedCell.numFmt = '"SGD "#,##0.00';
      // Right align, vertically centered, with indent
      totalReimbursedCell.alignment = {
        horizontal: 'right',
        vertical: 'middle',
        indent: 1
      };
      console.log(`Set TOTAL Amount (Reimbursed) cell to: ${sumReimbursed} (with SGD format)`);
    }
  }

  // Generate the output buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

/**
 * Export expenses to Excel spreadsheet matching company template
 * Optionally bundles with receipts PDF in a zip file
 * Now async to support ExcelJS
 */
export async function exportToExcel(expenses, filename = 'expense_report', claimInfo = null, companyTemplate = null, uploadedReceipts = null) {
  console.log('=== exportToExcel called ===');
  console.log('Expenses count:', expenses.length);
  console.log('Company template:', companyTemplate);
  console.log('Has fileContent:', companyTemplate?.fileContent ? 'YES (length: ' + companyTemplate.fileContent.length + ')' : 'NO');
  console.log('Has columns:', companyTemplate?.columns ? 'YES (' + companyTemplate.columns.length + ' columns)' : 'NO');
  console.log('Uploaded receipts:', uploadedReceipts?.length || 0);

  // Get employee name for file naming
  const employeeName = claimInfo?.employeeName || '';

  // Generate filenames with employee name prefix and date stamp
  const excelFilename = generateFileName('ExpenseReport', employeeName, 'xlsx');
  const receiptsFilename = generateFileName('Receipts', employeeName, 'pdf');
  const zipFilename = generateFileName('ExpenseClaim', employeeName, 'zip');

  const usingOriginalTemplate = companyTemplate && companyTemplate.fileContent;
  let excelBuffer = null;

  // If company template exists with original file content, use ExcelJS for full style preservation
  if (usingOriginalTemplate && companyTemplate.columns && companyTemplate.columns.length > 0) {
    console.log('>>> Using ExcelJS populateOriginalTemplate - filling original template with full style preservation');

    try {
      excelBuffer = await populateOriginalTemplateExcelJS(expenses, companyTemplate, claimInfo);
    } catch (error) {
      console.error('ExcelJS template population failed:', error);
      console.log('Falling back to xlsx library...');
      // Fall through to xlsx fallback
    }
  }

  // Fallback to xlsx library for non-template exports or if ExcelJS fails
  if (!excelBuffer) {
    let workbook = XLSX.utils.book_new();

    if (companyTemplate && companyTemplate.columns && companyTemplate.columns.length > 0) {
      console.log('>>> Using createTemplateBasedSheet - template columns only');
      const templateData = createTemplateBasedSheet(expenses, companyTemplate);
      const templateSheet = XLSX.utils.json_to_sheet(templateData, { header: companyTemplate.columns });
      styleSheet(templateSheet, templateData);
      XLSX.utils.book_append_sheet(workbook, templateSheet, 'Expense Report');
    } else {
      console.log('>>> Using default format - no template');
      const summaryData = createSummarySheet(expenses);
      const summarySheet = XLSX.utils.json_to_sheet(summaryData);
      styleSheet(summarySheet, summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Expense Summary');
    }

    // Add additional sheets for non-template exports
    if (!usingOriginalTemplate) {
      // Hotel itemization sheet (if any hotel expenses)
      const hotelExpenses = expenses.filter(e => e.category === EXPENSE_CATEGORIES.HOTEL);
      if (hotelExpenses.length > 0) {
        const hotelData = createHotelItemizationSheet(hotelExpenses);
        const hotelSheet = XLSX.utils.json_to_sheet(hotelData);
        styleSheet(hotelSheet, hotelData);
        XLSX.utils.book_append_sheet(workbook, hotelSheet, 'Hotel Itemization');
      }

      // Meals with companions sheet (if any meals over $25)
      const mealsWithCompanions = expenses.filter(
        e => e.category === EXPENSE_CATEGORIES.MEAL && e.total > 25
      );
      if (mealsWithCompanions.length > 0) {
        const mealsData = createMealsCompanionSheet(mealsWithCompanions);
        const mealsSheet = XLSX.utils.json_to_sheet(mealsData);
        styleSheet(mealsSheet, mealsData);
        XLSX.utils.book_append_sheet(workbook, mealsSheet, 'Meals Entertainment');
      }
    }

    // Get Excel as buffer
    excelBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  }

  // Check if we should create a zip bundle with receipts
  const hasReceipts = uploadedReceipts && uploadedReceipts.length > 0;

  if (hasReceipts) {
    console.log('Creating zip bundle with Excel and receipt files...');

    // Create zip file
    const zip = new JSZip();
    zip.file(excelFilename, excelBuffer);

    // Create a receipts folder in the zip
    const receiptsFolder = zip.folder('receipts');

    // Add each original receipt file to the zip
    let addedFiles = 0;
    uploadedReceipts.forEach((receipt, idx) => {
      if (receipt.base64) {
        try {
          // Extract raw base64 data (remove data URL prefix)
          const base64Data = receipt.base64.split(',')[1];
          if (base64Data) {
            // Use original filename, or generate one if not available
            const fileName = receipt.fileName || `receipt_${idx + 1}${getExtensionFromMimeType(receipt.fileType)}`;
            receiptsFolder.file(fileName, base64Data, { base64: true });
            console.log(`  Added to zip: receipts/${fileName}`);
            addedFiles++;
          }
        } catch (error) {
          console.error(`  Failed to add receipt ${idx + 1} to zip:`, error);
        }
      }
    });

    console.log(`Added ${addedFiles} receipt files to zip`);

    // Also create a receipts summary PDF with thumbnails for images
    const receiptsPdfBuffer = await createReceiptsPDF(uploadedReceipts, employeeName);
    if (receiptsPdfBuffer) {
      zip.file(receiptsFilename, receiptsPdfBuffer);
      console.log(`  Added receipts summary PDF: ${receiptsFilename}`);
    }

    // Generate and download zip
    const zipContent = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(zipContent);
    link.download = zipFilename;
    link.click();
    URL.revokeObjectURL(link.href);

    console.log(`Exported zip bundle: ${zipFilename}`);
    console.log(`  - ${excelFilename}`);
    if (addedFiles > 0) {
      console.log(`  - receipts/ folder (${addedFiles} files)`);
    }
    if (receiptsPdfBuffer) {
      console.log(`  - ${receiptsFilename}`);
    }

    return zipFilename;
  } else {
    // No receipts - just download the Excel file
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = excelFilename;
    link.click();
    URL.revokeObjectURL(link.href);

    return excelFilename;
  }
}

/**
 * Create sheet data based on company template columns
 */
function createTemplateBasedSheet(expenses, template) {
  return expenses.map((expense) => {
    const row = {};
    template.columns.forEach(column => {
      row[column] = getExpenseValueForColumn(expense, column);
    });
    return row;
  });
}

/**
 * Create the main expense summary sheet data
 */
function createSummarySheet(expenses) {
  return expenses.map((expense) => ({
    [SPREADSHEET_COLUMNS.DATE]: expense.date,
    [SPREADSHEET_COLUMNS.CATEGORY]: EXPENSE_CATEGORY_LABELS[expense.category] || expense.category,
    [SPREADSHEET_COLUMNS.VENDOR]: expense.vendor,
    [SPREADSHEET_COLUMNS.DESCRIPTION]: expense.description || '',
    [SPREADSHEET_COLUMNS.AMOUNT]: expense.amount,
    [SPREADSHEET_COLUMNS.TAX]: expense.tax || 0,
    [SPREADSHEET_COLUMNS.TOTAL]: expense.total,
    [SPREADSHEET_COLUMNS.CURRENCY]: expense.currency || 'USD',
    [SPREADSHEET_COLUMNS.PAYMENT_METHOD]: expense.paymentMethod || '',
    [SPREADSHEET_COLUMNS.RECEIPT_NUMBER]: expense.receiptNumber || '',
    [SPREADSHEET_COLUMNS.COMPANION_NAME]: expense.companionName || '',
    [SPREADSHEET_COLUMNS.BUSINESS_PURPOSE]: expense.businessPurpose || '',
    [SPREADSHEET_COLUMNS.PROJECT_CODE]: expense.projectCode || '',
    [SPREADSHEET_COLUMNS.NOTES]: expense.notes || ''
  }));
}

/**
 * Create hotel itemization sheet with per-day breakdown
 */
function createHotelItemizationSheet(hotelExpenses) {
  const rows = [];

  hotelExpenses.forEach(expense => {
    // Add header row for this hotel stay
    rows.push({
      'Hotel Name': expense.vendor,
      [HOTEL_ITEMIZED_COLUMNS.CHECK_IN_DATE]: expense.checkInDate || expense.date,
      [HOTEL_ITEMIZED_COLUMNS.CHECK_OUT_DATE]: expense.checkOutDate || '',
      [HOTEL_ITEMIZED_COLUMNS.NIGHT_DATE]: '',
      [HOTEL_ITEMIZED_COLUMNS.ROOM_RATE]: '',
      [HOTEL_ITEMIZED_COLUMNS.ROOM_TAX]: '',
      [HOTEL_ITEMIZED_COLUMNS.SERVICE_CHARGE]: '',
      [HOTEL_ITEMIZED_COLUMNS.RESORT_FEE]: '',
      [HOTEL_ITEMIZED_COLUMNS.PARKING_FEE]: '',
      [HOTEL_ITEMIZED_COLUMNS.OTHER_FEES]: '',
      [HOTEL_ITEMIZED_COLUMNS.DAILY_TOTAL]: '',
      'Grand Total': expense.total
    });

    // Add itemized rows for each night
    if (expense.hotelItemization && expense.hotelItemization.length > 0) {
      expense.hotelItemization.forEach((item) => {
        rows.push({
          'Hotel Name': '',
          [HOTEL_ITEMIZED_COLUMNS.CHECK_IN_DATE]: '',
          [HOTEL_ITEMIZED_COLUMNS.CHECK_OUT_DATE]: '',
          [HOTEL_ITEMIZED_COLUMNS.NIGHT_DATE]: item.nightDate,
          [HOTEL_ITEMIZED_COLUMNS.ROOM_RATE]: item.roomRate,
          [HOTEL_ITEMIZED_COLUMNS.ROOM_TAX]: item.roomTax,
          [HOTEL_ITEMIZED_COLUMNS.SERVICE_CHARGE]: item.serviceCharge,
          [HOTEL_ITEMIZED_COLUMNS.RESORT_FEE]: item.resortFee,
          [HOTEL_ITEMIZED_COLUMNS.PARKING_FEE]: item.parkingFee,
          [HOTEL_ITEMIZED_COLUMNS.OTHER_FEES]: item.otherFees,
          [HOTEL_ITEMIZED_COLUMNS.DAILY_TOTAL]: item.dailyTotal,
          'Grand Total': ''
        });
      });
    }

    // Add empty row between hotel stays
    rows.push({});
  });

  return rows;
}

/**
 * Create meals/entertainment companion sheet
 */
function createMealsCompanionSheet(mealExpenses) {
  return mealExpenses.map(expense => ({
    [SPREADSHEET_COLUMNS.DATE]: expense.date,
    [SPREADSHEET_COLUMNS.VENDOR]: expense.vendor,
    'Restaurant/Location': expense.vendor,
    [SPREADSHEET_COLUMNS.TOTAL]: expense.total,
    [SPREADSHEET_COLUMNS.COMPANION_NAME]: expense.companionName || 'NOT PROVIDED',
    'Companion Title/Company': expense.companionTitle || '',
    'Number of Attendees': expense.attendeeCount || 1,
    [SPREADSHEET_COLUMNS.BUSINESS_PURPOSE]: expense.businessPurpose || '',
    'Discussion Topics': expense.discussionTopics || '',
    [SPREADSHEET_COLUMNS.RECEIPT_NUMBER]: expense.receiptNumber || ''
  }));
}

/**
 * Apply basic styling to worksheet
 */
function styleSheet(worksheet, data) {
  if (!data || data.length === 0) return;

  // Set column widths based on content
  const cols = Object.keys(data[0] || {});
  worksheet['!cols'] = cols.map(col => ({
    wch: Math.max(col.length, 15)
  }));
}

/**
 * Export expenses to CSV format
 */
export function exportToCSV(expenses, filename = 'expense_report', claimInfo = null) {
  const summaryData = createSummarySheet(expenses);
  const worksheet = XLSX.utils.json_to_sheet(summaryData);
  const csv = XLSX.utils.sheet_to_csv(worksheet);

  // Use employee name for file naming if available
  const employeeName = claimInfo?.employeeName || '';
  const fullFilename = generateFileName('ExpenseReport', employeeName, 'csv');

  // Create blob and download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fullFilename;
  link.click();

  return fullFilename;
}

/**
 * Generate expense report summary
 */
export function generateReportSummary(expenses) {
  const summary = {
    totalExpenses: expenses.length,
    totalAmount: 0,
    byCategory: {},
    byDate: {},
    requiresAttention: []
  };

  expenses.forEach(expense => {
    // Total amount
    summary.totalAmount += expense.total || 0;

    // By category
    const category = expense.category || EXPENSE_CATEGORIES.OTHER;
    if (!summary.byCategory[category]) {
      summary.byCategory[category] = {
        count: 0,
        total: 0,
        label: EXPENSE_CATEGORY_LABELS[category] || category
      };
    }
    summary.byCategory[category].count++;
    summary.byCategory[category].total += expense.total || 0;

    // By date
    const date = expense.date || 'Unknown';
    if (!summary.byDate[date]) {
      summary.byDate[date] = { count: 0, total: 0 };
    }
    summary.byDate[date].count++;
    summary.byDate[date].total += expense.total || 0;

    // Check for items requiring attention
    if (expense.category === EXPENSE_CATEGORIES.MEAL && expense.total > 25 && !expense.companionName) {
      summary.requiresAttention.push({
        expense,
        issue: 'Meal over $25 requires companion name'
      });
    }

    if (expense.category === EXPENSE_CATEGORIES.HOTEL &&
        (!expense.hotelItemization || expense.hotelItemization.length === 0)) {
      summary.requiresAttention.push({
        expense,
        issue: 'Hotel expense requires per-day itemization'
      });
    }
  });

  // Round all totals to 2 decimal places
  summary.totalAmount = roundTo2Decimals(summary.totalAmount);

  Object.keys(summary.byCategory).forEach(category => {
    summary.byCategory[category].total = roundTo2Decimals(summary.byCategory[category].total);
  });

  Object.keys(summary.byDate).forEach(date => {
    summary.byDate[date].total = roundTo2Decimals(summary.byDate[date].total);
  });

  return summary;
}
