'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { ThemeConfig } from '../shared/theme';
import { showAlert } from '../shared/alerts';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';
import { commands } from '@uiw/react-md-editor';

const MDEditor = dynamic(
  () => import('@uiw/react-md-editor'),
  { ssr: false }
);

interface DualPanelEditorProps {
  isVisible: boolean;
  onClose: () => void;
  manuscriptContent: string;
  manuscriptName: string;
  aiReport: string;
  savedReportFileName: string | null;
  theme: ThemeConfig;
  isDarkMode: boolean;
  currentProject: string | null;
  currentProjectId: string | null;
  rootFolderId: string;
  session: any;
}

export default function DualPanelEditor({
  isVisible,
  onClose,
  manuscriptContent,
  manuscriptName,
  aiReport,
  savedReportFileName,
  theme,
  isDarkMode,
  currentProject,
  currentProjectId,
  rootFolderId,
  session
}: DualPanelEditorProps) {
  
  const [editedManuscript, setEditedManuscript] = useState('');
  const [editedAiReport, setEditedAiReport] = useState('');
  
  // Update state when props change
  React.useEffect(() => {
    setEditedManuscript(manuscriptContent);
    setEditedAiReport(aiReport);
  }, [manuscriptContent, aiReport]);

  const handleSaveManuscript = async () => {
    if (!currentProject || !currentProjectId || !editedManuscript.trim()) {
      showAlert('Please ensure project is selected and manuscript has content!', 'error', undefined, isDarkMode);
      return;
    }
    
    const defaultName = manuscriptName.replace('.txt', '') || `manuscript_${new Date().toISOString().slice(0,10)}`;
    const fileName = prompt('Enter filename for manuscript (without .txt extension):', defaultName);
    if (!fileName) return;
    
    const fullFileName = fileName.endsWith('.txt') ? fileName : `${fileName}.txt`;
    
    try {
      const { createGoogleDriveFileAction } = await import('@/lib/google-drive-actions');
      const result = await createGoogleDriveFileAction(session.accessToken as string, rootFolderId, editedManuscript, fullFileName, currentProjectId);
      
      if (result.success) {
        showAlert(`✅ Manuscript saved: ${fullFileName}`, 'success', undefined, isDarkMode);
      } else {
        showAlert(`❌ Failed to save manuscript: ${result.error}`, 'error', undefined, isDarkMode);
      }
    } catch (error) {
      showAlert(`❌ Error saving manuscript: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error', undefined, isDarkMode);
    }
  };

  const handleSaveAiReport = async () => {
    if (!currentProject || !currentProjectId || !editedAiReport.trim()) {
      showAlert('Please ensure project is selected and AI report has content!', 'error', undefined, isDarkMode);
      return;
    }
    
    if (!savedReportFileName) {
      showAlert('No saved report filename available!', 'error', undefined, isDarkMode);
      return;
    }
    
    // Use the actual saved report filename (without .txt extension)
    const actualReportName = savedReportFileName.replace('.txt', '');
    const fileName = prompt('Enter filename for AI report (without .txt extension):', actualReportName);
    if (!fileName) return;
    
    const fullFileName = fileName.endsWith('.txt') ? fileName : `${fileName}.txt`;
    
    try {
      const { createGoogleDriveFileAction } = await import('@/lib/google-drive-actions');
      const result = await createGoogleDriveFileAction(session.accessToken as string, rootFolderId, editedAiReport, fullFileName, currentProjectId);
      
      if (result.success) {
        showAlert(`✅ AI report saved: ${fullFileName}`, 'success', undefined, isDarkMode);
      } else {
        showAlert(`❌ Failed to save AI report: ${result.error}`, 'error', undefined, isDarkMode);
      }
    } catch (error) {
      showAlert(`❌ Error saving AI report: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error', undefined, isDarkMode);
    }
  };

  if (!isVisible) return null;

  const editorHeight = window.innerHeight - 160; // Account for header and save buttons

  // Use actual saved report filename only
  const getAiReportFilename = () => {
    return savedReportFileName || 'No report saved yet';
  };

  const filteredCommands = [
    commands.bold,
    commands.italic,
    commands.strikethrough,
    commands.hr,
    commands.divider,
    commands.title,
    commands.quote,
    commands.unorderedListCommand,
    commands.orderedListCommand,
    commands.checkedListCommand,
    // Excluded: commands.link, commands.code, commands.codeBlock, commands.image
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5' }}>
      {/* Header */}
      <div className="p-4 border-b flex justify-between items-center" style={{ 
        backgroundColor: theme.statusBg, 
        borderColor: theme.border,
        color: theme.text 
      }}>
        <h1 className="text-xl font-bold">manuscript</h1>
        <button 
          onClick={onClose}
          className="px-3 py-1 rounded"
          style={{ 
            backgroundColor: '#6c757d',
            color: '#fff',
            border: 'none',
            fontSize: '11px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          Close
        </button>
        <h1 className="text-xl font-bold">AI report</h1>
      </div>

      {/* Editor Container */}
      <div className="flex-1 flex overflow-hidden" data-color-mode={isDarkMode ? 'dark' : 'light'}>
        {/* Left Panel - Editable Manuscript */}
        <div className="w-1/2 relative flex flex-col" style={{ backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff' }}>
          <div className="p-2 border-b flex justify-between items-center" style={{ borderColor: theme.border }}>
            <span className="text-sm font-medium" style={{ color: theme.text }}>
              {manuscriptName}
            </span>
            <button
              onClick={handleSaveManuscript}
              style={{
                backgroundColor: '#28a745',
                color: '#fff',
                border: 'none',
                padding: '4px 12px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Save
            </button>
          </div>
          <div className="flex-1 p-2">
            <MDEditor
              value={editedManuscript}
              onChange={(val) => setEditedManuscript(val || '')}
              commands={filteredCommands}
              height={editorHeight}
              preview="edit"
              hideToolbar={false}
              textareaProps={{
                placeholder: `Edit ${manuscriptName}...`,
                style: {
                  fontSize: '16px',
                  lineHeight: '1.6',
                  fontFamily: 'Georgia, serif'
                }
              }}
            />
          </div>
        </div>

        {/* Fixed Divider */}
        <div className="w-1" style={{ backgroundColor: theme.border }}></div>

        {/* Right Panel - Editable AI Report */}
        <div className="w-1/2 relative flex flex-col" style={{ backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff' }}>
          <div className="p-2 border-b flex justify-between items-center" style={{ borderColor: theme.border }}>
            <span className="text-sm font-medium" style={{ color: theme.text }}>
              {getAiReportFilename()}
            </span>
            <button
              onClick={handleSaveAiReport}
              style={{
                backgroundColor: '#28a745',
                color: '#fff',
                border: 'none',
                padding: '4px 12px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Save
            </button>
          </div>
          <div className="flex-1 p-2">
            <MDEditor
              value={editedAiReport}
              onChange={(val) => setEditedAiReport(val || '')}
              commands={filteredCommands}
              height={editorHeight}
              preview="edit"
              hideToolbar={false}
              textareaProps={{
                placeholder: "Edit AI report (use as checklist - delete suggestions as you apply them)...",
                style: {
                  fontSize: '14px',
                  lineHeight: '1.6',
                  fontFamily: 'Georgia, serif'
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}