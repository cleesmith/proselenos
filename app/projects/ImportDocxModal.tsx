// DOCX Import Modal Component
// Extracted from app/page.tsx lines 1954-2176 (DOCX file selector + filename dialog)

'use client';

import { ThemeConfig } from '../shared/theme';

interface ImportDocxModalProps {
  // Visibility states
  showDocxSelector: boolean;
  showFilenameDialog: boolean;
  
  // Data
  docxFiles: any[];
  selectedDocxFile: any | null;
  outputFileName: string;
  isConverting: boolean;
  
  // Theme
  theme: ThemeConfig;
  isDarkMode: boolean;
  
  // Callbacks
  onSelectFile: (file: any) => void;
  onCancelFileSelector: () => void;
  onFilenameChange: (filename: string) => void;
  onCancelFilename: () => void;
  onConfirmConversion: () => void;
}

export default function ImportDocxModal({
  showDocxSelector,
  showFilenameDialog,
  docxFiles,
  selectedDocxFile,
  outputFileName,
  isConverting,
  theme,
  isDarkMode,
  onSelectFile,
  onCancelFileSelector,
  onFilenameChange,
  onCancelFilename,
  onConfirmConversion
}: ImportDocxModalProps) {
  
  if (!showDocxSelector && !showFilenameDialog) return null;
  
  return (
    <>
      {/* DOCX File Selector Modal */}
      {showDocxSelector && (
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
            maxWidth: '500px',
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
                Select DOCX File to Convert
              </div>
              <button
                onClick={onCancelFileSelector}
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
              Choose a DOCX file from your project to convert to TXT:
            </div>

            {docxFiles.length === 0 ? (
              <p style={{ color: theme.textMuted, textAlign: 'center' }}>No DOCX files found in project</p>
            ) : (
              <div style={{ 
                backgroundColor: isDarkMode ? '#222' : '#f8f9fa', 
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                {docxFiles.map((file: any) => (
                  <div
                    key={file.id}
                    onClick={() => onSelectFile(file)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '12px 16px',
                      borderBottom: `1px solid ${isDarkMode ? '#333' : '#e0e0e0'}`,
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = isDarkMode ? '#2a2a2a' : '#f0f0f0';
                    }}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <div style={{ 
                      flex: '1',
                      color: '#FF6B35',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span>📄</span>
                      {file.name}
                    </div>
                    <div style={{
                      padding: '4px 8px',
                      backgroundColor: '#9C27B0',
                      color: 'white',
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}>
                      Convert
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filename Input Dialog */}
      {showFilenameDialog && (
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
            width: '400px',
            maxWidth: '90%'
          }}>
            <div style={{ 
              color: theme.text, 
              fontSize: '16px', 
              fontWeight: 'bold',
              marginBottom: '15px'
            }}>
              Output Filename
            </div>
            
            <div style={{ 
              fontSize: '12px', 
              color: theme.textSecondary, 
              marginBottom: '15px' 
            }}>
              Enter name for the output text file:
            </div>
            
            <input
              type="text"
              value={outputFileName}
              onChange={(e) => onFilenameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onConfirmConversion();
                }
              }}
              style={{
                width: '100%',
                padding: '8px',
                backgroundColor: theme.inputBg,
                color: theme.text,
                border: `1px solid ${theme.border}`,
                borderRadius: '4px',
                fontSize: '14px',
                marginBottom: '20px',
                boxSizing: 'border-box'
              }}
              placeholder="Enter filename..."
              autoFocus
            />
            
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px'
            }}>
              <button
                onClick={onCancelFilename}
                disabled={isConverting}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'transparent',
                  color: '#4285F4',
                  border: '1px solid #4285F4',
                  borderRadius: '4px',
                  cursor: isConverting ? 'not-allowed' : 'pointer',
                  fontSize: '12px'
                }}
              >
                Cancel
              </button>
              
              <button
                onClick={onConfirmConversion}
                disabled={!outputFileName.trim() || isConverting}
                style={{
                  padding: '8px 16px',
                  backgroundColor: (!outputFileName.trim() || isConverting) ? '#666' : '#9C27B0',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: (!outputFileName.trim() || isConverting) ? 'not-allowed' : 'pointer',
                  fontSize: '12px'
                }}
              >
                {isConverting ? 'Converting...' : 'Convert'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}