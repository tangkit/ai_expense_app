import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Bot, User, Loader2 } from 'lucide-react';
import { useExpense } from '../context/ExpenseContext';
import FileUpload from './FileUpload';
import ExpenseCard from './ExpenseCard';
import ExpenseForm from './ExpenseForm';
import { parseReceipt } from '../services/receiptParser';
import { EXPENSE_CATEGORIES, MEAL_COMPANION_THRESHOLD } from '../constants/expenseTypes';

const WELCOME_MESSAGE = {
  role: 'assistant',
  content: `Hello! I'm your Expense Claim Assistant. I can help you:

• **Upload receipts** - Just drag & drop or click to upload receipts and invoices
• **Extract information** - I'll automatically parse vendor, amount, date, and category
• **Itemize hotel stays** - I break down hotel bills by night with all fees
• **Track meal companions** - For meals over $25, I'll help you record who you dined with
• **Export to spreadsheet** - Generate your expense report in Excel format

How can I help you today? You can start by uploading a receipt or asking me a question!`
};

export default function ChatInterface() {
  const [inputValue, setInputValue] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const {
    messages,
    isProcessing,
    currentExpense,
    addBotMessage,
    addUserMessage,
    setProcessing,
    setCurrentExpense,
    addExpense,
    clearCurrentExpense
  } = useExpense();

  // Initialize with welcome message on mount
  useEffect(() => {
    if (messages.length === 0) {
      addBotMessage(WELCOME_MESSAGE.content);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      if (lowerMessage.includes('upload') || lowerMessage.includes('receipt') || lowerMessage.includes('add')) {
        setShowUpload(true);
        addBotMessage(`Sure! You can upload your receipt now. I accept images (JPG, PNG) and PDF files. Just drag and drop or click to select your file.`);
      } else if (lowerMessage.includes('export') || lowerMessage.includes('download') || lowerMessage.includes('spreadsheet')) {
        addBotMessage(`To export your expenses, click the "Export Report" button in the sidebar. I'll generate an Excel file with:

• **Summary sheet** - All expenses in one view
• **Hotel itemization** - Per-night breakdown for hotel stays
• **Meals & Entertainment** - Companion details for meals over $25`);
      } else if (lowerMessage.includes('help') || lowerMessage.includes('how')) {
        addBotMessage(`Here's how I can help:

**Upload Receipts:**
Click the 📎 button or say "upload receipt" to add documents.

**Supported Expenses:**
• Transportation: Taxi, rideshare, flights, car rental
• Accommodation: Hotels (itemized per night)
• Meals: Restaurants (companion tracking for >$25)
• Other: Parking, tolls, fuel, conference fees

**Special Features:**
• Hotel bills are automatically itemized by night
• Meals over $25 require companion information
• All data maps to your company's expense template`);
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
• Upload and parse receipts
• Categorize expenses automatically
• Itemize hotel stays by night
• Track meal companions for compliance

Would you like to upload a receipt or need help with something specific?`);
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
      addBotMessage(`Processing ${file.name}... I'm extracting expense information using AI-powered recognition.`);

      try {
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
          fileName: parsedData.fileName
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

The expense has been added to your report. Upload another receipt or type "export" when you're ready to generate your spreadsheet.`);
  };

  const handleExpenseCancel = () => {
    clearCurrentExpense();
    addBotMessage(`No problem! The expense was not saved. Feel free to upload another receipt when you're ready.`);
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

        {currentExpense && (
          <div className="expense-form-container">
            <ExpenseForm
              expense={currentExpense}
              onSave={handleExpenseSave}
              onCancel={handleExpenseCancel}
            />
          </div>
        )}

        {showUpload && !currentExpense && (
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
