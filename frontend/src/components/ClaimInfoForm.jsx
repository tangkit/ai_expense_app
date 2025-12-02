import React from 'react';
import { FileText, X, Save, Briefcase, User, Building, Calendar } from 'lucide-react';
import { useExpense } from '../context/ExpenseContext';

export default function ClaimInfoForm({ onSave, onCancel }) {
  const { claimInfo, updateClaimInfo } = useExpense();

  const handleChange = (field, value) => {
    updateClaimInfo({ [field]: value });
  };

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
        <div className="form-group">
          <label>
            <Briefcase size={16} />
            Expense Claim Name *
          </label>
          <input
            type="text"
            value={claimInfo.claimName || ''}
            onChange={(e) => handleChange('claimName', e.target.value)}
            placeholder="e.g., Q4 2024 Sales Conference Trip"
            required
          />
          <span className="help-text">A descriptive name for this expense report</span>
        </div>

        <div className="form-group">
          <label>
            <FileText size={16} />
            Business Purpose *
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

        <div className="form-row">
          <div className="form-group">
            <label>
              <User size={16} />
              Traveler Name
            </label>
            <input
              type="text"
              value={claimInfo.travelerName || ''}
              onChange={(e) => handleChange('travelerName', e.target.value)}
              placeholder="Your full name"
            />
          </div>

          <div className="form-group">
            <label>
              <Building size={16} />
              Department
            </label>
            <input
              type="text"
              value={claimInfo.department || ''}
              onChange={(e) => handleChange('department', e.target.value)}
              placeholder="e.g., Sales, Engineering"
            />
          </div>
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
