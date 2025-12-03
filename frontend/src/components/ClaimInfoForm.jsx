import React, { useEffect } from 'react';
import { FileText, X, Save, Briefcase, User, Building, Calendar, BadgeCheck, UserCheck } from 'lucide-react';
import { useExpense } from '../context/ExpenseContext';

/**
 * Generate expense title from business purpose
 */
function generateExpenseTitle(businessPurpose) {
  if (!businessPurpose || businessPurpose.trim().length === 0) {
    return '';
  }

  // Extract key words and create a concise title
  const purpose = businessPurpose.trim();

  // Common patterns to extract
  const patterns = [
    /(?:for|to|attend|attending)\s+(.+?)(?:\s+in\s+|\s+at\s+|$)/i,
    /(.+?)\s+(?:trip|travel|conference|meeting|visit)/i,
    /(?:business\s+)?trip\s+(?:to|for)\s+(.+)/i,
  ];

  for (const pattern of patterns) {
    const match = purpose.match(pattern);
    if (match && match[1]) {
      // Capitalize first letter of each word
      return match[1]
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
        .substring(0, 50); // Limit length
    }
  }

  // Fallback: use first 50 chars of purpose
  return purpose.substring(0, 50) + (purpose.length > 50 ? '...' : '');
}

export default function ClaimInfoForm({ onSave, onCancel }) {
  const { claimInfo, updateClaimInfo } = useExpense();

  const handleChange = (field, value) => {
    updateClaimInfo({ [field]: value });

    // Auto-generate expense title when business purpose changes
    if (field === 'businessPurpose') {
      const title = generateExpenseTitle(value);
      updateClaimInfo({ expenseTitle: title });
    }
  };

  // Generate initial title if business purpose exists but title doesn't
  useEffect(() => {
    if (claimInfo.businessPurpose && !claimInfo.expenseTitle) {
      const title = generateExpenseTitle(claimInfo.businessPurpose);
      updateClaimInfo({ expenseTitle: title });
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave();
  };

  return (
    <div className="claim-info-form">
      <div className="form-header">
        <h3>
          <FileText size={20} />
          Expense Claim Details
        </h3>
        <button type="button" className="btn-close" onClick={onCancel}>
          <X size={18} />
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Employee Information Section */}
        <div className="form-section">
          <h4>Employee Information</h4>
          <p className="section-note">This information is saved and will be remembered for future claims.</p>

          <div className="form-group">
            <label>
              <User size={16} />
              Employee Name *
            </label>
            <input
              type="text"
              value={claimInfo.employeeName || ''}
              onChange={(e) => handleChange('employeeName', e.target.value)}
              placeholder="Your full name"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>
                <BadgeCheck size={16} />
                Job Position *
              </label>
              <input
                type="text"
                value={claimInfo.jobPosition || ''}
                onChange={(e) => handleChange('jobPosition', e.target.value)}
                placeholder="e.g., Sales Manager, Software Engineer"
                required
              />
            </div>

            <div className="form-group">
              <label>
                <Building size={16} />
                Department *
              </label>
              <input
                type="text"
                value={claimInfo.department || ''}
                onChange={(e) => handleChange('department', e.target.value)}
                placeholder="e.g., Sales, Engineering, Marketing"
                required
              />
            </div>
          </div>
        </div>

        {/* Trip/Claim Details Section */}
        <div className="form-section">
          <h4>Trip Details</h4>

          <div className="form-group">
            <label>
              <FileText size={16} />
              Purpose of Business Trip *
            </label>
            <textarea
              value={claimInfo.businessPurpose || ''}
              onChange={(e) => handleChange('businessPurpose', e.target.value)}
              placeholder="e.g., Attended annual sales conference in Chicago to meet with key clients and present new product offerings"
              rows={3}
              required
            />
            <span className="help-text">Explain the business reason for these expenses</span>
          </div>

          <div className="form-group">
            <label>
              <Briefcase size={16} />
              Expense Title
            </label>
            <input
              type="text"
              value={claimInfo.expenseTitle || ''}
              onChange={(e) => handleChange('expenseTitle', e.target.value)}
              placeholder="Auto-generated from business purpose"
            />
            <span className="help-text">Auto-generated from purpose. You can edit if needed.</span>
          </div>

          <div className="form-group">
            <label>
              <Calendar size={16} />
              Submission Date
            </label>
            <input
              type="date"
              value={claimInfo.submissionDate || new Date().toISOString().split('T')[0]}
              onChange={(e) => handleChange('submissionDate', e.target.value)}
            />
          </div>
        </div>

        {/* Approval Section */}
        <div className="form-section">
          <h4>Approval Information</h4>

          <div className="form-row">
            <div className="form-group">
              <label>
                <UserCheck size={16} />
                Manager/Approver Name *
              </label>
              <input
                type="text"
                value={claimInfo.approverName || ''}
                onChange={(e) => handleChange('approverName', e.target.value)}
                placeholder="Your manager's name"
                required
              />
            </div>

            <div className="form-group">
              <label>
                <BadgeCheck size={16} />
                Approver's Title
              </label>
              <input
                type="text"
                value={claimInfo.approverTitle || ''}
                onChange={(e) => handleChange('approverTitle', e.target.value)}
                placeholder="e.g., Director, VP of Sales"
              />
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            <Save size={16} />
            Save Claim Details
          </button>
        </div>
      </form>
    </div>
  );
}
