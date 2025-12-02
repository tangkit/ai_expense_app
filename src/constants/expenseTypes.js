// Expense category types for the expense claim system
export const EXPENSE_CATEGORIES = {
  TAXI: 'taxi',
  RIDESHARE: 'rideshare',
  HOTEL: 'hotel',
  FLIGHT: 'flight',
  MEAL: 'meal',
  PARKING: 'parking',
  TOLL: 'toll',
  PUBLIC_TRANSPORT: 'public_transport',
  CAR_RENTAL: 'car_rental',
  FUEL: 'fuel',
  CONFERENCE: 'conference',
  OFFICE_SUPPLIES: 'office_supplies',
  OTHER: 'other'
};

export const EXPENSE_CATEGORY_LABELS = {
  [EXPENSE_CATEGORIES.TAXI]: 'Taxi',
  [EXPENSE_CATEGORIES.RIDESHARE]: 'Rideshare (Uber/Lyft)',
  [EXPENSE_CATEGORIES.HOTEL]: 'Hotel Stay',
  [EXPENSE_CATEGORIES.FLIGHT]: 'Flight',
  [EXPENSE_CATEGORIES.MEAL]: 'Meal / Entertainment',
  [EXPENSE_CATEGORIES.PARKING]: 'Parking',
  [EXPENSE_CATEGORIES.TOLL]: 'Toll',
  [EXPENSE_CATEGORIES.PUBLIC_TRANSPORT]: 'Public Transport',
  [EXPENSE_CATEGORIES.CAR_RENTAL]: 'Car Rental',
  [EXPENSE_CATEGORIES.FUEL]: 'Fuel / Gas',
  [EXPENSE_CATEGORIES.CONFERENCE]: 'Conference / Registration',
  [EXPENSE_CATEGORIES.OFFICE_SUPPLIES]: 'Office Supplies',
  [EXPENSE_CATEGORIES.OTHER]: 'Other'
};

// Categories that require special handling
export const CATEGORIES_WITH_ITEMIZATION = [EXPENSE_CATEGORIES.HOTEL];
export const CATEGORIES_REQUIRING_COMPANION = [EXPENSE_CATEGORIES.MEAL];

// Threshold for requiring companion information for meals
export const MEAL_COMPANION_THRESHOLD = 25;

// Spreadsheet column mappings
export const SPREADSHEET_COLUMNS = {
  DATE: 'Date',
  CATEGORY: 'Category',
  VENDOR: 'Vendor/Merchant',
  DESCRIPTION: 'Description',
  AMOUNT: 'Amount',
  CURRENCY: 'Currency',
  TAX: 'Tax',
  TOTAL: 'Total',
  PAYMENT_METHOD: 'Payment Method',
  RECEIPT_NUMBER: 'Receipt/Invoice #',
  COMPANION_NAME: 'Companion/Customer Name',
  BUSINESS_PURPOSE: 'Business Purpose',
  PROJECT_CODE: 'Project Code',
  NOTES: 'Notes'
};

// Hotel-specific columns for itemized breakdown
export const HOTEL_ITEMIZED_COLUMNS = {
  CHECK_IN_DATE: 'Check-in Date',
  CHECK_OUT_DATE: 'Check-out Date',
  NIGHT_DATE: 'Night Date',
  ROOM_RATE: 'Room Rate',
  ROOM_TAX: 'Room Tax',
  SERVICE_CHARGE: 'Service Charge',
  RESORT_FEE: 'Resort Fee',
  PARKING_FEE: 'Parking Fee',
  OTHER_FEES: 'Other Fees',
  DAILY_TOTAL: 'Daily Total'
};
