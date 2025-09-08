// Upload Modal Component
// Allows users to upload .docx or .txt files to their selected project

'use client';

import { useRef } from 'react';
import { ThemeConfig } from '../shared/theme';
import { showAlert } from '../shared/alerts';

interface UploadModalProps {
  isOpen: boolean;
  theme: ThemeConfig;
  isDarkMode: boolean;
  currentProject: string | null;
  selectedUploadFile: File | null;
  isUploading: boolean;
  onClose: () => void;
  onFileSelect: (file: File) => void;
  onUpload: () => void;
}

export default function UploadModal({
  isOpen,
  theme,
  isDarkMode,
  currentProject,
  selectedUploadFile,
  isUploading,
  onClose,
  onFileSelect,
  onUpload
}: UploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedExtensions = ['.txt', '.docx', '.epub', '.pdf'];
      const fileName = file.name.toLowerCase();
      const isValidFile = allowedExtensions.some(ext => fileName.endsWith(ext));
      
      if (!isValidFile) {
        showAlert('Please select a .txt, .docx, .epub, or .pdf file only.', 'warning', undefined, isDarkMode);
        return;
      }
      
      onFileSelect(file);
    }
  };

  const handleUploadClick = () => {
    if (!fileInputRef.current) return;
    fileInputRef.current.click();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: theme.bg,
        border: `1px solid ${theme.border}`,
        borderRadius: '8px',
        padding: '24px',
        width: '90%',
        maxWidth: '500px',
        color: theme.text
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h3 style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: 'bold'
          }}>
            Upload File to Project
          </h3>
          <button
            onClick={onClose}
            disabled={isUploading}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: isUploading ? 'not-allowed' : 'pointer',
              color: theme.text,
              opacity: isUploading ? 0.5 : 1
            }}
          >
            ×
          </button>
        </div>

        <div style={{
          marginBottom: '20px',
          padding: '12px',
          backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
          borderRadius: '4px',
          fontSize: '14px'
        }}>
          <strong>Project:</strong> {currentProject || 'No project selected'}
        </div>

        <div style={{
          marginBottom: '20px'
        }}>
          <p style={{
            margin: '0 0 12px 0',
            fontSize: '14px',
            color: theme.textMuted
          }}>
            Select a .txt, .docx, .epub, or .pdf file to upload to your project:
          </p>
          
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.docx,.epub,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/epub+zip,application/pdf"
            onChange={handleFileChange}
            style={{ display: 'none' }}
            disabled={isUploading}
          />
          
          <button
            onClick={handleUploadClick}
            disabled={isUploading}
            style={{
              padding: '12px 20px',
              backgroundColor: isUploading ? '#666' : '#4285F4',
              color: isUploading ? '#999' : '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: isUploading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              marginRight: '12px'
            }}
          >
            {isUploading ? 'Uploading...' : 'Choose File'}
          </button>
          
          {selectedUploadFile && (
            <span style={{
              fontSize: '14px',
              color: theme.textMuted
            }}>
              Selected: {selectedUploadFile.name} ({Math.round(selectedUploadFile.size / 1024)}KB)
            </span>
          )}
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px'
        }}>
          <button
            onClick={onClose}
            disabled={isUploading}
            style={{
              padding: '8px 16px',
              backgroundColor: 'transparent',
              color: theme.text,
              border: `1px solid ${theme.border}`,
              borderRadius: '4px',
              cursor: isUploading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              opacity: isUploading ? 0.5 : 1
            }}
          >
            Cancel
          </button>
          
          <button
            onClick={onUpload}
            disabled={!selectedUploadFile || isUploading}
            style={{
              padding: '8px 16px',
              backgroundColor: (!selectedUploadFile || isUploading) ? '#666' : '#10b981',
              color: (!selectedUploadFile || isUploading) ? '#999' : '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: (!selectedUploadFile || isUploading) ? 'not-allowed' : 'pointer',
              fontSize: '14px'
            }}
          >
            {isUploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}
