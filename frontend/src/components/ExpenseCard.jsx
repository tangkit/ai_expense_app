import React from 'react';
import {
  Car,
  Plane,
  Hotel,
  Utensils,
  ParkingCircle,
  Fuel,
  Train,
  CreditCard,
  Receipt,
  AlertTriangle,
  Trash2,
  Edit2
} from 'lucide-react';
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS, MEAL_COMPANION_THRESHOLD } from '../constants/expenseTypes';

const CATEGORY_ICONS = {
  [EXPENSE_CATEGORIES.TAXI]: Car,
  [EXPENSE_CATEGORIES.RIDESHARE]: Car,
  [EXPENSE_CATEGORIES.HOTEL]: Hotel,
  [EXPENSE_CATEGORIES.FLIGHT]: Plane,
  [EXPENSE_CATEGORIES.MEAL]: Utensils,
  [EXPENSE_CATEGORIES.PARKING]: ParkingCircle,
  [EXPENSE_CATEGORIES.TOLL]: CreditCard,
  [EXPENSE_CATEGORIES.PUBLIC_TRANSPORT]: Train,
  [EXPENSE_CATEGORIES.CAR_RENTAL]: Car,
  [EXPENSE_CATEGORIES.FUEL]: Fuel,
  [EXPENSE_CATEGORIES.CONFERENCE]: Receipt,
  [EXPENSE_CATEGORIES.OFFICE_SUPPLIES]: Receipt,
  [EXPENSE_CATEGORIES.OTHER]: Receipt
};

export default function ExpenseCard({ expense, onEdit, onDelete, compact = false }) {
  const Icon = CATEGORY_ICONS[expense.category] || Receipt;

  // Check for issues
  const hasIssues = [];
  if (expense.category === EXPENSE_CATEGORIES.MEAL &&
      expense.total > MEAL_COMPANION_THRESHOLD &&
      !expense.companionName) {
    hasIssues.push('Missing companion name');
  }
  if (expense.category === EXPENSE_CATEGORIES.HOTEL &&
      (!expense.hotelItemization || expense.hotelItemization.length === 0)) {
    hasIssues.push('Missing itemization');
  }

  if (compact) {
    return (
      <div className={`expense-card compact ${hasIssues.length > 0 ? 'has-issues' : ''}`}>
        <div className="expense-icon">
          <Icon size={18} />
        </div>
        <div className="expense-info">
          <span className="vendor">{expense.vendor}</span>
          <span className="date">{expense.date}</span>
        </div>
        <div className="expense-amount">
          ${expense.total.toFixed(2)}
        </div>
        {hasIssues.length > 0 && (
          <AlertTriangle size={16} className="warning-icon" title={hasIssues.join(', ')} />
        )}
      </div>
    );
  }

  return (
    <div className={`expense-card ${hasIssues.length > 0 ? 'has-issues' : ''}`}>
      <div className="expense-card-header">
        <div className="expense-icon">
          <Icon size={24} />
        </div>
        <div className="expense-main-info">
          <h4 className="vendor">{expense.vendor}</h4>
          <span className="category">{EXPENSE_CATEGORY_LABELS[expense.category] || expense.category}</span>
        </div>
        <div className="expense-amount-container">
          <span className="amount">${expense.total.toFixed(2)}</span>
          <span className="currency">{expense.currency || 'USD'}</span>
        </div>
      </div>

      <div className="expense-details">
        <div className="detail-item">
          <span className="label">Date:</span>
          <span className="value">{expense.date}</span>
        </div>
        {expense.receiptNumber && (
          <div className="detail-item">
            <span className="label">Receipt #:</span>
            <span className="value">{expense.receiptNumber}</span>
          </div>
        )}
        {expense.paymentMethod && (
          <div className="detail-item">
            <span className="label">Payment:</span>
            <span className="value">{expense.paymentMethod}</span>
          </div>
        )}
        {expense.description && (
          <div className="detail-item">
            <span className="label">Description:</span>
            <span className="value">{expense.description}</span>
          </div>
        )}
      </div>

      {/* Hotel Itemization Summary */}
      {expense.category === EXPENSE_CATEGORIES.HOTEL && expense.hotelItemization?.length > 0 && (
        <div className="hotel-summary">
          <span className="summary-label">
            {expense.hotelItemization.length}-night stay itemized
          </span>
          <span className="summary-dates">
            {expense.checkInDate} to {expense.checkOutDate}
          </span>
        </div>
      )}

      {/* Companion Info */}
      {expense.category === EXPENSE_CATEGORIES.MEAL && expense.companionName && (
        <div className="companion-info">
          <span className="companion-label">Companion:</span>
          <span className="companion-name">{expense.companionName}</span>
          {expense.companionTitle && (
            <span className="companion-title">({expense.companionTitle})</span>
          )}
        </div>
      )}

      {/* Warnings */}
      {hasIssues.length > 0 && (
        <div className="expense-warnings">
          {hasIssues.map((issue, index) => (
            <div key={index} className="warning-item">
              <AlertTriangle size={14} />
              <span>{issue}</span>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {(onEdit || onDelete) && (
        <div className="expense-actions">
          {onEdit && (
            <button className="btn-edit" onClick={() => onEdit(expense)} title="Edit expense">
              <Edit2 size={16} />
            </button>
          )}
          {onDelete && (
            <button className="btn-delete" onClick={() => onDelete(expense.id)} title="Delete expense">
              <Trash2 size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
