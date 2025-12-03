import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Bot, User, Loader2, Upload, FileText, PlusCircle, FileSpreadsheet, Receipt } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useExpense } from '../context/ExpenseContext';
import FileUpload, { isTemplateFile } from './FileUpload';
import ExpenseCard from './ExpenseCard';
import ExpenseForm from './ExpenseForm';
import ClaimInfoForm from './ClaimInfoForm';
import TemplateUpload from './TemplateUpload';
import { parseReceipt } from '../services/receiptParser';
import { EXPENSE_CATEGORIES, MEAL_COMPANION_THRESHOLD } from '../constants/expenseTypes';

const WELCOME_MESSAGE = `Welcome to Tang's Expense Claim Assistant!

**Getting Started:**
1. Click **"New Expense Claim"** above to enter your employee details (saved for future claims)
2. Enter your **Purpose of Business Trip** - I'll auto-generate an Expense Title
3. Click **"Upload Receipt"** to add your receipts

**What I can do:**
• **Auto-extract information** - Vendor, amount, date, category from receipts
• **Currency conversion** - Convert foreign currencies to SGD (per exchange rates)
• **Itemize hotel stays** - Break down charges by night with all fees
• **Track meal companions** - For meals over $25 (compliance requirement)
• **Export with your template** - Populate your company's expense template

Click the buttons above to get started, or type a message below!`;

export default function ChatInterface() {
  const [inputValue, setInputValue] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [showClaimInfo, setShowClaimInfo] = useState(false);
  const [showTemplateUpload, setShowTemplateUpload] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const welcomeAddedRef = useRef(false);
  const uploadContainerRef = useRef(null);

  const {
    messages,
    isProcessing,
    currentExpense,
    pendingExpenses,
    claimInfo,
    companyTemplate,
    isInitialized,
    addBotMessage,
    addUserMessage,
    setProcessing,
    setCurrentExpense,
    addExpense,
    clearCurrentExpense,
    setPendingExpenses,
    removePendingExpense,
    addUploadedReceipt,
    setCompanyTemplate
  } = useExpense();

  // Initialize with welcome message on mount - only once
  useEffect(() => {
    if (isInitialized && messages.length === 0 && !welcomeAddedRef.current) {
      welcomeAddedRef.current = true;
      addBotMessage(WELCOME_MESSAGE);
    }
  }, [isInitialized, messages.length, addBotMessage]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentExpense, pendingExpenses]);

  // Scroll to upload container when it appears
  useEffect(() => {
    if (showUpload && uploadContainerRef.current) {
      uploadContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [showUpload]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isProcessing) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    addUserMessage(userMessage);

    // Process user message
    await processUserMessage(userMessage);
  };

  const processUserMessage = async (message) => {
    setProcessing(true);

    const lowerMessage = message.toLowerCase();

    try {
      // Handle different user intents
      if (lowerMessage.includes('template') || lowerMessage.includes('import template') || lowerMessage.includes('company template')) {
        setShowTemplateUpload(true);
        addBotMessage(`Sure! You can upload your company's expense template now. I accept Excel (.xlsx, .xls) and CSV files.

Once uploaded, I'll analyze the template structure and use it to format your expense reports accordingly.`);
      } else if (lowerMessage.includes('claim') && (lowerMessage.includes('info') || lowerMessage.includes('setup') || lowerMessage.includes('detail') || lowerMessage.includes('name'))) {
        setShowClaimInfo(true);
        addBotMessage(`Let's set up your expense claim details. Please fill in the following information:

• **Claim Name** - A descriptive name for this expense report
• **Business Purpose** - The reason for this business trip
• **Traveler Name** - Your full name
• **Department** - Your department or cost center`);
      } else if (lowerMessage.includes('upload') || lowerMessage.includes('receipt') || lowerMessage.includes('add')) {
        setShowUpload(true);
        addBotMessage(`Sure! You can upload your receipt now. I accept images (JPG, PNG) and PDF files. Just drag and drop or click to select your file.`);
      } else if (lowerMessage.includes('export') || lowerMessage.includes('download') || lowerMessage.includes('spreadsheet') || lowerMessage.includes('pdf')) {
        addBotMessage(`To export your expenses:

**Excel/CSV Export:**
Click the "Export to Excel" or "Export CSV" button in the sidebar.

**PDF Export:**
Click "Export PDF" for a professional report with:
• Cover page with claim details
• Itemized expense summary
• All receipts attached as appendix (sorted by date)

${companyTemplate ? `*Using your company template: ${companyTemplate.name}*` : '*Tip: Upload your company template for customized formatting.*'}`);
      } else if (lowerMessage.includes('help') || lowerMessage.includes('how')) {
        addBotMessage(`Here's how I can help:

**Setup Your Claim:**
Say "setup claim info" to enter your expense claim name and business purpose.

**Upload Receipts:**
Click the 📎 button or say "upload receipt" to add documents.

**Import Company Template:**
Say "import template" to upload your company's expense template.

**Supported Expenses:**
• Transportation: Taxi, rideshare, flights, car rental
• Accommodation: Hotels (itemized per night)
• Meals: Restaurants (companion tracking for >$25)
• Other: Parking, tolls, fuel, conference fees

**Export Options:**
• Excel with multiple sheets
• CSV for simple data
• PDF with receipts attached`);
      } else if (lowerMessage.includes('hotel')) {
        addBotMessage(`For hotel receipts, I automatically:

1. **Detect check-in/check-out dates**
2. **Calculate per-night breakdown:**
   - Room rate
   - Room tax
   - Service charges
   - Resort/amenity fees
   - Parking (if applicable)
3. **Generate daily totals**

Upload your hotel receipt and I'll itemize it for you!`);
        setShowUpload(true);
      } else if (lowerMessage.includes('meal') || lowerMessage.includes('dinner') || lowerMessage.includes('lunch')) {
        addBotMessage(`For meal expenses over $${MEAL_COMPANION_THRESHOLD}:

I'll need to capture:
• **Companion/Customer Name** - Who you dined with
• **Business Purpose** - Reason for the meal
• **Number of Attendees** (optional)

This information is required for compliance and audit purposes. Upload your meal receipt to get started!`);
        setShowUpload(true);
      } else {
        // Default response
        addBotMessage(`I understand you're asking about "${message}".

I'm specialized in expense claim processing. Here's what I can do:
• Set up expense claim with name and business purpose
• Upload and parse receipts
• Import your company's expense template
• Categorize expenses automatically
• Itemize hotel stays by night
• Track meal companions for compliance
• Export to PDF with receipts attached

Would you like to set up your claim info, upload a receipt, or import a template?`);
      }
    } catch {
      addBotMessage(`I apologize, but I encountered an error processing your request. Please try again or upload a receipt directly.`);
    } finally {
      setProcessing(false);
    }
  };

  const handleFileUpload = async (files) => {
    setShowUpload(false);
    setProcessing(true);

    for (const file of files) {
      addUserMessage(`Uploaded: ${file.name}`, { type: 'file', file: file.name });

      // Check if this is a template file (Excel/CSV)
      if (isTemplateFile(file)) {
        addBotMessage(`Processing ${file.name} as company template...`);

        try {
          // Parse template file
          const template = await parseTemplateFile(file);
          setCompanyTemplate(template);

          addBotMessage(`✅ Company template imported successfully!

**Template:** ${template.name}
**Columns detected:** ${template.columns.length}
${template.columns.slice(0, 5).map(col => `• ${col}`).join('\n')}
${template.columns.length > 5 ? `• ... and ${template.columns.length - 5} more` : ''}

I'll use this template structure when exporting your expense report.`);
        } catch (err) {
          addBotMessage(`❌ Failed to import template: ${err.message}

Please make sure it's a valid Excel (.xls, .xlsx) or CSV file.`);
        }
        continue; // Skip to next file
      }

      // Handle as receipt
      addBotMessage(`Processing ${file.name}... I'm extracting expense information using AI-powered recognition.`);

      try {
        // Store the receipt file as base64 for PDF export
        const base64Data = await fileToBase64(file);
        addUploadedReceipt({
          id: Date.now().toString(),
          fileName: file.name,
          fileType: file.type,
          base64: base64Data,
          uploadedAt: new Date().toISOString()
        });

        const parsedExpenses = await parseReceipt(file);

        // Get currency symbol helper (with non-breaking space)
        const getCurrencySymbol = (currencyCode) => {
          const symbols = {
            'MYR': 'RM\u00A0',
            'SGD': 'SGD\u00A0',
            'EUR': '€\u00A0',
            'GBP': '£\u00A0',
            'THB': '฿\u00A0',
            'IDR': 'Rp\u00A0',
            'JPY': '¥\u00A0',
            'USD': 'USD\u00A0'
          };
          return symbols[currencyCode] || currencyCode + '\u00A0';
        };

        // Handle multiple receipts detected in single document
        if (parsedExpenses.length > 1) {
          let multiReceiptMessage = `**Multiple Receipts Detected!** Found ${parsedExpenses.length} separate receipts in this document.\n`;

          parsedExpenses.forEach((parsedData, idx) => {
            const currency = parsedData.extracted.currency || 'USD';
            const currencySymbol = getCurrencySymbol(currency);
            multiReceiptMessage += `
**Receipt ${idx + 1}:**
• Vendor: ${parsedData.extracted.vendor}
• Category: ${parsedData.extracted.category}
• Total: ${currencySymbol}${parsedData.extracted.total.toFixed(2)}`;
          });

          multiReceiptMessage += `

All receipts are shown below for your review. Edit each one and click "Save Expense" to add them to your report.`;

          addBotMessage(multiReceiptMessage);

          // Set all parsed expenses as pending (they will all be shown as cards)
          const allPendingExpenses = parsedExpenses.map(parsedData => ({
            ...parsedData.extracted,
            id: parsedData.id,
            hotelItemization: parsedData.hotelItemization,
            requiresCompanion: parsedData.requiresCompanion,
            confidence: parsedData.confidence,
            fileName: parsedData.fileName,
            receiptId: Date.now().toString(),
            currencyConversion: parsedData.currencyConversion,
            flightInfo: parsedData.flightInfo
          }));
          setPendingExpenses(allPendingExpenses);
          setProcessing(false);
          return; // Don't set currentExpense, use pendingExpenses instead
        }

        // Process first (or only) expense
        const parsedData = parsedExpenses[0];

        // Show what was extracted
        let extractionMessage = parsedExpenses.length > 1
          ? `**Receipt 1 of ${parsedExpenses.length}** (${Math.round(parsedData.confidence * 100)}% confidence)`
          : `**Extraction Complete!** (${Math.round(parsedData.confidence * 100)}% confidence)`;

        extractionMessage += `

**Detected Information:**
• Vendor: ${parsedData.extracted.vendor}
• Category: ${parsedData.extracted.category}
• Date: ${parsedData.extracted.date}`;

        // Show currency conversion info if applicable
        if (parsedData.currencyConversion) {
          const conv = parsedData.currencyConversion;
          const origSymbol = getCurrencySymbol(conv.originalCurrency);
          const convSymbol = getCurrencySymbol(conv.convertedCurrency);
          // Log the exchange rate source to console for verification
          console.log(`Exchange rate source: ${conv.exchangeRateSource} (1 ${conv.originalCurrency} = ${conv.exchangeRate.toFixed(4)} ${conv.convertedCurrency})`);
          extractionMessage += `
• **Original Amount: ${origSymbol}${conv.originalAmount.toFixed(2)}**
• Conversion Rate: ${conv.exchangeRate.toFixed(4)}
• **Converted for Reimbursement: ${convSymbol}${conv.convertedAmount.toFixed(2)}**`;
        } else {
          const currency = parsedData.extracted.currency || 'USD';
          const currencySymbol = getCurrencySymbol(currency);
          extractionMessage += `
• Amount: ${currencySymbol}${parsedData.extracted.amount.toFixed(2)}
• Tax: ${currencySymbol}${parsedData.extracted.tax.toFixed(2)}
• **Total: ${currencySymbol}${parsedData.extracted.total.toFixed(2)}**`;
        }

        // Show flight info
        if (parsedData.flightInfo) {
          const flight = parsedData.flightInfo;
          extractionMessage += `

**Flight Details:**
• Airline: ${flight.airline || 'N/A'}
• Flight: ${flight.flightNumber || 'N/A'}
• Route: ${flight.departureCity || 'N/A'} → ${flight.arrivalCity || 'N/A'}
• Passenger: ${flight.passengerName || 'N/A'}
• Booking Ref: ${flight.bookingReference || 'N/A'}`;
        }

        // Handle hotel itemization
        if (parsedData.extracted.category === EXPENSE_CATEGORIES.HOTEL && parsedData.hotelItemization) {
          extractionMessage += `

**Hotel Stay Itemization:**
This is a ${parsedData.hotelItemization.length}-night stay. I've broken down the charges by night:`;

          parsedData.hotelItemization.forEach((night, idx) => {
            extractionMessage += `
• Night ${idx + 1} (${night.nightDate}): Room $${night.roomRate.toFixed(2)} + Tax $${night.roomTax.toFixed(2)} = $${night.dailyTotal.toFixed(2)}`;
          });
        }

        if (parsedData.requiresCompanion) {
          extractionMessage += `

⚠️ **Action Required:** This meal exceeds $${MEAL_COMPANION_THRESHOLD}. Please provide the name of your dining companion or customer for compliance purposes.`;
        }

        extractionMessage += `

Please review and edit the details below, then click "Save Expense" to add it to your report.`;

        addBotMessage(extractionMessage);

        // Set current expense for editing
        setCurrentExpense({
          ...parsedData.extracted,
          id: parsedData.id,
          hotelItemization: parsedData.hotelItemization,
          requiresCompanion: parsedData.requiresCompanion,
          confidence: parsedData.confidence,
          fileName: parsedData.fileName,
          receiptId: Date.now().toString(), // Link to uploaded receipt
          currencyConversion: parsedData.currencyConversion,
          flightInfo: parsedData.flightInfo
        });

      } catch {
        addBotMessage(`I had trouble processing ${file.name}. The file might be corrupted or in an unsupported format. Please try uploading again or use a different file.`);
      }
    }

    setProcessing(false);
  };

  const handleExpenseSave = (expense) => {
    addExpense(expense);
    clearCurrentExpense();
    // Get currency symbol for display (with non-breaking space)
    const symbols = {
      'MYR': 'RM\u00A0',
      'SGD': 'SGD\u00A0',
      'EUR': '€\u00A0',
      'GBP': '£\u00A0',
      'THB': '฿\u00A0',
      'IDR': 'Rp\u00A0',
      'JPY': '¥\u00A0',
      'USD': 'USD\u00A0'
    };
    const currSymbol = symbols[expense.currency] || expense.currency + '\u00A0';

    addBotMessage(`✅ Expense saved successfully!

**${expense.vendor}** - ${currSymbol}${expense.total.toFixed(2)}
Category: ${expense.category}
${claimInfo.claimName ? `\nAdded to: ${claimInfo.claimName}` : ''}

The expense has been added to your report. Upload another receipt or type "export" when you're ready to generate your report.`);
  };

  // Handle saving a pending expense from multi-receipt view
  const handlePendingExpenseSave = (expense) => {
    addExpense(expense);
    removePendingExpense(expense.id);

    const symbols = {
      'MYR': 'RM\u00A0',
      'SGD': 'SGD\u00A0',
      'EUR': '€\u00A0',
      'GBP': '£\u00A0',
      'THB': '฿\u00A0',
      'IDR': 'Rp\u00A0',
      'JPY': '¥\u00A0',
      'USD': 'USD\u00A0'
    };
    const currSymbol = symbols[expense.currency] || expense.currency + '\u00A0';
    const remainingCount = pendingExpenses.length - 1;

    if (remainingCount > 0) {
      addBotMessage(`✅ Expense saved: **${expense.vendor}** - ${currSymbol}${expense.total.toFixed(2)}

${remainingCount} receipt(s) remaining for review.`);
    } else {
      addBotMessage(`✅ All expenses saved! **${expense.vendor}** was the last one.

Your expenses have been added to the report. Upload more receipts or type "export" when ready.`);
    }
  };

  // Handle canceling a pending expense from multi-receipt view
  const handlePendingExpenseCancel = (expenseId) => {
    removePendingExpense(expenseId);
    const remainingCount = pendingExpenses.length - 1;

    if (remainingCount > 0) {
      addBotMessage(`Receipt skipped. ${remainingCount} receipt(s) remaining for review.`);
    } else {
      addBotMessage(`Receipt skipped. No more pending receipts.`);
    }
  };

  const handleExpenseCancel = () => {
    clearCurrentExpense();
    addBotMessage(`No problem! The expense was not saved. Feel free to upload another receipt when you're ready.`);
  };

  const handleClaimInfoSave = () => {
    setShowClaimInfo(false);
    addBotMessage(`✅ Expense claim details saved!

**Claim Name:** ${claimInfo.claimName || 'Not set'}
**Business Purpose:** ${claimInfo.businessPurpose || 'Not set'}
**Traveler:** ${claimInfo.travelerName || 'Not set'}
**Department:** ${claimInfo.department || 'Not set'}

Now you can start uploading your receipts. Just click the 📎 button or say "upload receipt".`);
  };

  const handleTemplateUpload = (template) => {
    setShowTemplateUpload(false);
    addBotMessage(`✅ Company template imported successfully!

**Template:** ${template.name}
**Columns detected:** ${template.columns.length}
${template.columns.slice(0, 5).map(col => `• ${col}`).join('\n')}
${template.columns.length > 5 ? `• ... and ${template.columns.length - 5} more` : ''}

I'll use this template structure when exporting your expense report.`);
  };

  // Check if employee info is filled
  const hasEmployeeInfo = claimInfo.employeeName && claimInfo.jobPosition && claimInfo.department;

  return (
    <div className="chat-interface">
      {/* Quick Actions Bar */}
      <div className="quick-actions-bar">
        <button
          className={`quick-action-btn primary ${!hasEmployeeInfo ? 'highlight' : ''}`}
          onClick={() => setShowClaimInfo(true)}
          disabled={isProcessing || currentExpense || pendingExpenses.length > 0}
        >
          <PlusCircle size={18} />
          <span>New Expense Claim</span>
          {!hasEmployeeInfo && <span className="badge">Setup Required</span>}
        </button>
        <button
          className="quick-action-btn secondary"
          onClick={() => setShowTemplateUpload(true)}
          disabled={isProcessing || currentExpense || showClaimInfo || pendingExpenses.length > 0}
        >
          <FileSpreadsheet size={18} />
          <span>Upload Template</span>
          {companyTemplate && <span className="badge success">✓</span>}
        </button>
        <button
          className="quick-action-btn secondary"
          onClick={() => setShowUpload(true)}
          disabled={isProcessing || currentExpense || showClaimInfo || showTemplateUpload || pendingExpenses.length > 0}
        >
          <Receipt size={18} />
          <span>Upload Receipt</span>
        </button>
      </div>

      <div className="messages-container">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {isProcessing && (
          <div className="message assistant">
            <div className="message-avatar">
              <Bot size={20} />
            </div>
            <div className="message-content processing">
              <Loader2 className="spinner" size={16} />
              <span>Processing...</span>
            </div>
          </div>
        )}

        {showClaimInfo && !currentExpense && (
          <div className="claim-info-container">
            <ClaimInfoForm onSave={handleClaimInfoSave} onCancel={() => setShowClaimInfo(false)} />
          </div>
        )}

        {showTemplateUpload && !currentExpense && !showClaimInfo && (
          <div className="template-upload-container">
            <TemplateUpload onUpload={handleTemplateUpload} onCancel={() => setShowTemplateUpload(false)} />
          </div>
        )}

        {currentExpense && (
          <div className="expense-form-container">
            <ExpenseForm
              expense={currentExpense}
              onSave={handleExpenseSave}
              onCancel={handleExpenseCancel}
            />
          </div>
        )}

        {/* Multiple pending expenses from multi-receipt document */}
        {pendingExpenses && pendingExpenses.length > 0 && (
          <div className="pending-expenses-container">
            {pendingExpenses.map((expense, index) => (
              <div key={expense.id} className="expense-form-container pending-expense">
                <div className="pending-expense-header">
                  <span className="receipt-number">Receipt {index + 1} of {pendingExpenses.length}</span>
                </div>
                <ExpenseForm
                  expense={expense}
                  onSave={handlePendingExpenseSave}
                  onCancel={() => handlePendingExpenseCancel(expense.id)}
                />
              </div>
            ))}
          </div>
        )}

        {showUpload && !currentExpense && !showClaimInfo && !showTemplateUpload && pendingExpenses.length === 0 && (
          <div className="upload-container" ref={uploadContainerRef}>
            <FileUpload
              onUpload={handleFileUpload}
              onCancel={() => setShowUpload(false)}
            />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form className="input-container" onSubmit={handleSendMessage}>
        <button
          type="button"
          className="attach-button"
          onClick={() => setShowUpload(!showUpload)}
          disabled={isProcessing || currentExpense || pendingExpenses.length > 0}
          title="Upload receipt"
        >
          <Paperclip size={20} />
        </button>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Type a message or upload a receipt..."
          disabled={isProcessing}
          className="chat-input"
        />
        <button
          type="submit"
          className="send-button"
          disabled={!inputValue.trim() || isProcessing}
        >
          <Send size={20} />
        </button>
      </form>
    </div>
  );
}

function MessageBubble({ message }) {
  const isAssistant = message.role === 'assistant';

  return (
    <div className={`message ${message.role}`}>
      <div className="message-avatar">
        {isAssistant ? <Bot size={20} /> : <User size={20} />}
      </div>
      <div className="message-content">
        {message.data?.type === 'file' && (
          <div className="file-attachment">
            📎 {message.data.file}
          </div>
        )}
        <div
          className="message-text"
          dangerouslySetInnerHTML={{
            __html: formatMessageContent(message.content)
          }}
        />
      </div>
    </div>
  );
}

function formatMessageContent(content) {
  // Simple markdown-like formatting
  return content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/•/g, '<br/>•')
    .replace(/\n/g, '<br/>');
}

// Helper function to convert file to base64
async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
}

// Parse template file to extract structure using xlsx library
async function parseTemplateFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = event.target.result;
        let columns = [];
        let sheetData = [];

        console.log('=== Parsing Template File ===');
        console.log('File name:', file.name);
        console.log('File type:', file.type);

        let headerRowIndex = 0; // Default for CSV

        if (file.name.toLowerCase().endsWith('.csv')) {
          // Parse CSV
          const text = new TextDecoder().decode(data);
          const lines = text.split('\n');
          if (lines.length > 0) {
            columns = lines[0].split(',').map(col => col.trim().replace(/"/g, ''));
          }
          console.log('CSV columns:', columns);
          headerRowIndex = 0; // CSV header is always first row
        } else {
          // Parse Excel file using xlsx library
          console.log('Reading Excel file with xlsx library...');
          const workbook = XLSX.read(data, { type: 'array' });

          console.log('Sheet names:', workbook.SheetNames);

          // Get the first sheet
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];

          console.log('First sheet name:', firstSheetName);

          // Convert to JSON to get data
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          console.log('Total rows found:', jsonData.length);
          console.log('First 10 rows:', jsonData.slice(0, 10));

          if (jsonData.length > 0) {
            // Find the header row - it's typically the row with the most columns
            // Many templates have title rows at the top, so we scan first 15 rows
            let maxColumns = 0;

            const rowsToScan = Math.min(jsonData.length, 15);
            for (let i = 0; i < rowsToScan; i++) {
              const row = jsonData[i] || [];
              // Count non-empty cells in this row
              const nonEmptyCells = row.filter(cell => cell !== null && cell !== undefined && String(cell).trim() !== '').length;

              console.log(`Row ${i}: ${nonEmptyCells} non-empty cells:`, row);

              // Look for row with most columns (likely the header)
              // Require at least 3 columns to be considered a header row
              if (nonEmptyCells > maxColumns && nonEmptyCells >= 3) {
                maxColumns = nonEmptyCells;
                headerRowIndex = i;
              }
            }

            console.log(`Selected header row: ${headerRowIndex} with ${maxColumns} columns`);

            // Extract columns from the identified header row
            columns = jsonData[headerRowIndex].map(col => String(col || '').trim());
            console.log('Header row content:', jsonData[headerRowIndex]);
            console.log('Processed columns:', columns);

            // Store rows after header as sample data
            if (jsonData.length > headerRowIndex + 1) {
              sheetData = jsonData.slice(headerRowIndex + 1, headerRowIndex + 6);
            }
          }
        }

        // Filter out empty columns
        columns = columns.filter(col => col && col.length > 0);
        console.log('Final columns (after filtering):', columns);

        if (columns.length === 0) {
          reject(new Error('Could not detect columns in the template. Make sure the first row contains column headers.'));
          return;
        }

        // Convert ArrayBuffer to base64 for storage (to populate original template during export)
        const uint8Array = new Uint8Array(data);
        let binary = '';
        for (let i = 0; i < uint8Array.length; i++) {
          binary += String.fromCharCode(uint8Array[i]);
        }
        const base64Content = btoa(binary);

        console.log('=== Template Storage ===');
        console.log('File content length (bytes):', uint8Array.length);
        console.log('Base64 content length:', base64Content.length);
        console.log('Header row index:', headerRowIndex);

        resolve({
          name: file.name,
          columns: columns,
          sampleData: sheetData,
          uploadedAt: new Date().toISOString(),
          fileType: file.type || 'application/vnd.ms-excel',
          // Store original file content for direct population during export
          fileContent: base64Content,
          headerRowIndex: headerRowIndex
        });
      } catch (err) {
        console.error('Error parsing template:', err);
        reject(new Error('Failed to parse template: ' + err.message));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));

    // Read as ArrayBuffer for xlsx library
    reader.readAsArrayBuffer(file);
  });
}
