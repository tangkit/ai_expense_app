import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, FileImage, FileText, File } from 'lucide-react';

const ACCEPTED_FILE_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf'],
  'image/heic': ['.heic'],
  'image/heif': ['.heif']
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default function FileUpload({ onUpload, onCancel }) {
  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    if (rejectedFiles.length > 0) {
      const errors = rejectedFiles.map(({ file, errors }) => {
        const errorMessages = errors.map(e => {
          if (e.code === 'file-too-large') return `${file.name} is too large (max 10MB)`;
          if (e.code === 'file-invalid-type') return `${file.name} has an unsupported format`;
          return e.message;
        });
        return errorMessages.join(', ');
      });
      alert(`Upload errors:\n${errors.join('\n')}`);
    }

    if (acceptedFiles.length > 0) {
      onUpload(acceptedFiles);
    }
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive, isDragAccept, isDragReject } = useDropzone({
    onDrop,
    accept: ACCEPTED_FILE_TYPES,
    maxSize: MAX_FILE_SIZE,
    multiple: true
  });

  const getDropzoneClass = () => {
    let className = 'dropzone';
    if (isDragActive) className += ' active';
    if (isDragAccept) className += ' accept';
    if (isDragReject) className += ' reject';
    return className;
  };

  return (
    <div className="file-upload">
      <div className="file-upload-header">
        <h3>Upload Receipt</h3>
        <button className="close-button" onClick={onCancel} title="Cancel">
          <X size={20} />
        </button>
      </div>

      <div {...getRootProps()} className={getDropzoneClass()}>
        <input {...getInputProps()} />

        <div className="dropzone-content">
          <Upload size={48} className="upload-icon" />

          {isDragActive ? (
            isDragReject ? (
              <p className="dropzone-text error">This file type is not supported</p>
            ) : (
              <p className="dropzone-text">Drop the files here...</p>
            )
          ) : (
            <>
              <p className="dropzone-text">
                Drag & drop receipts here, or click to select
              </p>
              <p className="dropzone-subtext">
                Supports JPG, PNG, PDF • Max 10MB
              </p>
            </>
          )}
        </div>
      </div>

      <div className="supported-formats">
        <h4>Supported Receipt Types:</h4>
        <div className="format-list">
          <div className="format-item">
            <FileImage size={16} />
            <span>Images (JPG, PNG, HEIC)</span>
          </div>
          <div className="format-item">
            <FileText size={16} />
            <span>PDF Documents</span>
          </div>
          <div className="format-item">
            <File size={16} />
            <span>Scanned Receipts</span>
          </div>
        </div>
      </div>

      <div className="upload-tips">
        <h4>Tips for best results:</h4>
        <ul>
          <li>Ensure the receipt is clearly visible and well-lit</li>
          <li>Include the entire receipt in the frame</li>
          <li>Avoid blurry or cropped images</li>
          <li>For hotel receipts, upload the final folio</li>
        </ul>
      </div>
    </div>
  );
}
