import * as XLSX from 'xlsx';
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
      return expense.amount || expense.subtotal || 0;
    case 'tax':
      return expense.tax || 0;
    case 'total':
      return expense.total || 0;
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
 * Populate the original company template with expense data
 * Preserves original formatting and structure
 */
function populateOriginalTemplate(expenses, companyTemplate) {
  console.log('=== Populating Original Template ===');
  console.log('Template name:', companyTemplate.name);
  console.log('Header row index:', companyTemplate.headerRowIndex);
  console.log('Columns:', companyTemplate.columns);

  // Decode base64 content back to ArrayBuffer
  const binaryString = atob(companyTemplate.fileContent);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Load the original template workbook
  const workbook = XLSX.read(bytes.buffer, { type: 'array', cellStyles: true });

  // Get the first sheet
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  console.log('First sheet name:', firstSheetName);

  // Determine the header row (0-indexed for xlsx)
  const headerRowIndex = companyTemplate.headerRowIndex || 0;
  const dataStartRow = headerRowIndex + 2; // 1-indexed for xlsx (header is at headerRowIndex+1)

  // Get the range of the worksheet
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

  // Build column mapping: column letter -> expense field
  const columnMapping = {};
  companyTemplate.columns.forEach((colName, index) => {
    const colLetter = XLSX.utils.encode_col(index);
    columnMapping[colLetter] = colName;
  });

  console.log('Column mapping:', columnMapping);

  // Clear any existing data rows (below header) while preserving header and above
  const keysToDelete = [];
  for (const key of Object.keys(worksheet)) {
    if (key.startsWith('!')) continue; // Skip metadata keys
    const cellRef = XLSX.utils.decode_cell(key);
    if (cellRef.r > headerRowIndex) {
      keysToDelete.push(key);
    }
  }
  keysToDelete.forEach(key => delete worksheet[key]);

  // Insert expense data rows
  expenses.forEach((expense, expenseIndex) => {
    const rowNum = dataStartRow + expenseIndex; // 1-indexed row number for xlsx

    companyTemplate.columns.forEach((colName, colIndex) => {
      const colLetter = XLSX.utils.encode_col(colIndex);
      const cellAddress = `${colLetter}${rowNum}`;

      // Get the value for this column
      const value = getExpenseValueForColumn(expense, colName);

      // Set cell value
      if (value !== '' && value !== null && value !== undefined) {
        // Determine cell type
        if (typeof value === 'number') {
          worksheet[cellAddress] = { t: 'n', v: value };
        } else {
          worksheet[cellAddress] = { t: 's', v: String(value) };
        }
      }
    });
  });

  // Update the worksheet range to include new data
  const newEndRow = dataStartRow + expenses.length - 1;
  const newEndCol = companyTemplate.columns.length - 1;
  worksheet['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: Math.max(newEndRow - 1, range.e.r), c: Math.max(newEndCol, range.e.c) }
  });

  console.log('Updated worksheet range:', worksheet['!ref']);
  console.log('Populated', expenses.length, 'expense rows starting at row', dataStartRow);

  return workbook;
}

/**
 * Export expenses to Excel spreadsheet matching company template
 */
export function exportToExcel(expenses, filename = 'expense_report', claimInfo = null, companyTemplate = null) {
  let workbook;

  // If company template exists with original file content, populate it directly
  if (companyTemplate && companyTemplate.fileContent && companyTemplate.columns && companyTemplate.columns.length > 0) {
    workbook = populateOriginalTemplate(expenses, companyTemplate);
  } else if (companyTemplate && companyTemplate.columns && companyTemplate.columns.length > 0) {
    // Fallback: use column structure without original file
    workbook = XLSX.utils.book_new();
    const templateData = createTemplateBasedSheet(expenses, companyTemplate);
    const templateSheet = XLSX.utils.json_to_sheet(templateData, { header: companyTemplate.columns });
    styleSheet(templateSheet, templateData);
    XLSX.utils.book_append_sheet(workbook, templateSheet, 'Expense Report');
  } else {
    // Default: Main expense summary sheet
    workbook = XLSX.utils.book_new();
    const summaryData = createSummarySheet(expenses);
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    styleSheet(summarySheet, summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Expense Summary');
  }

  // Only add additional sheets if NOT using original template directly
  // (to preserve the original template structure)
  const usingOriginalTemplate = companyTemplate && companyTemplate.fileContent;

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

  // Generate filename with date
  const dateStr = format(new Date(), 'yyyy-MM-dd');
  let fullFilename;

  if (usingOriginalTemplate) {
    // Use original template name (without extension) + date
    const templateBaseName = companyTemplate.name.replace(/\.[^/.]+$/, ''); // Remove extension
    fullFilename = `${templateBaseName}_filled_${dateStr}.xlsx`;
  } else {
    fullFilename = `${filename}_${dateStr}.xlsx`;
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

  summary.totalAmount = Math.round(summary.totalAmount * 100) / 100;

  return summary;
}
