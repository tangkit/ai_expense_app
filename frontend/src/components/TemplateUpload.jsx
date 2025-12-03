import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileSpreadsheet, X, Check, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
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
      'application/msexcel': ['.xls'],
      'application/x-msexcel': ['.xls'],
      'application/x-ms-excel': ['.xls'],
      'application/x-excel': ['.xls'],
      'application/xls': ['.xls'],
      'application/excel': ['.xls'],
      'text/csv': ['.csv'],
      'application/csv': ['.csv']
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

// Parse template file to extract structure using xlsx library
async function parseTemplateFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = event.target.result;
        let columns = [];
        let sheetData = [];

        console.log('=== TemplateUpload: Parsing Template File ===');
        console.log('File name:', file.name);
        console.log('File type:', file.type);

        if (file.name.toLowerCase().endsWith('.csv')) {
          // Parse CSV
          const text = new TextDecoder().decode(data);
          const lines = text.split('\n');
          if (lines.length > 0) {
            columns = lines[0].split(',').map(col => col.trim().replace(/"/g, ''));
          }
          console.log('CSV columns:', columns);
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
            let headerRowIndex = 0;
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

        resolve({
          name: file.name,
          columns: columns,
          sampleData: sheetData,
          uploadedAt: new Date().toISOString(),
          fileType: file.type || 'application/vnd.ms-excel'
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
