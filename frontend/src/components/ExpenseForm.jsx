import React, { useState, useEffect } from 'react';
import { Save, X, Plus, Trash2, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { format, addDays } from 'date-fns';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  MEAL_COMPANION_THRESHOLD
} from '../constants/expenseTypes';

// Currency symbol helper (with spacing for readability)
const getCurrencySymbol = (currencyCode) => {
  const symbols = {
    'MYR': 'RM ',
    'SGD': 'S$',
    'EUR': '€',
    'GBP': '£',
    'THB': '฿',
    'IDR': 'Rp ',
    'JPY': '¥',
    'USD': '$'
  };
  return symbols[currencyCode] || currencyCode + ' ';
};

export default function ExpenseForm({ expense, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    vendor: '',
    category: EXPENSE_CATEGORIES.OTHER,
    date: format(new Date(), 'yyyy-MM-dd'),
    amount: 0,
    tax: 0,
    total: 0,
    currency: 'SGD',  // Default to SGD (Singapore Dollar)
    receiptNumber: '',
    paymentMethod: 'Personal Card',  // Default to Personal Card
    description: '',
    businessPurpose: '',
    projectCode: '',
    notes: '',
    // Hotel specific
    checkInDate: '',
    checkOutDate: '',
    hotelItemization: [],
    // Meal specific
    companionName: '',
    companionTitle: '',
    attendeeCount: 1,
    discussionTopics: ''
  });

  const [errors, setErrors] = useState({});
  const [showItemization, setShowItemization] = useState(true);
  const [showCompanionFields, setShowCompanionFields] = useState(false);

  // Initialize form with expense data when expense prop changes
  useEffect(() => {
    if (expense) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData(prev => ({
        ...prev,
        ...expense,
        hotelItemization: expense.hotelItemization || []
      }));

      // Show companion fields if meal over threshold
      if (expense.category === EXPENSE_CATEGORIES.MEAL && expense.total > MEAL_COMPANION_THRESHOLD) {
        setShowCompanionFields(true);
      }
    }
  }, [expense]);

  // Check if companion is required
  const requiresCompanion = formData.category === EXPENSE_CATEGORIES.MEAL &&
    formData.total > MEAL_COMPANION_THRESHOLD;

  // Check if hotel itemization is needed
  const isHotel = formData.category === EXPENSE_CATEGORIES.HOTEL;

  const handleChange = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };

      // Auto-calculate total when amount or tax changes
      if (field === 'amount' || field === 'tax') {
        const amount = field === 'amount' ? parseFloat(value) || 0 : parseFloat(prev.amount) || 0;
        const tax = field === 'tax' ? parseFloat(value) || 0 : parseFloat(prev.tax) || 0;
        updated.total = Math.round((amount + tax) * 100) / 100;
      }

      // Show companion fields when category changes to meal
      if (field === 'category') {
        setShowCompanionFields(value === EXPENSE_CATEGORIES.MEAL && prev.total > MEAL_COMPANION_THRESHOLD);
      }

      // Show companion fields when total exceeds threshold for meals
      if (field === 'total' && prev.category === EXPENSE_CATEGORIES.MEAL) {
        setShowCompanionFields(parseFloat(value) > MEAL_COMPANION_THRESHOLD);
      }

      return updated;
    });

    // Clear error when field is edited
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleHotelItemChange = (index, field, value) => {
    setFormData(prev => {
      const items = [...prev.hotelItemization];
      items[index] = {
        ...items[index],
        [field]: parseFloat(value) || 0
      };

      // Recalculate daily total
      const item = items[index];
      item.dailyTotal = Math.round((
        (item.roomRate || 0) +
        (item.roomTax || 0) +
        (item.serviceCharge || 0) +
        (item.resortFee || 0) +
        (item.parkingFee || 0) +
        (item.otherFees || 0)
      ) * 100) / 100;

      // Recalculate grand total
      const grandTotal = items.reduce((sum, i) => sum + (i.dailyTotal || 0), 0);

      return {
        ...prev,
        hotelItemization: items,
        total: Math.round(grandTotal * 100) / 100
      };
    });
  };

  const addHotelNight = () => {
    setFormData(prev => {
      const lastNight = prev.hotelItemization[prev.hotelItemization.length - 1];
      const nextDate = lastNight
        ? format(addDays(new Date(lastNight.nightDate), 1), 'yyyy-MM-dd')
        : prev.checkInDate || format(new Date(), 'yyyy-MM-dd');

      return {
        ...prev,
        hotelItemization: [
          ...prev.hotelItemization,
          {
            id: uuidv4(),
            nightDate: nextDate,
            roomRate: 0,
            roomTax: 0,
            serviceCharge: 0,
            resortFee: 0,
            parkingFee: 0,
            otherFees: 0,
            dailyTotal: 0
          }
        ]
      };
    });
  };

  const removeHotelNight = (index) => {
    setFormData(prev => {
      const items = prev.hotelItemization.filter((_, i) => i !== index);
      const grandTotal = items.reduce((sum, i) => sum + (i.dailyTotal || 0), 0);

      return {
        ...prev,
        hotelItemization: items,
        total: Math.round(grandTotal * 100) / 100
      };
    });
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.vendor.trim()) {
      newErrors.vendor = 'Vendor name is required';
    }

    if (!formData.date) {
      newErrors.date = 'Date is required';
    }

    if (formData.total <= 0) {
      newErrors.total = 'Total must be greater than 0';
    }

    if (requiresCompanion && !formData.companionName.trim()) {
      newErrors.companionName = 'Companion name is required for meals over $25';
    }

    if (isHotel && formData.hotelItemization.length === 0) {
      newErrors.hotelItemization = 'Hotel expenses require per-night itemization';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    onSave({
      ...formData,
      id: expense?.id || uuidv4()
    });
  };

  return (
    <form className="expense-form" onSubmit={handleSubmit}>
      <div className="expense-form-header">
        <h3>Review Expense Details</h3>
        <div className="confidence-badge">
          {expense?.confidence && (
            <span className={`confidence ${expense.confidence > 0.9 ? 'high' : expense.confidence > 0.75 ? 'medium' : 'low'}`}>
              {Math.round(expense.confidence * 100)}% confidence
            </span>
          )}
        </div>
      </div>

      {/* Basic Information */}
      <div className="form-section">
        <h4>Basic Information</h4>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="vendor">Vendor/Merchant *</label>
            <input
              type="text"
              id="vendor"
              value={formData.vendor}
              onChange={(e) => handleChange('vendor', e.target.value)}
              className={errors.vendor ? 'error' : ''}
            />
            {errors.vendor && <span className="error-message">{errors.vendor}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="category">Category</label>
            <select
              id="category"
              value={formData.category}
              onChange={(e) => handleChange('category', e.target.value)}
            >
              {Object.entries(EXPENSE_CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="date">Date *</label>
            <input
              type="date"
              id="date"
              value={formData.date}
              onChange={(e) => handleChange('date', e.target.value)}
              className={errors.date ? 'error' : ''}
            />
            {errors.date && <span className="error-message">{errors.date}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="receiptNumber">
              {formData.category === EXPENSE_CATEGORIES.FLIGHT ? 'Booking#' :
               formData.category === EXPENSE_CATEGORIES.HOTEL ? 'Reservation#' :
               'Receipt/Invoice #'}
            </label>
            <input
              type="text"
              id="receiptNumber"
              value={formData.receiptNumber}
              onChange={(e) => handleChange('receiptNumber', e.target.value)}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="description">Description</label>
            <input
              type="text"
              id="description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Brief description of expense"
            />
          </div>

          <div className="form-group">
            <label htmlFor="paymentMethod">Payment Method</label>
            <select
              id="paymentMethod"
              value={formData.paymentMethod}
              onChange={(e) => handleChange('paymentMethod', e.target.value)}
            >
              <option value="Personal Card">Personal Card</option>
              <option value="Corporate Card">Corporate Card</option>
              <option value="Cash">Cash</option>
              <option value="App Payment">App Payment</option>
              <option value="Wire Transfer">Wire Transfer</option>
            </select>
          </div>
        </div>
      </div>

      {/* Amount Section */}
      {!isHotel && (
        <div className="form-section">
          <h4>Amount ({formData.currency})</h4>

          <div className="form-row amount-row">
            <div className="form-group">
              <label htmlFor="amount">Subtotal</label>
              <div className="currency-input">
                <span className="currency-symbol">{getCurrencySymbol(formData.currency)}</span>
                <input
                  type="number"
                  id="amount"
                  value={formData.amount}
                  onChange={(e) => handleChange('amount', e.target.value)}
                  step="0.01"
                  min="0"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="tax">Tax</label>
              <div className="currency-input">
                <span className="currency-symbol">{getCurrencySymbol(formData.currency)}</span>
                <input
                  type="number"
                  id="tax"
                  value={formData.tax}
                  onChange={(e) => handleChange('tax', e.target.value)}
                  step="0.01"
                  min="0"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="total">Total *</label>
              <div className="currency-input total">
                <span className="currency-symbol">{getCurrencySymbol(formData.currency)}</span>
                <input
                  type="number"
                  id="total"
                  value={formData.total}
                  onChange={(e) => handleChange('total', e.target.value)}
                  step="0.01"
                  min="0"
                  className={errors.total ? 'error' : ''}
                />
              </div>
              {errors.total && <span className="error-message">{errors.total}</span>}
            </div>
          </div>
        </div>
      )}

      {/* Hotel Itemization Section */}
      {isHotel && (
        <div className="form-section hotel-section">
          <div className="section-header" onClick={() => setShowItemization(!showItemization)}>
            <h4>
              Per-Night Itemization
              <span className="required-badge">Required</span>
            </h4>
            {showItemization ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>

          {showItemization && (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="checkInDate">Check-in Date</label>
                  <input
                    type="date"
                    id="checkInDate"
                    value={formData.checkInDate}
                    onChange={(e) => handleChange('checkInDate', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="checkOutDate">Check-out Date</label>
                  <input
                    type="date"
                    id="checkOutDate"
                    value={formData.checkOutDate}
                    onChange={(e) => handleChange('checkOutDate', e.target.value)}
                  />
                </div>
              </div>

              {errors.hotelItemization && (
                <div className="error-banner">
                  <AlertTriangle size={16} />
                  {errors.hotelItemization}
                </div>
              )}

              <div className="hotel-nights">
                {formData.hotelItemization.map((night, index) => (
                  <div key={night.id} className="hotel-night-item">
                    <div className="night-header">
                      <span className="night-label">Night {index + 1}</span>
                      <button
                        type="button"
                        className="remove-night"
                        onClick={() => removeHotelNight(index)}
                        title="Remove night"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="night-fields">
                      <div className="form-group compact">
                        <label>Date</label>
                        <input
                          type="date"
                          value={night.nightDate}
                          onChange={(e) => handleHotelItemChange(index, 'nightDate', e.target.value)}
                        />
                      </div>

                      <div className="form-group compact">
                        <label>Room Rate</label>
                        <div className="currency-input small">
                          <span>{getCurrencySymbol(formData.currency)}</span>
                          <input
                            type="number"
                            value={night.roomRate}
                            onChange={(e) => handleHotelItemChange(index, 'roomRate', e.target.value)}
                            step="0.01"
                          />
                        </div>
                      </div>

                      <div className="form-group compact">
                        <label>Room Tax</label>
                        <div className="currency-input small">
                          <span>{getCurrencySymbol(formData.currency)}</span>
                          <input
                            type="number"
                            value={night.roomTax}
                            onChange={(e) => handleHotelItemChange(index, 'roomTax', e.target.value)}
                            step="0.01"
                          />
                        </div>
                      </div>

                      <div className="form-group compact">
                        <label>Service Charge</label>
                        <div className="currency-input small">
                          <span>{getCurrencySymbol(formData.currency)}</span>
                          <input
                            type="number"
                            value={night.serviceCharge}
                            onChange={(e) => handleHotelItemChange(index, 'serviceCharge', e.target.value)}
                            step="0.01"
                          />
                        </div>
                      </div>

                      <div className="form-group compact">
                        <label>Resort Fee</label>
                        <div className="currency-input small">
                          <span>{getCurrencySymbol(formData.currency)}</span>
                          <input
                            type="number"
                            value={night.resortFee}
                            onChange={(e) => handleHotelItemChange(index, 'resortFee', e.target.value)}
                            step="0.01"
                          />
                        </div>
                      </div>

                      <div className="form-group compact">
                        <label>Parking</label>
                        <div className="currency-input small">
                          <span>{getCurrencySymbol(formData.currency)}</span>
                          <input
                            type="number"
                            value={night.parkingFee}
                            onChange={(e) => handleHotelItemChange(index, 'parkingFee', e.target.value)}
                            step="0.01"
                          />
                        </div>
                      </div>

                      <div className="form-group compact">
                        <label>Other Fees</label>
                        <div className="currency-input small">
                          <span>{getCurrencySymbol(formData.currency)}</span>
                          <input
                            type="number"
                            value={night.otherFees}
                            onChange={(e) => handleHotelItemChange(index, 'otherFees', e.target.value)}
                            step="0.01"
                          />
                        </div>
                      </div>

                      <div className="form-group compact daily-total">
                        <label>Daily Total</label>
                        <div className="currency-input small total">
                          <span>{getCurrencySymbol(formData.currency)}</span>
                          <input
                            type="number"
                            value={night.dailyTotal}
                            readOnly
                            className="readonly"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  className="add-night-button"
                  onClick={addHotelNight}
                >
                  <Plus size={16} />
                  Add Night
                </button>
              </div>

              <div className="hotel-grand-total">
                <span>Grand Total:</span>
                <strong>{getCurrencySymbol(formData.currency)}{formData.total.toFixed(2)}</strong>
              </div>
            </>
          )}
        </div>
      )}

      {/* Meal Companion Section */}
      {(requiresCompanion || showCompanionFields) && (
        <div className="form-section companion-section">
          <div className="section-header warning">
            <AlertTriangle size={20} />
            <h4>Companion Information Required</h4>
          </div>
          <p className="section-description">
            Meals exceeding ${MEAL_COMPANION_THRESHOLD} require documentation of dining companions for compliance purposes.
          </p>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="companionName">Companion/Customer Name *</label>
              <input
                type="text"
                id="companionName"
                value={formData.companionName}
                onChange={(e) => handleChange('companionName', e.target.value)}
                placeholder="Name of person(s) entertained"
                className={errors.companionName ? 'error' : ''}
              />
              {errors.companionName && <span className="error-message">{errors.companionName}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="companionTitle">Title/Company</label>
              <input
                type="text"
                id="companionTitle"
                value={formData.companionTitle}
                onChange={(e) => handleChange('companionTitle', e.target.value)}
                placeholder="Position and company"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="attendeeCount">Number of Attendees</label>
              <input
                type="number"
                id="attendeeCount"
                value={formData.attendeeCount}
                onChange={(e) => handleChange('attendeeCount', e.target.value)}
                min="1"
              />
            </div>

            <div className="form-group">
              <label htmlFor="businessPurpose">Business Purpose *</label>
              <input
                type="text"
                id="businessPurpose"
                value={formData.businessPurpose}
                onChange={(e) => handleChange('businessPurpose', e.target.value)}
                placeholder="Reason for the business meal"
              />
            </div>
          </div>

          <div className="form-group full-width">
            <label htmlFor="discussionTopics">Discussion Topics</label>
            <textarea
              id="discussionTopics"
              value={formData.discussionTopics}
              onChange={(e) => handleChange('discussionTopics', e.target.value)}
              placeholder="Brief summary of topics discussed"
              rows={2}
            />
          </div>
        </div>
      )}

      {/* Additional Information */}
      <div className="form-section">
        <h4>Additional Information</h4>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="projectCode">Project Code</label>
            <input
              type="text"
              id="projectCode"
              value={formData.projectCode}
              onChange={(e) => handleChange('projectCode', e.target.value)}
              placeholder="Optional project/cost center"
            />
          </div>

          <div className="form-group">
            <label htmlFor="businessPurpose2">Business Purpose</label>
            <input
              type="text"
              id="businessPurpose2"
              value={formData.businessPurpose}
              onChange={(e) => handleChange('businessPurpose', e.target.value)}
              placeholder="Purpose of expense"
            />
          </div>
        </div>

        <div className="form-group full-width">
          <label htmlFor="notes">Notes</label>
          <textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            placeholder="Any additional notes or comments"
            rows={2}
          />
        </div>
      </div>

      {/* Form Actions */}
      <div className="form-actions">
        <button type="button" className="btn-cancel" onClick={onCancel}>
          <X size={18} />
          Cancel
        </button>
        <button type="submit" className="btn-save">
          <Save size={18} />
          Save Expense
        </button>
      </div>
    </form>
  );
}
