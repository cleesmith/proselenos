// Editor modal component with simplified toolbar and sentence-by-sentence TTS

'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import React from 'react';
import { ThemeConfig } from '../shared/theme';
import { showAlert, showInputAlert } from '../shared/alerts';
import { commands } from '@uiw/react-md-editor';
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
  
  // TTS state variables for sentence-by-sentence reading
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [sentences, setSentences] = useState<string[]>([]);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isGeneratingSpeech, setIsGeneratingSpeech] = useState(false);

  // Simplified toolbar - removing commands writers rarely use
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

  // Parse text into sentences
  const parseSentences = (text: string): string[] => {
    if (!text.trim()) return [];
    
    // Enhanced sentence splitting that handles abbreviations better
    const sentences = text
      .replace(/([.!?])\s*\n+/g, '$1 ') // Handle newlines after sentence endings
      .replace(/\n+/g, ' ') // Replace other newlines with spaces
      .split(/(?<=[.!?])\s+(?=[A-Z])/) // Split on sentence boundaries
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    return sentences;
  };

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
    setCurrentSentenceIndex(0);
    setSentences([]);
    setAudioElement(null);
    setIsGeneratingSpeech(false);
  };

  // Generate and play a specific sentence
  const speakSentence = async (sentenceIndex: number, sentenceArray: string[]): Promise<void> => {
    if (sentenceIndex >= sentenceArray.length) {
      // Reached end of sentences
      cleanupAudio();
      showAlert('✅ Finished reading all sentences!', 'success', undefined, isDarkMode);
      return;
    }

    const sentence = sentenceArray[sentenceIndex];
    if (!sentence.trim()) {
      // Skip empty sentences and move to next
      setCurrentSentenceIndex(sentenceIndex + 1);
      speakSentence(sentenceIndex + 1, sentenceArray);
      return;
    }

    try {
      setIsGeneratingSpeech(true);
      
      // Clean up any existing audio first
      if (audioElement) {
        audioElement.onplay = null;
        audioElement.onended = null;
        audioElement.onerror = null;
        audioElement.pause();
      }
      
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      
      // Dynamic import with proper TypeScript handling
      const edgeTTSModule: any = await import('edge-tts-universal');
      const TTSConstructor = edgeTTSModule.EdgeTTS;
      
      const tts = new TTSConstructor(
        sentence, 
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
        setAudioElement(audio);
        setIsGeneratingSpeech(false);
      };
      
      audio.onended = () => {
        // Automatically move to next sentence
        const nextIndex = sentenceIndex + 1;
        setCurrentSentenceIndex(nextIndex);
        
        // Clean up current audio
        if (audioUrl) {
          URL.revokeObjectURL(audioUrl);
          setAudioUrl(null);
        }
        setAudioElement(null);
        
        // Continue with next sentence
        setTimeout(() => speakSentence(nextIndex, sentenceArray), 500);
      };
      
      audio.onerror = (event) => {
        console.error('Audio error:', event);
        setIsGeneratingSpeech(false);
        if (isSpeaking) {
          showAlert('Error playing audio', 'error', undefined, isDarkMode);
        }
        cleanupAudio();
      };
      
      await audio.play();
      
    } catch (error: any) {
      setIsGeneratingSpeech(false);
      cleanupAudio();
      console.error('TTS Error details:', error);
      const message = error instanceof Error ? error.message : 'TTS synthesis failed';
      showAlert(`Speech error: ${message}`, 'error', undefined, isDarkMode);
    }
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

    // Start new speech - parse sentences and begin
    const parsedSentences = parseSentences(editorContent);
    if (parsedSentences.length === 0) {
      showAlert('No sentences found to read!', 'error', undefined, isDarkMode);
      return;
    }

    setSentences(parsedSentences);
    setCurrentSentenceIndex(0);
    
    // Start speaking from the first sentence
    await speakSentence(0, parsedSentences);
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

  const handleSkipSentence = (): void => {
    if (isSpeaking && sentences.length > 0) {
      // Stop current sentence and move to next
      if (audioElement) {
        audioElement.onended = null; // Prevent automatic progression
        audioElement.pause();
      }
      
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }
      
      const nextIndex = currentSentenceIndex + 1;
      setCurrentSentenceIndex(nextIndex);
      
      // Continue with next sentence
      setTimeout(() => speakSentence(nextIndex, sentences), 100);
    }
  };

  const handlePreviousSentence = (): void => {
    if (isSpeaking && sentences.length > 0 && currentSentenceIndex > 0) {
      // Stop current sentence and go to previous
      if (audioElement) {
        audioElement.onended = null; // Prevent automatic progression
        audioElement.pause();
      }
      
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }
      
      const prevIndex = currentSentenceIndex - 1;
      setCurrentSentenceIndex(prevIndex);
      
      // Continue with previous sentence
      setTimeout(() => speakSentence(prevIndex, sentences), 100);
    }
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
        width: '100%',
        height: '100%',
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
            {isSpeaking && sentences.length > 0 && (
              <span style={{ fontSize: '12px', color: theme.text, opacity: 0.7, marginLeft: '10px' }}>
                (Sentence {currentSentenceIndex + 1} of {sentences.length})
              </span>
            )}
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

            {/* Previous sentence button */}
            <button
              onClick={handlePreviousSentence}
              disabled={!isSpeaking || currentSentenceIndex <= 0 || isGeneratingSpeech}
              title="Previous Sentence"
              style={{
                padding: '3px 8px',
                backgroundColor: '#fd7e14',
                color: '#fff',
                border: 'none',
                borderRadius: '3px',
                fontSize: '11px',
                cursor: (!isSpeaking || currentSentenceIndex <= 0 || isGeneratingSpeech) ? 'not-allowed' : 'pointer',
                opacity: (!isSpeaking || currentSentenceIndex <= 0 || isGeneratingSpeech) ? 0.6 : 1
              }}
            >
              ⏮️ Prev
            </button>

            <button
              onClick={handleSpeak}
              disabled={isSaving || isOpening || isGeneratingSpeech}
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
                cursor: (isSaving || isOpening || isGeneratingSpeech) ? 'not-allowed' : 'pointer',
                opacity: (isSaving || isOpening || isGeneratingSpeech) ? 0.6 : 1
              }}
            >
              {isGeneratingSpeech ? 'Generating…' : 
               isSpeaking ? (isPaused ? '▶️ Resume' : '⏸️ Pause') : '🔊 Speak'}
            </button>

            {/* Skip sentence button */}
            <button
              onClick={handleSkipSentence}
              disabled={!isSpeaking || currentSentenceIndex >= sentences.length - 1 || isGeneratingSpeech}
              title="Next Sentence"
              style={{
                padding: '3px 8px',
                backgroundColor: '#fd7e14',
                color: '#fff',
                border: 'none',
                borderRadius: '3px',
                fontSize: '11px',
                cursor: (!isSpeaking || currentSentenceIndex >= sentences.length - 1 || isGeneratingSpeech) ? 'not-allowed' : 'pointer',
                opacity: (!isSpeaking || currentSentenceIndex >= sentences.length - 1 || isGeneratingSpeech) ? 0.6 : 1
              }}
            >
              ⏭️ Next
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
              onClick={() => {
                cleanupAudio();
                onClose();
              }}
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
            commands={filteredCommands}
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
