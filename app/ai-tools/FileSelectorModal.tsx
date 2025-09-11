// File Selector Modal Component for AI Tools
// Extracted from app/page.tsx lines 1788-1925

'use client';

import { ThemeConfig } from '../shared/theme';

interface FileSelectorModalProps {
  isOpen: boolean;
  theme: ThemeConfig;
  isDarkMode: boolean;
  fileSelectorFiles: any[];
  selectedManuscriptForTool: any | null;
  selectedTool?: string;
  onClose: () => void;
  onSelectFile: (file: any) => void;
}

export default function FileSelectorModal({
  isOpen,
  theme,
  isDarkMode,
  fileSelectorFiles,
  selectedManuscriptForTool,
  selectedTool,
  onClose,
  onSelectFile
}: FileSelectorModalProps) {
  
  if (!isOpen) return null;

  // Determine modal title and description based on selected tool
  const isDocxCommentsTool = selectedTool === 'DOCX: Extract Comments as Text';
  const isEpubConverterTool = selectedTool === 'EPUB to TXT Converter';
  
  let modalTitle, modalDescription, noFilesMessage;
  
  if (isDocxCommentsTool) {
    modalTitle = 'Select DOCX File';
    modalDescription = 'Choose a DOCX file to extract comments from:';
    noFilesMessage = 'No DOCX files found in project';
  } else if (isEpubConverterTool) {
    modalTitle = 'Select EPUB File';
    modalDescription = 'Choose an EPUB file from your project to convert:';
    noFilesMessage = 'No EPUB files found in project';
  } else {
    modalTitle = 'Select Manuscript File';
    modalDescription = 'Choose a text file from your project to use as manuscript content:';
    noFilesMessage = 'No text files found in project';
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 3000
    }}>
      <div style={{
        backgroundColor: theme.modalBg,
        border: `2px solid ${theme.border}`,
        borderRadius: '8px',
        padding: '20px',
        maxWidth: 'min(900px, 95vw)', //'500px',
        width: '90%',
        maxHeight: '60vh',
        overflowY: 'auto'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '20px' 
        }}>
          <div style={{ 
            color: theme.text, 
            fontSize: '16px', 
            fontWeight: 'bold' 
          }}>
            {modalTitle}
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '3px 8px',
              backgroundColor: '#6c757d',
              color: '#fff',
              border: 'none',
              borderRadius: '3px',
              fontSize: '11px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
        </div>

        <div style={{ 
          fontSize: '12px', 
          color: theme.textSecondary, 
          marginBottom: '12px' 
        }}>
          {modalDescription}
        </div>

        {fileSelectorFiles.length === 0 ? (
          <p style={{ color: theme.textMuted, textAlign: 'center' }}>{noFilesMessage}</p>
        ) : (
          <div style={{ 
            backgroundColor: isDarkMode ? '#222' : '#f8f9fa', 
            borderRadius: '4px',
            overflow: 'hidden'
          }}>
            {fileSelectorFiles.map((file: any) => {
              const isDoc = file.mimeType === 'application/vnd.google-apps.document';
              const isSelected = selectedManuscriptForTool?.id === file.id;
              
              return (
                <div
                  key={file.id}
                  onClick={() => onSelectFile(file)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 16px',
                    borderBottom: `1px solid ${isDarkMode ? '#333' : '#e0e0e0'}`,
                    cursor: 'pointer',
                    fontSize: '14px',
                    backgroundColor: isSelected ? (isDarkMode ? '#2a4d2a' : '#d4edda') : 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = isDarkMode ? '#2a2a2a' : '#f0f0f0';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >

                  <div style={{ 
                    flex: '1',
                    color: isDoc ? '#4285F4' : '#34A853',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    wordBreak: 'break-word'
                  }}>
                    {isDoc ? <span>📝</span> : <span>📄</span>}
                    {file.name}
                  </div>

                  <div style={{
                    padding: '4px 8px',
                    backgroundColor: isSelected ? '#198754' : '#28a745',
                    color: 'white',
                    borderRadius: '4px',
                    fontSize: '12px'
                  }}>
                    {isSelected ? 'Selected' : 'Select'}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}