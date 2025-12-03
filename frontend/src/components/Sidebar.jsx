import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  Trash2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Receipt,
  DollarSign,
  Calendar,
  Filter,
  FileText,
  Settings,
  Briefcase
} from 'lucide-react';
import { useExpense } from '../context/ExpenseContext';
import { exportToExcel, exportToCSV, generateReportSummary } from '../services/exportService';
import { exportToPDF } from '../services/pdfExportService';
import ExpenseCard from './ExpenseCard';
import { EXPENSE_CATEGORY_LABELS } from '../constants/expenseTypes';

export default function Sidebar() {
  const {
    expenses,
    claimInfo,
    companyTemplate,
    uploadedReceipts,
    removeExpense,
    setCurrentExpense,
    clearAllExpenses,
    addBotMessage
  } = useExpense();

  const [showExpenses, setShowExpenses] = useState(true);
  const [filterCategory, setFilterCategory] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [isExporting, setIsExporting] = useState(false);

  // Calculate summary
  const summary = generateReportSummary(expenses);

  // Filter and sort expenses
  const filteredExpenses = expenses
    .filter(exp => filterCategory === 'all' || exp.category === filterCategory)
    .sort((a, b) => {
      if (sortBy === 'date') return new Date(b.date) - new Date(a.date);
      if (sortBy === 'amount') return b.total - a.total;
      if (sortBy === 'category') return (a.category || '').localeCompare(b.category || '');
      return 0;
    });

  const handleExportExcel = () => {
    if (expenses.length === 0) {
      addBotMessage('No expenses to export. Please add some receipts first!');
      return;
    }

    // Check for items requiring attention
    if (summary.requiresAttention.length > 0) {
      const issues = summary.requiresAttention.map(item =>
        `• ${item.expense.vendor}: ${item.issue}`
      ).join('\n');

      addBotMessage(`⚠️ **Warning:** Some expenses need attention before export:\n\n${issues}\n\nThe export will proceed, but please review these items.`);
    }

    const filename = exportToExcel(expenses, 'expense_report', claimInfo, companyTemplate);

    let templateNote = '';
    if (companyTemplate && companyTemplate.fileContent) {
      templateNote = `\n\n*✅ Populated your original company template: ${companyTemplate.name}*`;
    } else if (companyTemplate) {
      templateNote = `\n\n*⚠️ Using template column structure only. Please re-upload your template for direct population.*`;
    }

    addBotMessage(`✅ Expense report exported successfully!\n\nFile: **${filename}**\n\nThe spreadsheet includes:\n• ${expenses.length} expense(s)${templateNote}`);
  };

  const handleExportCSV = () => {
    if (expenses.length === 0) {
      addBotMessage('No expenses to export. Please add some receipts first!');
      return;
    }

    const filename = exportToCSV(expenses, 'expense_report');
    addBotMessage(`✅ CSV export complete!\n\nFile: **${filename}**`);
  };

  const handleExportPDF = async () => {
    if (expenses.length === 0) {
      addBotMessage('No expenses to export. Please add some receipts first!');
      return;
    }

    if (!claimInfo.claimName && !claimInfo.businessPurpose) {
      addBotMessage(`⚠️ **Tip:** Set up your expense claim details first for a more professional report.\n\nSay "setup claim info" to add:\n• Claim Name\n• Business Purpose\n• Traveler Name\n• Department\n\nProceeding with PDF export...`);
    }

    setIsExporting(true);

    try {
      const filename = await exportToPDF(expenses, claimInfo, uploadedReceipts, companyTemplate);
      addBotMessage(`✅ PDF Report exported successfully!\n\nFile: **${filename}**\n\nThe report includes:\n• Cover page with claim details\n• Itemized expense summary\n• Category breakdown\n• ${uploadedReceipts.length} receipt(s) attached as appendix\n\n*Receipts are sorted by date order.*`);
    } catch (error) {
      console.error('PDF export error:', error);
      addBotMessage(`❌ Failed to export PDF: ${error.message}\n\nPlease try again or use Excel/CSV export instead.`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleClearAll = () => {
    if (expenses.length === 0) return;

    if (window.confirm('Are you sure you want to delete all expenses? This cannot be undone.')) {
      clearAllExpenses();
      addBotMessage('All expenses have been cleared. Start fresh by uploading new receipts!');
    }
  };

  const handleEditExpense = (expense) => {
    setCurrentExpense(expense);
    addBotMessage(`Editing expense: **${expense.vendor}** - $${expense.total.toFixed(2)}\n\nMake your changes in the form below.`);
  };

  const handleDeleteExpense = (id) => {
    const expense = expenses.find(e => e.id === id);
    if (window.confirm(`Delete expense "${expense?.vendor}"?`)) {
      removeExpense(id);
      addBotMessage(`Expense "${expense?.vendor}" has been removed.`);
    }
  };

  // Get unique categories for filter
  const categories = [...new Set(expenses.map(e => e.category))];

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>
          <Receipt size={24} />
          Expense Report
        </h2>
      </div>

      {/* Claim Info Summary */}
      {(claimInfo.claimName || claimInfo.businessPurpose) && (
        <div className="claim-info-summary">
          <div className="claim-info-header">
            <Briefcase size={16} />
            <span>{claimInfo.claimName || 'Expense Claim'}</span>
          </div>
          {claimInfo.businessPurpose && (
            <p className="claim-purpose">{claimInfo.businessPurpose.substring(0, 80)}...</p>
          )}
          {claimInfo.travelerName && (
            <span className="claim-traveler">{claimInfo.travelerName}</span>
          )}
        </div>
      )}

      {/* Template indicator */}
      {companyTemplate && (
        <div className="template-indicator">
          <FileText size={14} />
          <span>Using: {companyTemplate.name}</span>
          {!companyTemplate.fileContent && (
            <div className="template-warning">
              <AlertTriangle size={12} />
              <span>Please re-upload template for direct population</span>
            </div>
          )}
        </div>
      )}

      {/* Summary Section */}
      <div className="summary-section">
        <div className="summary-stats">
          <div className="stat-item">
            <DollarSign size={18} />
            <div className="stat-content">
              <span className="stat-value">${summary.totalAmount.toFixed(2)}</span>
              <span className="stat-label">Total</span>
            </div>
          </div>
          <div className="stat-item">
            <Receipt size={18} />
            <div className="stat-content">
              <span className="stat-value">{summary.totalExpenses}</span>
              <span className="stat-label">Receipts</span>
            </div>
          </div>
        </div>

        {/* Category breakdown */}
        {Object.keys(summary.byCategory).length > 0 && (
          <div className="category-breakdown">
            <h4>By Category</h4>
            <div className="category-list">
              {Object.entries(summary.byCategory).map(([category, data]) => (
                <div key={category} className="category-item">
                  <span className="category-name">{data.label}</span>
                  <span className="category-total">${data.total.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Warnings */}
        {summary.requiresAttention.length > 0 && (
          <div className="attention-banner">
            <AlertTriangle size={16} />
            <span>{summary.requiresAttention.length} item(s) need attention</span>
          </div>
        )}
      </div>

      {/* Export Actions */}
      <div className="export-section">
        <button
          className="btn-export primary"
          onClick={handleExportPDF}
          disabled={isExporting}
        >
          {isExporting ? (
            <>
              <span className="spinner-small"></span>
              Generating...
            </>
          ) : (
            <>
              <FileText size={18} />
              Export PDF
            </>
          )}
        </button>
        <button className="btn-export secondary" onClick={handleExportExcel}>
          <FileSpreadsheet size={18} />
          Export to Excel
        </button>
        <button className="btn-export tertiary" onClick={handleExportCSV}>
          <Download size={18} />
          Export CSV
        </button>
      </div>

      {/* Expense List */}
      <div className="expenses-section">
        <div
          className="section-toggle"
          onClick={() => setShowExpenses(!showExpenses)}
        >
          <h3>Expenses ({filteredExpenses.length})</h3>
          {showExpenses ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>

        {showExpenses && (
          <>
            {/* Filters */}
            {expenses.length > 0 && (
              <div className="expense-filters">
                <div className="filter-group">
                  <Filter size={14} />
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                  >
                    <option value="all">All Categories</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>
                        {EXPENSE_CATEGORY_LABELS[cat] || cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="filter-group">
                  <Calendar size={14} />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <option value="date">Sort by Date</option>
                    <option value="amount">Sort by Amount</option>
                    <option value="category">Sort by Category</option>
                  </select>
                </div>
              </div>
            )}

            {/* Expense Cards */}
            <div className="expense-list">
              {filteredExpenses.length === 0 ? (
                <div className="empty-state">
                  <Receipt size={32} />
                  <p>No expenses yet</p>
                  <span>Upload receipts to get started</span>
                </div>
              ) : (
                filteredExpenses.map(expense => (
                  <ExpenseCard
                    key={expense.id}
                    expense={expense}
                    compact
                    onEdit={handleEditExpense}
                    onDelete={handleDeleteExpense}
                  />
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Clear All */}
      {expenses.length > 0 && (
        <div className="clear-section">
          <button className="btn-clear" onClick={handleClearAll}>
            <Trash2 size={16} />
            Clear All Expenses
          </button>
        </div>
      )}
    </div>
  );
}
