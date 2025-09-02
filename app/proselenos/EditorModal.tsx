// Editor modal component

'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import React from 'react';
import { ThemeConfig } from '../shared/theme';
import { showAlert, showInputAlert } from '../shared/alerts';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';

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
  
  // TTS state variables
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentUtterance, setCurrentUtterance] = useState<any>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const handleSave = async () => {
    if (!editorContent.trim()) {
      showAlert('Cannot save empty content!', 'error', undefined, isDarkMode);
      return;
    }

    // Check for config file protection
    if (currentFileName && currentFileName.match(/proselenos.*\.json$/i)) {
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
      const message = error instanceof Error ? error.message : 'Save failed';
      showAlert(`❌ Save failed: ${message}`, 'error', undefined, isDarkMode);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBrowseFiles = () => {
    setIsOpening(true);
    onBrowseFiles();
    setTimeout(() => setIsOpening(false), 1000);
  };

  // Clean up audio completely
  const cleanupAudio = () => {
    if (audioElement) {
      // Remove event listeners to prevent them from firing
      audioElement.onplay = null;
      audioElement.onended = null;
      audioElement.onerror = null;
      
      // Stop and clean up audio
      audioElement.pause();
      audioElement.src = '';
    }
    
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    
    setIsSpeaking(false);
    setIsPaused(false);
    setCurrentUtterance(null);
    setAudioElement(null);
  };

  // TTS handler functions
  const handleSpeak = async (): Promise<void> => {
    if (!editorContent.trim()) {
      showAlert('No content to read!', 'error', undefined, isDarkMode);
      return;
    }

    if (isSpeaking && !isPaused) {
      // Currently speaking - pause it
      handlePause();
      return;
    }

    if (isPaused) {
      // Currently paused - resume
      handleResume();
      return;
    }

    // Start new speech
    try {
      setIsSaving(true); // Reuse loading state for "generating speech"
      
      // Clean up any existing audio first
      cleanupAudio();
      
      // Dynamic import with proper TypeScript handling
      const edgeTTSModule: any = await import('edge-tts-universal');
      
      // Find the right constructor (EdgeTTS works based on your logs)
      const TTSConstructor = edgeTTSModule.EdgeTTS;
      
      const tts = new TTSConstructor(
        editorContent, 
        'en-US-EmmaMultilingualNeural'
      );
      
      const result = await tts.synthesize();
      
      // Create audio element and play
      const audioBlob = new Blob([result.audio], { type: 'audio/mpeg' });
      const newAudioUrl = URL.createObjectURL(audioBlob);
      setAudioUrl(newAudioUrl);
      
      const audio = new Audio(newAudioUrl);
      
      audio.onplay = () => {
        setIsSpeaking(true);
        setIsPaused(false);
        setCurrentUtterance(audio);
        setAudioElement(audio);
      };
      
      audio.onended = () => {
        cleanupAudio();
      };
      
      audio.onerror = (event) => {
        console.error('Audio error:', event);
        // Only show error if we're still in a speaking state
        if (isSpeaking) {
          showAlert('Error playing audio', 'error', undefined, isDarkMode);
        }
        cleanupAudio();
      };
      
      await audio.play();
      setIsSaving(false);
      
    } catch (error: any) {
      setIsSaving(false);
      cleanupAudio();
      console.error('TTS Error details:', error);
      const message = error instanceof Error ? error.message : 'TTS synthesis failed';
      showAlert(`Speech error: ${message}`, 'error', undefined, isDarkMode);
    }
  };

  const handlePause = (): void => {
    if (audioElement && isSpeaking && !isPaused) {
      audioElement.pause();
      setIsPaused(true);
    }
  };

  const handleResume = (): void => {
    if (audioElement && isPaused) {
      audioElement.play();
      setIsPaused(false);
    }
  };

  const handleStop = (): void => {
    cleanupAudio();
  };

  // Cleanup audio when component unmounts
  React.useEffect(() => {
    return () => {
      cleanupAudio();
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        width: '95%',
        height: '95%',
        backgroundColor: theme.modalBg,
        borderRadius: '8px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
      }}>
        {/* Header */}
        <div style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${theme.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: theme.headerBg
        }}>
          <div style={{ 
            fontSize: '16px', 
            fontWeight: 'bold', 
            color: theme.text 
          }}>
            📝 Editor: {currentProject || 'New Project'} 
            {currentFileName && ` - ${currentFileName}`}
          </div>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleSave}
              disabled={isSaving || isOpening}
              style={{
                padding: '3px 8px',
                backgroundColor: (isSaving || isOpening) ? '#6c757d' : '#28a745',
                color: '#fff',
                border: 'none',
                borderRadius: '3px',
                fontSize: '11px',
                cursor: (isSaving || isOpening) ? 'not-allowed' : 'pointer'
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
              onClick={handleSpeak}
              disabled={isSaving || isOpening}
              title={isSpeaking ? (isPaused ? 'Resume' : 'Pause') : 'Speak'}
              style={{
                padding: '3px 8px',
                backgroundColor: isSpeaking 
                  ? (isPaused ? '#28a745' : '#ffc107') 
                  : '#17a2b8',
                color: isSpeaking && !isPaused ? '#000' : '#fff',
                border: 'none',
                borderRadius: '3px',
                fontSize: '11px',
                cursor: (isSaving || isOpening) ? 'not-allowed' : 'pointer',
                opacity: (isSaving || isOpening) ? 0.6 : 1
              }}
            >
              {isSaving && !isSpeaking ? 'Generating…' : 
               isSpeaking ? (isPaused ? '▶️ Resume' : '⏸️ Pause') : '🔊 Speak'}
            </button>

            <button
              onClick={handleStop}
              disabled={!isSpeaking || isSaving || isOpening}
              title="Stop"
              style={{
                padding: '3px 8px',
                backgroundColor: '#dc3545',
                color: '#fff',
                border: 'none',
                borderRadius: '3px',
                fontSize: '11px',
                cursor: (!isSpeaking || isSaving || isOpening) ? 'not-allowed' : 'pointer',
                opacity: (!isSpeaking || isSaving || isOpening) ? 0.6 : 1
              }}
            >
              ⏹️ Quiet
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
    </div>
  );
}