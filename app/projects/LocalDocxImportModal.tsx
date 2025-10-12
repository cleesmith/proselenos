// Local DOCX Import Modal Component
// Allows users to select a local .docx file, convert it to text in the browser,
// and upload the result to their Google Drive project

'use client';

import { useRef, useState } from 'react';
import { ThemeConfig } from '../shared/theme';
import { showAlert } from '../shared/alerts';
import StyledSmallButton from '@/components/StyledSmallButton';
import { convertDocxToFormattedText } from '@/lib/docx-formatting-utils';
import { uploadTextToDrive } from '@/lib/docx-conversion-actions';

interface LocalDocxImportModalProps {
  isOpen: boolean;
  theme: ThemeConfig;
  isDarkMode: boolean;
  currentProject: string | null;
  currentProjectId: string | null;
  accessToken: string | null;
  isConverting: boolean;
  onClose: () => void;
  onConversionComplete: (fileName: string) => void;
  setUploadStatus: (status: string) => void;
}

export default function LocalDocxImportModal({
  isOpen,
  theme,
  isDarkMode,
  currentProject,
  currentProjectId,
  accessToken,
  isConverting: externalConverting,
  onClose,
  onConversionComplete,
  setUploadStatus
}: LocalDocxImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isConverting, setIsConverting] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      const fileName = file.name.toLowerCase();
      if (!fileName.endsWith('.docx')) {
        showAlert('Please select a .docx file only.', 'warning', undefined, isDarkMode);
        return;
      }

      setSelectedFile(file);
    }
  };

  const handleChooseFile = () => {
    if (!fileInputRef.current) return;
    fileInputRef.current.click();
  };

  const handleConvert = async () => {
    if (!selectedFile || !currentProjectId || !accessToken) {
      showAlert('Missing required information', 'error', undefined, isDarkMode);
      return;
    }

    setIsConverting(true);
    setUploadStatus('Converting DOCX to TXT in browser...');

    try {
      // Read the .docx file into an ArrayBuffer
      const arrayBuffer = await selectedFile.arrayBuffer();

      // Convert DOCX to formatted text with proper spacing
      // This mirrors the old server-side logic: sections, headings, and paragraphs
      // are properly spaced with blank lines
      const text = await convertDocxToFormattedText(arrayBuffer);

      setUploadStatus('Uploading to Google Drive...');

      // Derive a .txt file name from the original .docx file name
      const txtFileName = selectedFile.name.replace(/\.docx$/i, '.txt');

      // Upload to Google Drive using server action
      const uploadResult = await uploadTextToDrive(text, txtFileName, currentProjectId, accessToken);

      setUploadStatus(`✅ Conversion complete: ${txtFileName}`);

      showAlert(
        `Conversion complete!\n\nOutput: ${txtFileName}`,
        'success',
        'DOCX Conversion Complete',
        isDarkMode
      );

      onConversionComplete(txtFileName);

      // Clean up and close
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onClose();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      setUploadStatus(`❌ Conversion failed: ${errorMsg}`);
      showAlert(`Conversion error: ${errorMsg}`, 'error', undefined, isDarkMode);
    } finally {
      setIsConverting(false);
    }
  };

  const converting = isConverting || externalConverting;

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
            Import DOCX File
          </h3>
          <StyledSmallButton onClick={onClose} disabled={converting} theme={theme}>
            Close
          </StyledSmallButton>
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
          marginBottom: '20px',
          padding: '12px',
          backgroundColor: isDarkMode ? 'rgba(100, 150, 255, 0.1)' : 'rgba(66, 133, 244, 0.1)',
          borderRadius: '4px',
          fontSize: '13px',
          color: theme.text,
          border: `1px solid ${isDarkMode ? 'rgba(100, 150, 255, 0.3)' : 'rgba(66, 133, 244, 0.3)'}`
        }}>
          💡 <strong>How it works:</strong> Select a .docx file from your computer. The file will be converted to plain text in your browser (images removed), then uploaded to your Google Drive project.
        </div>

        <div style={{
          marginBottom: '20px'
        }}>
          <p style={{
            margin: '0 0 12px 0',
            fontSize: '14px',
            color: theme.textMuted
          }}>
            Select a .docx file from your computer:
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFileChange}
            style={{ display: 'none' }}
            disabled={converting}
          />

          <StyledSmallButton onClick={handleChooseFile} disabled={converting} theme={theme}>
            {converting ? 'Converting...' : 'Choose File'}
          </StyledSmallButton>

          {selectedFile && (
            <div style={{
              marginTop: '12px',
              padding: '8px',
              backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
              borderRadius: '4px',
              fontSize: '14px',
              color: theme.text
            }}>
              <strong>Selected:</strong> {selectedFile.name} ({Math.round(selectedFile.size / 1024)}KB)
            </div>
          )}
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px'
        }}>
          <StyledSmallButton onClick={onClose} disabled={converting} theme={theme}>
            Cancel
          </StyledSmallButton>

          <StyledSmallButton onClick={handleConvert} disabled={!selectedFile || converting} theme={theme}>
            {converting ? 'Converting...' : 'Convert & Upload'}
          </StyledSmallButton>
        </div>
      </div>
    </div>
  );
}
