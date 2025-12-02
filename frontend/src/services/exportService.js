import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  SPREADSHEET_COLUMNS,
  HOTEL_ITEMIZED_COLUMNS
} from '../constants/expenseTypes';

/**
 * Export expenses to Excel spreadsheet matching company template
 */
export function exportToExcel(expenses, filename = 'expense_report') {
  const workbook = XLSX.utils.book_new();

  // Main expense summary sheet
  const summaryData = createSummarySheet(expenses);
  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  styleSheet(summarySheet, summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Expense Summary');

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

  // Generate filename with date
  const dateStr = format(new Date(), 'yyyy-MM-dd');
  const fullFilename = `${filename}_${dateStr}.xlsx`;

  // Write and download
  XLSX.writeFile(workbook, fullFilename);

  return fullFilename;
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
