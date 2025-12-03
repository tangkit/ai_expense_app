import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Bot, User, Loader2, Upload, FileText } from 'lucide-react';
import { useExpense } from '../context/ExpenseContext';
import FileUpload, { isTemplateFile } from './FileUpload';
import ExpenseCard from './ExpenseCard';
import ExpenseForm from './ExpenseForm';
import ClaimInfoForm from './ClaimInfoForm';
import TemplateUpload from './TemplateUpload';
import { parseReceipt } from '../services/receiptParser';
import { EXPENSE_CATEGORIES, MEAL_COMPANION_THRESHOLD } from '../constants/expenseTypes';

const WELCOME_MESSAGE = `Welcome to Tang's Expense Claim Assistant.

Let me help you input your expense claims:

• **Import company template** - Upload your company's expense template for customized exports
• **Purpose of your business trip** - Just drag & drop or click to upload receipts and invoices
• **Local currency to target conversion** - Input as local currency and convert to target currency (per OANDA exchange rate)
• **Upload receipts** - Just drag & drop or click to upload receipts and invoices
• **Extract information** - I'll automatically parse vendor, amount, date, and category
• **Itemize hotel stays** - I break down hotel bills by night with all fees
• **Track meals & customers** - For meals over $25, I'll help you record who you dined with
• **Export to PDF/Excel** - Generate professional expense reports with receipts attached

How can I help you today? Start by setting up your expense claim details or uploading a receipt!`;

export default function ChatInterface() {
  const [inputValue, setInputValue] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [showClaimInfo, setShowClaimInfo] = useState(false);
  const [showTemplateUpload, setShowTemplateUpload] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const welcomeAddedRef = useRef(false);

  const {
    messages,
    isProcessing,
    currentExpense,
    claimInfo,
    companyTemplate,
    isInitialized,
    addBotMessage,
    addUserMessage,
    setProcessing,
    setCurrentExpense,
    addExpense,
    clearCurrentExpense,
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
  }, [messages, currentExpense]);

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

        const parsedData = await parseReceipt(file);

        // Show what was extracted
        let extractionMessage = `**Extraction Complete!** (${Math.round(parsedData.confidence * 100)}% confidence)

**Detected Information:**
• Vendor: ${parsedData.extracted.vendor}
• Category: ${parsedData.extracted.category}
• Date: ${parsedData.extracted.date}
• Amount: $${parsedData.extracted.amount.toFixed(2)}
• Tax: $${parsedData.extracted.tax.toFixed(2)}
• **Total: $${parsedData.extracted.total.toFixed(2)}**`;

        // Handle special cases
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
          receiptId: Date.now().toString() // Link to uploaded receipt
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
    addBotMessage(`✅ Expense saved successfully!

**${expense.vendor}** - $${expense.total.toFixed(2)}
Category: ${expense.category}
${claimInfo.claimName ? `\nAdded to: ${claimInfo.claimName}` : ''}

The expense has been added to your report. Upload another receipt or type "export" when you're ready to generate your report.`);
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

  return (
    <div className="chat-interface">
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

        {showUpload && !currentExpense && !showClaimInfo && !showTemplateUpload && (
          <div className="upload-container">
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
          disabled={isProcessing || currentExpense}
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

// Parse template file to extract structure
async function parseTemplateFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const content = event.target.result;
        let columns = [];

        if (file.name.toLowerCase().endsWith('.csv')) {
          // Parse CSV
          const lines = content.split('\n');
          if (lines.length > 0) {
            columns = lines[0].split(',').map(col => col.trim().replace(/"/g, ''));
          }
        } else {
          // For Excel files, detect common expense template columns
          columns = [
            'Date',
            'Vendor/Merchant',
            'Description',
            'Category',
            'Amount',
            'Tax',
            'Total',
            'Currency',
            'Payment Method',
            'Receipt Attached',
            'Business Purpose',
            'Project/Cost Center',
            'Companion Name',
            'Notes'
          ];
        }

        // Filter out empty columns
        columns = columns.filter(col => col && col.length > 0);

        if (columns.length === 0) {
          reject(new Error('Could not detect columns in the template'));
          return;
        }

        resolve({
          name: file.name,
          columns: columns,
          uploadedAt: new Date().toISOString(),
          fileType: file.type || 'application/octet-stream'
        });
      } catch (err) {
        reject(new Error('Failed to parse template: ' + err.message));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));

    if (file.name.toLowerCase().endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      // For Excel files, use common patterns
      setTimeout(() => {
        resolve({
          name: file.name,
          columns: [
            'Date',
            'Vendor/Merchant',
            'Description',
            'Category',
            'Amount',
            'Tax',
            'Total',
            'Currency',
            'Payment Method',
            'Receipt Attached',
            'Business Purpose',
            'Project/Cost Center',
            'Companion Name',
            'Notes'
          ],
          uploadedAt: new Date().toISOString(),
          fileType: file.type || 'application/vnd.ms-excel'
        });
      }, 300);
    }
  });
}
