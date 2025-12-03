/**
 * API service for communicating with the backend expense processing server.
 */

// Version indicator for debugging cache issues
console.log('[api.js] Module loaded - v3');

// Use relative URL to leverage Vite proxy (avoids CORS issues)
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';
console.log('[api.js] API_BASE_URL:', API_BASE_URL);

/**
 * Convert a File object to base64 string
 */
async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
}

/**
 * Parse a receipt using the backend AI service
 * @param {File} file - The receipt file to parse
 * @returns {Promise<Object>} - Parsed expense data
 */
export async function parseReceiptWithBackend(file) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/receipts/parse`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Parse a receipt using base64 encoding (alternative method)
 * @param {File} file - The receipt file to parse
 * @returns {Promise<Object>} - Parsed expense data
 */
export async function parseReceiptBase64(file) {
  const base64Content = await fileToBase64(file);

  const response = await fetch(`${API_BASE_URL}/receipts/parse-base64`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      file_name: file.name,
      file_type: file.type,
      file_content_base64: base64Content,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Validate expense data
 * @param {Object} expense - Expense data to validate
 * @returns {Promise<Object>} - Validation result
 */
export async function validateExpense(expense) {
  const response = await fetch(`${API_BASE_URL}/expenses/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(expense),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Export expenses to spreadsheet
 * @param {Array} expenses - List of expenses to export
 * @param {string} format - Export format ('xlsx' or 'csv')
 * @returns {Promise<Object>} - Export result with base64 file content
 */
export async function exportExpenses(expenses, format = 'xlsx') {
  const response = await fetch(`${API_BASE_URL}/expenses/export`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      expenses,
      format,
      include_itemization: true,
      include_companion_sheet: true,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Download exported expenses directly
 * @param {Array} expenses - List of expenses to export
 * @param {string} format - Export format ('xlsx' or 'csv')
 */
export async function downloadExpenseReport(expenses, format = 'xlsx') {
  const response = await fetch(`${API_BASE_URL}/expenses/export/download`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      expenses,
      format,
      include_itemization: true,
      include_companion_sheet: true,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  // Get filename from Content-Disposition header
  const contentDisposition = response.headers.get('Content-Disposition');
  let filename = `expense_report.${format}`;
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="(.+)"/);
    if (match) {
      filename = match[1];
    }
  }

  // Download the file
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);

  return filename;
}

/**
 * Get supported file types from backend
 * @returns {Promise<Object>} - Supported types configuration
 */
export async function getSupportedTypes() {
  const response = await fetch(`${API_BASE_URL}/receipts/supported-types`);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Get expense categories from backend
 * @returns {Promise<Object>} - Available categories
 */
export async function getCategories() {
  const response = await fetch(`${API_BASE_URL}/expenses/categories`);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Get business rules from backend
 * @returns {Promise<Object>} - Business rules configuration
 */
export async function getBusinessRules() {
  const response = await fetch(`${API_BASE_URL}/expenses/business-rules`);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Check if backend is available
 * @returns {Promise<boolean>} - True if backend is healthy
 */
export async function checkBackendHealth() {
  // Use relative URL for health check (proxied by Vite)
  const healthUrl = '/health';
  console.log('Fetching health check from:', healthUrl);
  try {
    const response = await fetch(healthUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    console.log('Health check response:', response.status, response.ok);
    return response.ok;
  } catch (error) {
    console.error('Health check fetch error:', error);
    return false;
  }
}

export default {
  parseReceiptWithBackend,
  parseReceiptBase64,
  validateExpense,
  exportExpenses,
  downloadExpenseReport,
  getSupportedTypes,
  getCategories,
  getBusinessRules,
  checkBackendHealth,
};
