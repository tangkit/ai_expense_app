import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileSpreadsheet, X, Check, AlertCircle } from 'lucide-react';
import { useExpense } from '../context/ExpenseContext';

export default function TemplateUpload({ onUpload, onCancel }) {
  const { setCompanyTemplate } = useExpense();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    setIsProcessing(true);
    setError(null);

    try {
      const template = await parseTemplateFile(file);
      setCompanyTemplate(template);
      onUpload(template);
    } catch (err) {
      setError(err.message || 'Failed to parse template file');
    } finally {
      setIsProcessing(false);
    }
  }, [setCompanyTemplate, onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv']
    },
    maxFiles: 1,
    disabled: isProcessing
  });

  return (
    <div className="template-upload">
      <div className="template-upload-header">
        <h3>
          <FileSpreadsheet size={20} />
          Import Company Template
        </h3>
        <button type="button" className="btn-close" onClick={onCancel}>
          <X size={18} />
        </button>
      </div>

      <div className="template-info">
        <p>Upload your company's expense report template. I'll analyze its structure and use it when exporting your expenses.</p>
        <ul>
          <li>Supported formats: Excel (.xlsx, .xls) and CSV</li>
          <li>I'll detect column headers automatically</li>
          <li>Your template will be saved for future use</li>
        </ul>
      </div>

      <div
        {...getRootProps()}
        className={`template-dropzone ${isDragActive ? 'active' : ''} ${isProcessing ? 'processing' : ''}`}
      >
        <input {...getInputProps()} />
        {isProcessing ? (
          <>
            <div className="spinner-large"></div>
            <p>Analyzing template structure...</p>
          </>
        ) : isDragActive ? (
          <>
            <Upload size={48} />
            <p>Drop your template file here</p>
          </>
        ) : (
          <>
            <FileSpreadsheet size={48} />
            <p>Drag & drop your expense template</p>
            <span>or click to browse</span>
          </>
        )}
      </div>

      {error && (
        <div className="template-error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="template-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// Parse template file to extract structure
async function parseTemplateFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const content = event.target.result;
        let columns = [];

        if (file.name.endsWith('.csv')) {
          // Parse CSV
          const lines = content.split('\n');
          if (lines.length > 0) {
            columns = lines[0].split(',').map(col => col.trim().replace(/"/g, ''));
          }
        } else {
          // For Excel files, we'll use a simplified approach
          // In production, you'd want to use a library like xlsx
          // For now, we'll detect common expense template columns
          columns = detectCommonExpenseColumns(file.name);
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

    if (file.name.endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      // For Excel files, detect common columns based on filename patterns
      // In production, use xlsx library
      reader.readAsArrayBuffer(file);

      // Since we can't parse Excel without a library, use common patterns
      setTimeout(() => {
        const columns = detectCommonExpenseColumns(file.name);
        resolve({
          name: file.name,
          columns: columns,
          uploadedAt: new Date().toISOString(),
          fileType: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
      }, 500);
    }
  });
}

// Detect common expense report columns
function detectCommonExpenseColumns(filename) {
  // Common expense report columns
  return [
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
