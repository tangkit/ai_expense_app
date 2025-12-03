import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
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
 * Create a PDF containing all uploaded receipts
 */
async function createReceiptsPDF(uploadedReceipts, employeeName) {
  console.log('=== createReceiptsPDF called ===');
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
      base64Length: r.base64?.length || 0,
      base64Preview: r.base64?.substring(0, 50)
    });
  });

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPosition = margin;

  // Title page
  doc.setFontSize(24);
  doc.setTextColor(33, 37, 41);
  doc.setFont('helvetica', 'bold');
  doc.text('EXPENSE RECEIPTS', pageWidth / 2, yPosition + 30, { align: 'center' });
  yPosition += 50;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);

  if (employeeName) {
    doc.text(`Employee: ${employeeName}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 10;
  }

  doc.text(`Total Receipts: ${uploadedReceipts.length}`, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 10;
  doc.text(`Generated: ${format(new Date(), 'MMMM d, yyyy')}`, pageWidth / 2, yPosition, { align: 'center' });

  // Sort receipts by upload date
  const sortedReceipts = [...uploadedReceipts].sort(
    (a, b) => new Date(a.uploadedAt) - new Date(b.uploadedAt)
  );

  // Add each receipt
  for (let i = 0; i < sortedReceipts.length; i++) {
    const receipt = sortedReceipts[i];
    console.log(`\n=== Processing receipt ${i + 1}/${sortedReceipts.length} ===`);
    console.log('  fileName:', receipt.fileName);
    console.log('  fileType:', receipt.fileType);
    console.log('  base64 exists:', !!receipt.base64);
    console.log('  base64 length:', receipt.base64?.length || 0);

    doc.addPage();
    yPosition = margin;

    // Receipt header
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(33, 37, 41);
    doc.text(`Receipt ${i + 1} of ${sortedReceipts.length}`, margin, yPosition);
    yPosition += 8;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`File: ${receipt.fileName}`, margin, yPosition);
    yPosition += 6;

    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    const uploadDate = receipt.uploadedAt ? format(new Date(receipt.uploadedAt), 'MMM d, yyyy h:mm a') : 'Unknown';
    doc.text(`Uploaded: ${uploadDate}`, margin, yPosition);
    yPosition += 15;

    // Draw separator line
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;

    // Check if we have base64 data
    if (!receipt.base64) {
      console.log('  ERROR: No base64 data for this receipt!');
      doc.setFillColor(254, 242, 242);
      doc.roundedRect(margin, yPosition, pageWidth - 2 * margin, 50, 3, 3, 'F');
      doc.setFontSize(10);
      doc.setTextColor(185, 28, 28);
      doc.text('Receipt image data not available', margin + 10, yPosition + 20);
      doc.setTextColor(107, 114, 128);
      doc.text('The receipt file was not properly stored.', margin + 10, yPosition + 35);
      continue;
    }

    // Check if it's an image based on data URL or file type
    const base64Start = receipt.base64.substring(0, 30).toLowerCase();
    const isImage = receipt.fileType?.startsWith('image/') ||
                    base64Start.includes('data:image');

    console.log('  base64 starts with:', base64Start);
    console.log('  isImage:', isImage);

    if (isImage) {
      try {
        const imgWidth = pageWidth - 2 * margin;
        const maxHeight = pageHeight - yPosition - margin - 20;

        // Detect format from data URL or file type
        let imgFormat = 'JPEG';
        if (base64Start.includes('data:image/png') || receipt.fileType === 'image/png') {
          imgFormat = 'PNG';
        } else if (base64Start.includes('data:image/gif') || receipt.fileType === 'image/gif') {
          imgFormat = 'GIF';
        } else if (base64Start.includes('data:image/webp') || receipt.fileType === 'image/webp') {
          imgFormat = 'WEBP';
        }

        console.log('  Using image format:', imgFormat);
        console.log('  Image dimensions: width=', imgWidth, 'maxHeight=', maxHeight);

        // Add the image (scaled to fit)
        doc.addImage(receipt.base64, imgFormat, margin, yPosition, imgWidth, Math.min(maxHeight, 180), undefined, 'MEDIUM');
        console.log('  SUCCESS: Image added to PDF');
      } catch (err) {
        console.error('  FAILED to embed receipt image:', err);
        console.error('  Error details:', err.message, err.stack);
        doc.setFillColor(254, 242, 242);
        doc.roundedRect(margin, yPosition, pageWidth - 2 * margin, 50, 3, 3, 'F');
        doc.setFontSize(10);
        doc.setTextColor(185, 28, 28);
        doc.text('[Image could not be embedded]', margin + 10, yPosition + 15);
        doc.setTextColor(107, 114, 128);
        doc.text(`Error: ${err.message}`, margin + 10, yPosition + 30);
        doc.text(`Format attempted: ${imgFormat || 'Unknown'}`, margin + 10, yPosition + 42);
      }
    } else {
      // For PDFs or unsupported formats, show info box
      console.log('  Not an image format, showing info box');
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin, yPosition, pageWidth - 2 * margin, 50, 3, 3, 'F');
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text(`File Name: ${receipt.fileName}`, margin + 10, yPosition + 15);
      doc.text(`File Type: ${receipt.fileType || 'Unknown'}`, margin + 10, yPosition + 28);
      doc.text('(Non-image files are listed but not embedded)', margin + 10, yPosition + 41);
    }
  }

  // Add page numbers
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
  }

  console.log('=== Receipts PDF created successfully ===');

  // Return as ArrayBuffer
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
  'MYR': { symbol: 'RM', format: 'RM#,##0.00' },
  'SGD': { symbol: 'SGD', format: 'SGD#,##0.00' },
  'USD': { symbol: 'USD', format: 'USD#,##0.00' },
  'EUR': { symbol: '€', format: '€#,##0.00' },
  'GBP': { symbol: '£', format: '£#,##0.00' },
  'JPY': { symbol: '¥', format: '¥#,##0' },
  'CNY': { symbol: '¥', format: '¥#,##0.00' },
  'THB': { symbol: '฿', format: '฿#,##0.00' },
  'IDR': { symbol: 'Rp', format: 'Rp#,##0' },
  'PHP': { symbol: '₱', format: '₱#,##0.00' },
  'VND': { symbol: '₫', format: '₫#,##0' },
  'KRW': { symbol: '₩', format: '₩#,##0' },
  'INR': { symbol: '₹', format: '₹#,##0.00' },
  'AUD': { symbol: 'A$', format: 'A$#,##0.00' },
  'NZD': { symbol: 'NZ$', format: 'NZ$#,##0.00' },
  'HKD': { symbol: 'HK$', format: 'HK$#,##0.00' },
  'TWD': { symbol: 'NT$', format: 'NT$#,##0.00' },
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
  const fieldMappings = [
    { patterns: ['employee name', 'name:', 'employee:'], field: 'employeeName', label: 'Employee Name' },
    { patterns: ['position', 'job title', 'title:', 'designation'], field: 'jobPosition', label: 'Job Position' },
    { patterns: ['department', 'dept', 'division'], field: 'department', label: 'Department' },
    { patterns: ['expense title', 'claim title', 'report title', 'title of expense'], field: 'expenseTitle', label: 'Expense Title' },
    { patterns: ['purpose', 'business purpose', 'trip purpose', 'reason'], field: 'businessPurpose', label: 'Business Purpose' },
    { patterns: ['submission date', 'date submitted', 'claim date', 'date:'], field: 'submissionDate', label: 'Submission Date' },
    { patterns: ['manager', 'approver', 'approved by', 'supervisor', 'reporting to'], field: 'approverName', label: 'Approver Name' },
    { patterns: ['approver title', "approver's title", "manager's title", 'approving officer'], field: 'approverTitle', label: 'Approver Title' },
  ];

  // Scan header section (rows before the data header)
  for (let rowNum = 1; rowNum < headerRow; rowNum++) {
    const row = worksheet.getRow(rowNum);
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const cellValue = cell.value ? String(cell.value).toLowerCase().trim() : '';

      for (const mapping of fieldMappings) {
        for (const pattern of mapping.patterns) {
          if (cellValue.includes(pattern)) {
            const value = claimInfo[mapping.field];
            if (value) {
              // Find the cell to fill - check if current cell ends with ":" or next cell
              const nextCell = worksheet.getCell(rowNum, colNumber + 1);

              if (cellValue.endsWith(':') || !nextCell.value) {
                // Fill the next cell
                nextCell.value = value;
                console.log(`Filled ${mapping.label} at row ${rowNum}, col ${colNumber + 1}: "${value}"`);
              } else {
                // Check if the cell itself should be replaced (e.g., "Employee Name: [value]")
                // In this case, append value after the label
                cell.value = `${cell.value} ${value}`;
                console.log(`Appended ${mapping.label} at row ${rowNum}, col ${colNumber}: "${value}"`);
              }
            }
            return; // Found match, move to next cell
          }
        }
      }
    });
  }

  // Also scan footer section (rows after data area)
  for (let rowNum = headerRow + 1; rowNum <= totalRows; rowNum++) {
    const row = worksheet.getRow(rowNum);
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const cellValue = cell.value ? String(cell.value).toLowerCase().trim() : '';

      for (const mapping of fieldMappings) {
        for (const pattern of mapping.patterns) {
          if (cellValue.includes(pattern)) {
            const value = claimInfo[mapping.field];
            if (value) {
              const nextCell = worksheet.getCell(rowNum, colNumber + 1);

              if (cellValue.endsWith(':') || !nextCell.value) {
                nextCell.value = value;
                console.log(`Filled ${mapping.label} at footer row ${rowNum}, col ${colNumber + 1}: "${value}"`);
              }
            }
            return;
          }
        }
      }
    });
  }
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

    // Get the local currency and exchange rate
    const localCurrency = (expense.currency || 'SGD').toUpperCase();
    const exchangeRate = exchangeRates[localCurrency] || 1;
    const isSGD = localCurrency === 'SGD';

    // Log for first row to debug column mapping
    if (expenseIndex === 0) {
      console.log('Template columns:', companyTemplate.columns);
      console.log('First expense currency:', localCurrency, 'isSGD:', isSGD, 'exchangeRate:', exchangeRate);
    }

    companyTemplate.columns.forEach((colName, idx) => {
      const colIndex = columnIndices[idx];
      const cell = worksheet.getCell(rowIndex, colIndex);
      const normalizedColName = colName.toLowerCase().trim();

      // Get the value for this column with special handling
      let value = getExpenseValueForColumn(expense, colName);

      // Special handling for Amount (Local) - show original currency
      if (normalizedColName.includes('amount') && normalizedColName.includes('local')) {
        const localAmount = expense.amount || expense.total || 0;
        value = formatCurrencyValue(localAmount, localCurrency);
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
      // Amount (Reimbursed) column - right align for numbers
      else if (normalizedColName.includes('amount') && normalizedColName.includes('reimburs')) {
        cell.alignment = {
          ...existingAlignment,
          horizontal: 'right'
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
      // Right align for numbers
      totalReimbursedCell.alignment = { horizontal: 'right' };
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
    console.log('Creating zip bundle with Excel and receipts PDF...');

    // Create receipts PDF
    const receiptsPdfBuffer = await createReceiptsPDF(uploadedReceipts, employeeName);

    // Create zip file
    const zip = new JSZip();
    zip.file(excelFilename, excelBuffer);

    if (receiptsPdfBuffer) {
      zip.file(receiptsFilename, receiptsPdfBuffer);
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
    console.log(`  - ${receiptsFilename}`);

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
