import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { format } from 'date-fns';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  SPREADSHEET_COLUMNS,
  HOTEL_ITEMIZED_COLUMNS
} from '../constants/expenseTypes';

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
  'SGD': { symbol: 'S$', format: 'S$#,##0.00' },
  'USD': { symbol: 'US$', format: 'US$#,##0.00' },
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
 */
async function fetchExchangeRates(currencies) {
  // Filter out SGD and get unique currencies
  const uniqueCurrencies = [...new Set(
    currencies
      .map(c => c?.toUpperCase())
      .filter(c => c && c !== 'SGD')
  )];

  if (uniqueCurrencies.length === 0) {
    return { SGD: 1 };
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
      console.log('Exchange rates from backend:', data);
      return { SGD: 1, ...data.rates };
    }

    console.warn('Backend currency API failed, using fallback rates');
    return getFallbackRates(uniqueCurrencies);
  } catch (error) {
    console.error('Error fetching exchange rates:', error);
    return getFallbackRates(uniqueCurrencies);
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
 * Populate the original company template with expense data using ExcelJS
 * Preserves original formatting, structure, and footer section
 */
async function populateOriginalTemplateExcelJS(expenses, companyTemplate) {
  console.log('=== Populating Original Template with ExcelJS ===');
  console.log('Template name:', companyTemplate.name);
  console.log('Header row index (0-indexed):', companyTemplate.headerRowIndex);
  console.log('Columns:', companyTemplate.columns);

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

  // Find footer section to preserve it
  const footerRowIndex = findFooterSectionExcelJS(worksheet, headerRow, totalRows);
  console.log('Footer section starts at row:', footerRowIndex >= 0 ? footerRowIndex : 'Not found');

  // Calculate available data rows
  let maxDataRows;
  if (footerRowIndex >= 0) {
    // Leave at least one empty row before footer
    maxDataRows = footerRowIndex - dataStartRow - 1;
  } else {
    // No footer found, use reasonable default (30 rows for data)
    maxDataRows = 30;
  }

  console.log('Available data rows:', maxDataRows);

  // Sort expenses chronologically (earliest first)
  const sortedExpenses = [...expenses].sort((a, b) => {
    const dateA = new Date(a.date || '1900-01-01');
    const dateB = new Date(b.date || '1900-01-01');
    return dateA - dateB;
  });

  // Expand hotel expenses into nightly rows
  const expandedExpenses = expandExpensesForExport(sortedExpenses);
  console.log('Expenses after expansion:', expandedExpenses.length);

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

  // Clear only the data area cells (between header and footer)
  const dataEndRow = footerRowIndex >= 0 ? footerRowIndex - 2 : dataStartRow + maxDataRows - 1;
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

  const exchangeRates = await fetchExchangeRates(currencyList);
  console.log('Exchange rates:', exchangeRates);

  for (let expenseIndex = 0; expenseIndex < rowsToInsert; expenseIndex++) {
    const expense = expandedExpenses[expenseIndex];
    const rowIndex = dataStartRow + expenseIndex;

    // Get the local currency and exchange rate
    const localCurrency = (expense.currency || 'SGD').toUpperCase();
    const exchangeRate = exchangeRates[localCurrency] || 1;
    const isSGD = localCurrency === 'SGD';

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
      // Special handling for Amount (Reimbursed) - show S$ converted amount
      else if (normalizedColName.includes('amount') && normalizedColName.includes('reimburs')) {
        const localAmount = expense.amount || expense.total || 0;
        // If already SGD, use the same value; otherwise convert
        const reimbursedAmount = isSGD ? localAmount : (localAmount * exchangeRate);
        value = formatCurrencyValue(reimbursedAmount, 'SGD');
      }

      // Set cell value
      if (value !== '' && value !== null && value !== undefined) {
        cell.value = value;
      }

      // Apply alignment and indent
      const existingAlignment = cell.alignment || {};

      // Description column - left align
      if (normalizedColName.includes('description') || normalizedColName.includes('details')) {
        cell.alignment = {
          ...existingAlignment,
          horizontal: 'left',
          indent: 1
        };
      }
      // Date, Expense Type, Amount columns - add indent
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

  // Generate the output buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

/**
 * Export expenses to Excel spreadsheet matching company template
 * Now async to support ExcelJS
 */
export async function exportToExcel(expenses, filename = 'expense_report', claimInfo = null, companyTemplate = null) {
  console.log('=== exportToExcel called ===');
  console.log('Expenses count:', expenses.length);
  console.log('Company template:', companyTemplate);
  console.log('Has fileContent:', companyTemplate?.fileContent ? 'YES (length: ' + companyTemplate.fileContent.length + ')' : 'NO');
  console.log('Has columns:', companyTemplate?.columns ? 'YES (' + companyTemplate.columns.length + ' columns)' : 'NO');

  // Generate filename with date
  const dateStr = format(new Date(), 'yyyy-MM-dd');
  let fullFilename;
  const usingOriginalTemplate = companyTemplate && companyTemplate.fileContent;

  if (usingOriginalTemplate) {
    // Use original template name (without extension) + date
    const templateBaseName = companyTemplate.name.replace(/\.[^/.]+$/, ''); // Remove extension
    fullFilename = `${templateBaseName}_filled_${dateStr}.xlsx`;
  } else {
    fullFilename = `${filename}_${dateStr}.xlsx`;
  }

  // If company template exists with original file content, use ExcelJS for full style preservation
  if (usingOriginalTemplate && companyTemplate.columns && companyTemplate.columns.length > 0) {
    console.log('>>> Using ExcelJS populateOriginalTemplate - filling original template with full style preservation');

    try {
      const buffer = await populateOriginalTemplateExcelJS(expenses, companyTemplate);

      // Download the file
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fullFilename;
      link.click();
      URL.revokeObjectURL(link.href);

      return fullFilename;
    } catch (error) {
      console.error('ExcelJS template population failed:', error);
      console.log('Falling back to xlsx library...');
      // Fall through to xlsx fallback
    }
  }

  // Fallback to xlsx library for non-template exports or if ExcelJS fails
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

  // Write and download
  XLSX.writeFile(workbook, fullFilename);

  return fullFilename;
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
export function exportToCSV(expenses, filename = 'expense_report') {
  const summaryData = createSummarySheet(expenses);
  const worksheet = XLSX.utils.json_to_sheet(summaryData);
  const csv = XLSX.utils.sheet_to_csv(worksheet);

  const dateStr = format(new Date(), 'yyyy-MM-dd');
  const fullFilename = `${filename}_${dateStr}.csv`;

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
