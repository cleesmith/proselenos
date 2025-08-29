// StoryGrind Editor Modal Component
// Extracted from app/page.tsx lines 1642-1786

'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { ThemeConfig } from '../shared/theme';
import { showAlert, showInputAlert } from '../shared/alerts';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';
import { commands } from '@uiw/react-md-editor';

const MDEditor = dynamic(
  () => import('@uiw/react-md-editor'),
  { ssr: false }
);

interface EditorModalProps {
  isOpen: boolean;
  theme: ThemeConfig;
  isDarkMode: boolean;
  currentProject: string | null;
  currentProjectId: string | null;
  currentFileName: string | null;
  currentFileId: string | null;
  editorMode: 'new' | 'existing';
  editorContent: string;
  onClose: () => void;
  onContentChange: (content: string) => void;
  onSaveFile: (content: string, filename?: string) => Promise<void>;
  onBrowseFiles: () => void;
}

export default function EditorModal({
  isOpen,
  theme,
  isDarkMode,
  currentProject,
  currentProjectId,
  currentFileName,
  currentFileId,
  editorMode,
  editorContent,
  onClose,
  onContentChange,
  onSaveFile,
  onBrowseFiles
}: EditorModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const handleSave = async () => {
    if (!editorContent.trim()) {
      showAlert('Cannot save empty content!', 'error', undefined, isDarkMode);
      return;
    }

    // Check for config file protection
    if (currentFileName && currentFileName.match(/storygrind.*\.json$/i)) {
      showAlert('Cannot edit configuration files!', 'error', undefined, isDarkMode);
      return;
    }

    setIsSaving(true);
    
    try {
      if (editorMode === 'existing' && currentFileId) {
        // Update existing file - no filename prompt needed
        await onSaveFile(editorContent);
        showAlert('✅ File updated successfully!', 'success', undefined, isDarkMode);
      } else {
        // New file mode - prompt for filename and require project
        if (!currentProject || !currentProjectId) {
          showAlert('Please select a Project to save new files!', 'error', undefined, isDarkMode);
          return;
        }
        
        const defaultName = `manuscript_${new Date().toISOString().slice(0,10)}`;
        const fileName = await showInputAlert(
          'Enter filename (without .txt extension):',
          defaultName,
          'Enter filename...',
          isDarkMode
        );
        if (!fileName) return; // User cancelled
        
        const fullFileName = fileName.endsWith('.txt') ? fileName : `${fileName}.txt`;
        await onSaveFile(editorContent, fullFileName);
        showAlert('✅ File saved successfully!', 'success', undefined, isDarkMode);
      }
    } catch (error: any) {
      const message = error instanceof Error ? error.message : 'Error saving file';
      showAlert(`❌ Failed to save file: ${message}`, 'error', undefined, isDarkMode);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBrowseFiles = async () => {
    if (!currentProjectId) {
      showAlert('Please select a Project first!', 'error', undefined, isDarkMode);
      return;
    }

    setIsOpening(true);

    try {
      await onBrowseFiles();
    } finally {
      setIsOpening(false);
    }
  };

  if (!isOpen) return null;

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
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.bg,
      zIndex: 2000,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Editor Header */}
      <div style={{
        backgroundColor: theme.headerBg,
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: `1px solid ${theme.border}`
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ 
            fontSize: '14px', 
            fontWeight: 'bold', 
            color: theme.text 
          }}>
            {editorMode === 'existing' && currentFileName ? 
              currentFileName 
              : (currentProject || 'No Project')
            }
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{
              padding: '3px 8px',
              backgroundColor: isSaving ? '#6c757d' : '#28a745',
              color: '#fff',
              border: 'none',
              borderRadius: '3px',
              fontSize: '11px',
              cursor: isSaving ? 'not-allowed' : 'pointer'
            }}
          >
{isSaving ? 'Saving…' : (editorMode === 'existing' ? 'Update' : 'Save as .txt')}
          </button>
          
          <button
            onClick={handleBrowseFiles}
            disabled={isOpening}
            style={{
              padding: '3px 8px',
              backgroundColor: isOpening ? '#6c757d' : '#6f42c1',
              color: '#fff',
              border: 'none',
              borderRadius: '3px',
              fontSize: '11px',
              cursor: isOpening ? 'not-allowed' : 'pointer'
            }}
          >
            {isOpening ? 'Opening…' : 'Open'}
          </button>
          
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
            Close
          </button>
        </div>
      </div>

      {/* Editor Content */}
      <div style={{ 
        flex: 1,
        padding: '16px',
        overflow: 'hidden'
      }} data-color-mode={isDarkMode ? 'dark' : 'light'}>
        <MDEditor
          value={editorContent}
          onChange={(val) => onContentChange(val || '')}
          commands={filteredCommands}
          height={window.innerHeight - 120}
          preview="edit"
          hideToolbar={false}
          textareaProps={{
            placeholder: `Write your content for ${currentProject || 'your project'}...`,
            style: {
              fontSize: '14px',
              lineHeight: '1.6',
              fontFamily: 'Georgia, serif'
            }
          }}
        />
      </div>
    </div>
  );
}