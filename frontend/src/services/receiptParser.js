import { EXPENSE_CATEGORIES } from '../constants/expenseTypes';
import { v4 as uuidv4 } from 'uuid';
import { format, addDays } from 'date-fns';
import { parseReceiptWithBackend, checkBackendHealth } from './api';

/**
 * Receipt parsing service with backend AI support.
 * Falls back to simulated parsing when backend is unavailable.
 */

// Cache backend availability status
let backendAvailable = null;
let lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

// Vendor patterns for category detection
const VENDOR_PATTERNS = {
  [EXPENSE_CATEGORIES.TAXI]: /taxi|yellow cab|checker cab|city cab/i,
  [EXPENSE_CATEGORIES.RIDESHARE]: /uber|lyft|via|grab|didi|bolt/i,
  [EXPENSE_CATEGORIES.HOTEL]: /hotel|inn|suites|resort|marriott|hilton|hyatt|sheraton|westin|holiday inn|hampton|courtyard|fairfield|residence inn|springhill|crowne plaza|intercontinental|doubletree|embassy suites|radisson|best western|motel/i,
  [EXPENSE_CATEGORIES.FLIGHT]: /airline|airways|flight|delta|united|american|southwest|jetblue|alaska|spirit|frontier|air canada|british airways|lufthansa|emirates/i,
  [EXPENSE_CATEGORIES.MEAL]: /restaurant|cafe|bistro|grill|kitchen|diner|pizzeria|steakhouse|sushi|thai|chinese|mexican|italian|indian|seafood|bar & grill|tavern|pub|coffee|starbucks|dunkin|mcdonald|wendy|burger|subway|chipotle|panera/i,
  [EXPENSE_CATEGORIES.PARKING]: /parking|garage|valet|park/i,
  [EXPENSE_CATEGORIES.TOLL]: /toll|e-zpass|fastrak|sunpass|i-pass/i,
  [EXPENSE_CATEGORIES.PUBLIC_TRANSPORT]: /metro|subway|bus|train|transit|amtrak|mta|bart|cta/i,
  [EXPENSE_CATEGORIES.CAR_RENTAL]: /hertz|avis|enterprise|budget|national|alamo|dollar|thrifty|sixt|car rental/i,
  [EXPENSE_CATEGORIES.FUEL]: /shell|chevron|exxon|mobil|bp|texaco|76|arco|costco gas|sams gas|fuel|gas station/i,
};

/**
 * Detect expense category from vendor name
 */
function detectCategory(vendorName) {
  for (const [category, pattern] of Object.entries(VENDOR_PATTERNS)) {
    if (pattern.test(vendorName)) {
      return category;
    }
  }
  return EXPENSE_CATEGORIES.OTHER;
}

/**
 * Extract amount from text using common patterns
 */
function extractAmount(text) {
  const patterns = [
    /total[:\s]*\$?([\d,]+\.?\d*)/i,
    /amount[:\s]*\$?([\d,]+\.?\d*)/i,
    /grand total[:\s]*\$?([\d,]+\.?\d*)/i,
    /\$\s*([\d,]+\.?\d*)/,
    /([\d,]+\.?\d*)\s*(?:USD|usd)/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return parseFloat(match[1].replace(',', ''));
    }
  }
  return null;
}

/**
 * Extract date from text
 */
function extractDate(text) {
  const patterns = [
    /(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/,
    /(\w+)\s+(\d{1,2}),?\s+(\d{4})/,
    /(\d{4})[/-](\d{1,2})[/-](\d{1,2})/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      try {
        const dateStr = match[0];
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          return format(date, 'yyyy-MM-dd');
        }
      } catch {
        // Continue to next pattern
      }
    }
  }
  return format(new Date(), 'yyyy-MM-dd');
}

/**
 * Generate hotel itemization for multi-night stays
 */
function generateHotelItemization(checkIn, checkOut, totalAmount, taxRate = 0.12, serviceFee = 0) {
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  const diffTime = checkOutDate.getTime() - checkInDate.getTime();
  const nights = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  // Calculate per-night breakdown
  const baseRoomRate = (totalAmount / nights) / (1 + taxRate + serviceFee / 100);
  const dailyItems = [];

  for (let i = 0; i < nights; i++) {
    const nightDate = addDays(checkInDate, i);
    const roomRate = Math.round(baseRoomRate * 100) / 100;
    const roomTax = Math.round(roomRate * taxRate * 100) / 100;
    const serviceCharge = Math.round(roomRate * (serviceFee / 100) * 100) / 100;
    const resortFee = i === 0 ? Math.round(Math.random() * 20 * 100) / 100 : 0; // Example one-time fee
    const dailyTotal = roomRate + roomTax + serviceCharge + resortFee;

    dailyItems.push({
      id: uuidv4(),
      nightDate: format(nightDate, 'yyyy-MM-dd'),
      roomRate,
      roomTax,
      serviceCharge,
      resortFee,
      parkingFee: 0,
      otherFees: 0,
      dailyTotal: Math.round(dailyTotal * 100) / 100
    });
  }

  return dailyItems;
}

/**
 * Check if backend is available (with caching)
 */
async function isBackendAvailable() {
  const now = Date.now();

  // Check cache first
  if (backendAvailable !== null && (now - lastHealthCheck) < HEALTH_CHECK_INTERVAL) {
    console.log('Using cached backend status:', backendAvailable);
    return backendAvailable;
  }

  console.log('Checking backend health...');
  try {
    backendAvailable = await checkBackendHealth();
    lastHealthCheck = now;
    console.log('Backend health check result:', backendAvailable);
    return backendAvailable;
  } catch (error) {
    console.error('Backend health check error:', error);
    backendAvailable = false;
    lastHealthCheck = now;
    return false;
  }
}

/**
 * Force reset backend availability cache (useful for debugging)
 */
export function resetBackendCache() {
  backendAvailable = null;
  lastHealthCheck = 0;
  console.log('Backend cache reset');
}

/**
 * Transform backend response to frontend format
 */
function transformBackendResponse(response, file) {
  if (!response.success || !response.expense) {
    return null;
  }

  const expense = response.expense;

  // Transform hotel itemization
  let hotelItemization = null;
  if (expense.hotel_itemization && expense.hotel_itemization.length > 0) {
    hotelItemization = expense.hotel_itemization.map(night => ({
      id: uuidv4(),
      nightDate: night.night_date,
      roomRate: parseFloat(night.room_rate),
      roomTax: parseFloat(night.room_tax),
      serviceCharge: parseFloat(night.service_charge),
      resortFee: parseFloat(night.resort_fee),
      parkingFee: parseFloat(night.parking_fee),
      otherFees: parseFloat(night.other_fees),
      dailyTotal: parseFloat(night.room_rate) + parseFloat(night.room_tax) +
                  parseFloat(night.service_charge) + parseFloat(night.resort_fee) +
                  parseFloat(night.parking_fee) + parseFloat(night.other_fees)
    }));
  }

  // Build currency conversion info
  const currencyConversion = expense.original_currency && expense.original_currency !== expense.currency ? {
    originalCurrency: expense.original_currency,
    originalAmount: parseFloat(expense.original_amount),
    exchangeRate: parseFloat(expense.exchange_rate),
    exchangeRateSource: expense.exchange_rate_source || 'OANDA',
    exchangeRateDate: expense.exchange_rate_date,
    convertedCurrency: expense.currency,
    convertedAmount: parseFloat(expense.total)
  } : null;

  // Build flight info
  const flightInfo = expense.airline ? {
    airline: expense.airline,
    flightNumber: expense.flight_number,
    departureCity: expense.departure_city,
    arrivalCity: expense.arrival_city,
    passengerName: expense.passenger_name,
    bookingReference: expense.booking_reference
  } : null;

  return {
    id: uuidv4(),
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
    uploadedAt: new Date().toISOString(),
    confidence: expense.confidence_score || 0.9,
    rawText: response.raw_text || '',
    extracted: {
      vendor: expense.vendor,
      category: expense.category,
      date: expense.expense_date,
      checkInDate: expense.check_in_date,
      checkOutDate: expense.check_out_date,
      amount: parseFloat(expense.subtotal),
      tax: parseFloat(expense.tax),
      total: parseFloat(expense.total),
      currency: expense.currency || 'USD',
      receiptNumber: expense.receipt_number || '',
      paymentMethod: expense.payment_method || '',
      description: expense.description || '',
      // Flight fields
      airline: expense.airline,
      flightNumber: expense.flight_number,
      departureCity: expense.departure_city,
      arrivalCity: expense.arrival_city,
      passengerName: expense.passenger_name,
      bookingReference: expense.booking_reference
    },
    requiresCompanion: expense.requires_companion,
    hotelItemization,
    currencyConversion,
    flightInfo
  };
}

/**
 * Parse receipt file and extract expense data
 * @param {File} file - The uploaded receipt file
 * @param {boolean} forceSimulated - Force use of simulated parsing
 * @returns {Promise<Object>} - Parsed expense data
 */
export async function parseReceipt(file, forceSimulated = false) {
  // Try backend API first if available
  if (!forceSimulated) {
    const useBackend = await isBackendAvailable();
    console.log('Backend available:', useBackend);

    if (useBackend) {
      try {
        console.log('Using backend AI for receipt parsing...');
        console.log('File:', file.name, file.type, file.size, 'bytes');
        const response = await parseReceiptWithBackend(file);
        console.log('Backend response:', response);
        const transformed = transformBackendResponse(response, file);
        console.log('Transformed response:', transformed);

        if (transformed) {
          return transformed;
        }
        // Fall through to simulated if transformation failed
        console.warn('Backend response transformation failed, using simulated parsing');
      } catch (error) {
        console.warn('Backend parsing failed, falling back to simulated:', error.message);
      }
    }
  }

  // Fallback to simulated parsing
  console.log('Using simulated receipt parsing...');
  return parseReceiptSimulated(file);
}

/**
 * Simulated receipt parsing (fallback when backend unavailable)
 * @param {File} file - The uploaded receipt file
 * @returns {Promise<Object>} - Parsed expense data
 */
export async function parseReceiptSimulated(file) {
  return new Promise((resolve) => {
    // Simulate AI processing delay
    setTimeout(() => {
      const fileName = file.name.toLowerCase();
      const fileType = file.type;

      // Simulate extracted data based on filename patterns
      // In production, this would use actual OCR/AI extraction
      let extractedData = {
        id: uuidv4(),
        fileName: file.name,
        fileType: fileType,
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
        confidence: 0.85 + Math.random() * 0.14, // 85-99% confidence
        rawText: '', // Would contain OCR text in production
        extracted: {
          vendor: '',
          category: EXPENSE_CATEGORIES.OTHER,
          date: format(new Date(), 'yyyy-MM-dd'),
          amount: 0,
          tax: 0,
          total: 0,
          currency: 'USD',
          receiptNumber: '',
          paymentMethod: '',
          description: '',
          items: []
        },
        requiresCompanion: false,
        hotelItemization: null
      };

      // Simulate different receipt types based on filename
      if (/hotel|marriott|hilton|hyatt/i.test(fileName)) {
        const nights = Math.floor(Math.random() * 4) + 1;
        const baseRate = 150 + Math.random() * 200;
        const total = baseRate * nights * 1.15;
        const checkIn = new Date();
        const checkOut = addDays(checkIn, nights);

        extractedData.extracted = {
          ...extractedData.extracted,
          vendor: fileName.includes('marriott') ? 'Marriott Hotels' :
                  fileName.includes('hilton') ? 'Hilton Hotels' :
                  fileName.includes('hyatt') ? 'Hyatt Hotels' : 'Hotel Stay',
          category: EXPENSE_CATEGORIES.HOTEL,
          date: format(checkIn, 'yyyy-MM-dd'),
          checkInDate: format(checkIn, 'yyyy-MM-dd'),
          checkOutDate: format(checkOut, 'yyyy-MM-dd'),
          amount: Math.round(baseRate * nights * 100) / 100,
          tax: Math.round(baseRate * nights * 0.12 * 100) / 100,
          total: Math.round(total * 100) / 100,
          receiptNumber: `HTL${Date.now().toString().slice(-8)}`,
          paymentMethod: 'Corporate Card',
          description: `${nights}-night stay`
        };

        extractedData.hotelItemization = generateHotelItemization(
          extractedData.extracted.checkInDate,
          extractedData.extracted.checkOutDate,
          extractedData.extracted.total
        );

      } else if (/uber|lyft|ride/i.test(fileName)) {
        const amount = 15 + Math.random() * 50;
        extractedData.extracted = {
          ...extractedData.extracted,
          vendor: fileName.includes('uber') ? 'Uber' : 'Lyft',
          category: EXPENSE_CATEGORIES.RIDESHARE,
          amount: Math.round(amount * 100) / 100,
          tax: 0,
          total: Math.round(amount * 100) / 100,
          receiptNumber: `RD${Date.now().toString().slice(-8)}`,
          paymentMethod: 'App Payment',
          description: 'Rideshare trip'
        };

      } else if (/flight|airline|delta|united|american/i.test(fileName)) {
        const amount = 200 + Math.random() * 800;
        extractedData.extracted = {
          ...extractedData.extracted,
          vendor: fileName.includes('delta') ? 'Delta Airlines' :
                  fileName.includes('united') ? 'United Airlines' :
                  fileName.includes('american') ? 'American Airlines' : 'Airlines',
          category: EXPENSE_CATEGORIES.FLIGHT,
          amount: Math.round(amount * 100) / 100,
          tax: Math.round(amount * 0.075 * 100) / 100,
          total: Math.round(amount * 1.075 * 100) / 100,
          receiptNumber: `FL${Date.now().toString().slice(-8)}`,
          paymentMethod: 'Corporate Card',
          description: 'Flight booking'
        };

      } else if (/meal|restaurant|dinner|lunch|breakfast|steakhouse|cafe/i.test(fileName)) {
        const amount = 20 + Math.random() * 150;
        const requiresCompanion = amount > 25;
        extractedData.extracted = {
          ...extractedData.extracted,
          vendor: 'Restaurant',
          category: EXPENSE_CATEGORIES.MEAL,
          amount: Math.round(amount * 100) / 100,
          tax: Math.round(amount * 0.08 * 100) / 100,
          total: Math.round(amount * 1.08 * 100) / 100,
          receiptNumber: `ML${Date.now().toString().slice(-8)}`,
          paymentMethod: 'Corporate Card',
          description: 'Business meal'
        };
        extractedData.requiresCompanion = requiresCompanion;

      } else if (/taxi|cab/i.test(fileName)) {
        const amount = 10 + Math.random() * 40;
        extractedData.extracted = {
          ...extractedData.extracted,
          vendor: 'Taxi Service',
          category: EXPENSE_CATEGORIES.TAXI,
          amount: Math.round(amount * 100) / 100,
          tax: 0,
          total: Math.round(amount * 100) / 100,
          receiptNumber: `TX${Date.now().toString().slice(-8)}`,
          paymentMethod: 'Cash',
          description: 'Taxi fare'
        };

      } else if (/parking/i.test(fileName)) {
        const amount = 5 + Math.random() * 30;
        extractedData.extracted = {
          ...extractedData.extracted,
          vendor: 'Parking',
          category: EXPENSE_CATEGORIES.PARKING,
          amount: Math.round(amount * 100) / 100,
          tax: 0,
          total: Math.round(amount * 100) / 100,
          receiptNumber: `PK${Date.now().toString().slice(-8)}`,
          paymentMethod: 'Credit Card',
          description: 'Parking fee'
        };

      } else {
        // Generic receipt
        const amount = 10 + Math.random() * 100;
        extractedData.extracted = {
          ...extractedData.extracted,
          vendor: 'Unknown Vendor',
          category: EXPENSE_CATEGORIES.OTHER,
          amount: Math.round(amount * 100) / 100,
          tax: Math.round(amount * 0.08 * 100) / 100,
          total: Math.round(amount * 1.08 * 100) / 100,
          receiptNumber: `RC${Date.now().toString().slice(-8)}`,
          paymentMethod: 'Unknown',
          description: 'Expense'
        };
      }

      // Check if meal requires companion info
      if (extractedData.extracted.category === EXPENSE_CATEGORIES.MEAL &&
          extractedData.extracted.total > 25) {
        extractedData.requiresCompanion = true;
      }

      resolve(extractedData);
    }, 1000 + Math.random() * 1500); // 1-2.5 second simulated processing
  });
}

/**
 * Parse text content from receipt (for manual text input)
 */
export function parseReceiptText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Try to extract vendor from first non-empty line
  const vendor = lines[0] || 'Unknown Vendor';
  const category = detectCategory(vendor);
  const amount = extractAmount(text);
  const date = extractDate(text);

  return {
    id: uuidv4(),
    confidence: 0.70,
    extracted: {
      vendor,
      category,
      date,
      amount: amount || 0,
      tax: amount ? Math.round(amount * 0.08 * 100) / 100 : 0,
      total: amount ? Math.round(amount * 1.08 * 100) / 100 : 0,
      currency: 'USD',
      receiptNumber: `TXT${Date.now().toString().slice(-8)}`,
      paymentMethod: '',
      description: ''
    },
    requiresCompanion: category === EXPENSE_CATEGORIES.MEAL && amount > 25,
    hotelItemization: null
  };
}

/**
 * Validate extracted expense data
 */
export function validateExpenseData(data) {
  const errors = [];

  if (!data.vendor || data.vendor.trim() === '') {
    errors.push('Vendor name is required');
  }

  if (!data.date) {
    errors.push('Date is required');
  }

  if (!data.total || data.total <= 0) {
    errors.push('Total amount must be greater than 0');
  }

  if (data.category === EXPENSE_CATEGORIES.HOTEL && !data.hotelItemization?.length) {
    errors.push('Hotel expenses require per-night itemization');
  }

  if (data.category === EXPENSE_CATEGORIES.MEAL && data.total > 25 && !data.companionName) {
    errors.push('Meals over $25 require companion/customer name');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
