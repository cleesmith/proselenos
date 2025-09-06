// Editor modal component with simple, reliable sentence-by-sentence TTS

'use client';

import dynamic from 'next/dynamic';
import { useState, useRef, useEffect } from 'react';
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
  
  // TTS state variables - SIMPLIFIED
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [sentences, setSentences] = useState<string[]>([]);
  
  // Voice selection state
  const [availableVoices, setAvailableVoices] = useState<any[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('en-US-EmmaMultilingualNeural');
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [isClientHydrated, setIsClientHydrated] = useState(false);
  
  // Simple two-buffer system: current + next
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [nextAudio, setNextAudio] = useState<HTMLAudioElement | null>(null);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [nextAudioUrl, setNextAudioUrl] = useState<string | null>(null);
  
  const [isGeneratingInitial, setIsGeneratingInitial] = useState(false);
  const [isGeneratingNext, setIsGeneratingNext] = useState(false);

  // Single abort controller for background generation
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Use ref for immediate access to nextAudio (avoids React state timing issues)
  const nextAudioRef = useRef<{audio: HTMLAudioElement, url: string} | null>(null);

  // Client hydration effect
  useEffect(() => {
    setIsClientHydrated(true);
  }, []);

  // Load available voices on component mount (client-side only)
  useEffect(() => {
    if (!isClientHydrated || typeof window === 'undefined') return;
    
    const loadVoices = async () => {
      setIsLoadingVoices(true);
      try {
        const edgeTTSModule: any = await import('edge-tts-universal');
        const { VoicesManager } = edgeTTSModule;
        
        const voicesManager = await VoicesManager.create();
        
        // Get English voices
        const englishVoices = voicesManager.find({ Language: 'en' });
        console.log('English voices:', englishVoices);
        setAvailableVoices(englishVoices);
        
        // Load saved voice preference or use default
        const savedVoice = localStorage.getItem('proselenos-selected-voice');
        if (savedVoice && englishVoices.some((voice: any) => voice.ShortName === savedVoice)) {
          setSelectedVoice(savedVoice);
        }
      } catch (error) {
        console.error('Error loading voices:', error);
        // Keep default voice if loading fails
      } finally {
        setIsLoadingVoices(false);
      }
    };

    loadVoices();
  }, [isClientHydrated]);

  // Save voice preference when changed
  const handleVoiceChange = (voice: string) => {
    if (typeof window === 'undefined') return;
    setSelectedVoice(voice);
    localStorage.setItem('proselenos-selected-voice', voice);
  };

  // Simplified toolbar
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
  ];

  // Parse text into sentences
  const parseSentences = (text: string): string[] => {
    if (!text.trim()) return [];
    
    const sentences = text
      .replace(/\n\s*\n+/g, ' . ')  // Normalize multiple blank lines to single paragraph pause
      .replace(/([.!?])\s*\n+/g, '$1 ') 
      .replace(/\n+/g, ' ') 
      .split(/(?<=[.!?])\s+(?=[A-Z])/) 
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    return sentences;
  };

  const handleSave = async () => {
    if (!editorContent.trim()) {
      showAlert('Cannot save empty content!', 'error', undefined, isDarkMode);
      return;
    }

    if (currentFileName && currentFileName.match(/proselenos.*\.json$/i)) {
      showAlert('Cannot edit configuration files!', 'error', undefined, isDarkMode);
      return;
    }

    setIsSaving(true);
    
    try {
      if (editorMode === 'existing' && currentFileId) {
        await onSaveFile(editorContent);
        showAlert('✅ File updated successfully!', 'success', undefined, isDarkMode);
      } else {
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
        if (!fileName) return;
        
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

  // IMMEDIATE cleanup
  const cleanupAudio = () => {
    // Cancel background generation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Clear ref-stored audio
    if (nextAudioRef.current) {
      if (nextAudioRef.current.audio) {
        nextAudioRef.current.audio.pause();
        nextAudioRef.current.audio.src = '';
      }
      if (nextAudioRef.current.url) {
        URL.revokeObjectURL(nextAudioRef.current.url);
      }
      nextAudioRef.current = null;
    }

    // Cleanup current audio
    if (currentAudio) {
      currentAudio.onplay = null;
      currentAudio.onended = null;
      currentAudio.onerror = null;
      currentAudio.pause();
      currentAudio.src = '';
    }
    if (currentAudioUrl) {
      URL.revokeObjectURL(currentAudioUrl);
    }
    
    // Cleanup next audio
    if (nextAudio) {
      nextAudio.onplay = null;
      nextAudio.onended = null;
      nextAudio.onerror = null;
      nextAudio.pause();
      nextAudio.src = '';
    }
    if (nextAudioUrl) {
      URL.revokeObjectURL(nextAudioUrl);
    }
    
    // Reset all state
    setIsSpeaking(false);
    setIsPaused(false);
    setCurrentSentenceIndex(0);
    setSentences([]);
    setCurrentAudio(null);
    setNextAudio(null);
    setCurrentAudioUrl(null);
    setNextAudioUrl(null);
    setIsGeneratingInitial(false);
    setIsGeneratingNext(false);
  };

  // Generate single sentence audio with cancellation support
  const generateSentenceAudio = async (sentence: string): Promise<{audio: HTMLAudioElement, url: string} | null> => {
    if (!sentence.trim() || typeof window === 'undefined') return null;
    
    try {
      const edgeTTSModule: any = await import('edge-tts-universal');
      const TTSConstructor = edgeTTSModule.EdgeTTS;
      
      const tts = new TTSConstructor(sentence, selectedVoice);
      const result = await tts.synthesize();
      
      const audioBlob = new Blob([result.audio], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.preload = 'auto';
      
      return { audio, url: audioUrl };
    } catch (error) {
      console.error('Error generating sentence audio:', error);
      return null;
    }
  };

  // Generate next sentence in background (with state tracking)
  const generateNextSentence = async (nextIndex: number, sentenceArray: string[]) => {
    if (nextIndex >= sentenceArray.length) return;
    if (isGeneratingNext) return; // Already generating
    
    const sentence = sentenceArray[nextIndex];
    if (!sentence.trim()) return;

    console.log(`🔄 Starting background generation for sentence ${nextIndex}: "${sentence.substring(0, 50)}..."`);
    
    // Cancel any previous generation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const newAbortController = new AbortController();
    abortControllerRef.current = newAbortController;
    setIsGeneratingNext(true);
    
    try {
      const result = await generateSentenceAudio(sentence);
      
      // Check if cancelled
      if (newAbortController.signal.aborted) {
        console.log(`❌ Generation cancelled for sentence ${nextIndex}`);
        return;
      }
      
      if (result) {
        console.log(`✅ Generated sentence ${nextIndex}, storing as nextAudio`);
        // Store in ref for immediate access (fixes race condition)
        nextAudioRef.current = result;
        // Also update state for UI
        setNextAudio(result.audio);
        setNextAudioUrl(result.url);
      } else {
        console.log(`❌ Failed to generate sentence ${nextIndex}`);
        nextAudioRef.current = null;
      }
    } catch (error) {
      if (!newAbortController.signal.aborted) {
        console.error(`Error generating sentence ${nextIndex}:`, error);
      }
    } finally {
      setIsGeneratingNext(false);
    }
  };

  /*
  SIMPLE RELIABLE ALGORITHM:
  
  1. Always maintain exactly 2 audio buffers: current + next
  2. When current ends, immediately move next → current
  3. Start generating new next while current plays
  4. No complex indexing, no race conditions
  5. Linear and predictable
  */

  // Handle sentence completion and advance
  const advanceToNextSentence = async (finishedIndex: number, sentenceArray: string[]) => {
    const nextIndex = finishedIndex + 1;
    
    console.log(`🎯 Sentence ${finishedIndex} finished, advancing to ${nextIndex}`);
    
    if (nextIndex >= sentenceArray.length) {
      console.log('🏁 All sentences completed!');
      cleanupAudio();
      // showAlert('✅ Finished reading!', 'success', undefined, isDarkMode);
      return;
    }

    // Cleanup finished audio
    if (currentAudioUrl) {
      URL.revokeObjectURL(currentAudioUrl);
    }

    // Check if nextAudio is ready (use ref for immediate access)
    const nextAudioData = nextAudioRef.current;
    if (!nextAudioData) {
      console.log(`❌ nextAudio not ready for sentence ${nextIndex}! Generating now...`);
      
      // Emergency: generate next sentence synchronously
      const sentence = sentenceArray[nextIndex];
      if (sentence.trim()) {
        setIsGeneratingNext(true);
        const result = await generateSentenceAudio(sentence);
        setIsGeneratingNext(false);
        
        if (result) {
          setCurrentAudio(result.audio);
          setCurrentAudioUrl(result.url);
          setNextAudio(null);
          setNextAudioUrl(null);
          setCurrentSentenceIndex(nextIndex);

          // Start playing
          result.audio.onended = () => advanceToNextSentence(nextIndex, sentenceArray);
          result.audio.onerror = () => {
            showAlert('Audio playback error', 'error', undefined, isDarkMode);
            cleanupAudio();
          };
          
          await result.audio.play();
          
          // Start generating the sentence after this one
          generateNextSentence(nextIndex + 1, sentenceArray);
        } else {
          showAlert('Failed to generate next sentence', 'error', undefined, isDarkMode);
          cleanupAudio();
        }
      }
      return;
    }

    // Normal path: nextAudio is ready
    console.log(`✅ nextAudio ready, moving to currentAudio for sentence ${nextIndex}`);
    
    // Move nextAudio to currentAudio using ref data
    setCurrentAudio(nextAudioData.audio);
    setCurrentAudioUrl(nextAudioData.url);
    // Clear the ref and state
    nextAudioRef.current = null;
    setNextAudio(null);
    setNextAudioUrl(null);
    setCurrentSentenceIndex(nextIndex);

    // Start playing immediately
    nextAudioData.audio.onended = () => advanceToNextSentence(nextIndex, sentenceArray);
    nextAudioData.audio.onerror = () => {
      showAlert('Audio playback error', 'error', undefined, isDarkMode);
      cleanupAudio();
    };
    
    await nextAudioData.audio.play();

    // Start generating the next sentence in background
    generateNextSentence(nextIndex + 1, sentenceArray);
  };

  // Main TTS handler
  const handleSpeak = async (): Promise<void> => {
    if (!isClientHydrated || typeof window === 'undefined') {
      showAlert('TTS not available during page load', 'error', undefined, isDarkMode);
      return;
    }
    
    if (!editorContent.trim()) {
      showAlert('No content to read!', 'error', undefined, isDarkMode);
      return;
    }

    if (isSpeaking && !isPaused) {
      handlePause();
      return;
    }

    if (isPaused) {
      handleResume();
      return;
    }

    console.log('🚀 Starting TTS...');

    const parsedSentences = parseSentences(editorContent);
    if (parsedSentences.length === 0) {
      showAlert('No sentences found!', 'error', undefined, isDarkMode);
      return;
    }

    console.log(`📝 Parsed ${parsedSentences.length} sentences`);
    setSentences(parsedSentences);
    setCurrentSentenceIndex(0);

    // Initial generation (user expects this wait)
    setIsGeneratingInitial(true);
    console.log('🔄 Generating first sentence...');
    
    const result0 = await generateSentenceAudio(parsedSentences[0]);
    
    setIsGeneratingInitial(false);

    if (!result0) {
      showAlert('Failed to generate speech', 'error', undefined, isDarkMode);
      return;
    }

    console.log('✅ First sentence generated, starting playback');

    // Set up first sentence
    setCurrentAudio(result0.audio);
    setCurrentAudioUrl(result0.url);

    // Start playing sentence 0
    result0.audio.onplay = () => {
      setIsSpeaking(true);
      setIsPaused(false);
      console.log('▶️ Started playing sentence 0');
    };

    result0.audio.onended = () => advanceToNextSentence(0, parsedSentences);

    result0.audio.onerror = () => {
      showAlert('Audio playback error', 'error', undefined, isDarkMode);
      cleanupAudio();
    };

    await result0.audio.play();

    // Start generating sentence 1 while sentence 0 plays
    if (parsedSentences.length > 1) {
      console.log('🔄 Starting background generation for sentence 1');
      generateNextSentence(1, parsedSentences);
    }
  };

  const handlePause = (): void => {
    if (currentAudio && isSpeaking && !isPaused) {
      currentAudio.pause();
      setIsPaused(true);
      console.log('⏸️ Paused');
    }
  };

  const handleResume = (): void => {
    if (currentAudio && isPaused) {
      currentAudio.play();
      setIsPaused(false);
      console.log('▶️ Resumed');
    }
  };

  const handleStop = (): void => {
    console.log('⏹️ Stopping all TTS processes...');
    
    // Force stop any currently playing audio immediately
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }
    
    // Force stop any buffered audio
    if (nextAudio) {
      nextAudio.pause(); 
      nextAudio.currentTime = 0;
    }
    
    // Force stop ref-stored audio
    if (nextAudioRef.current?.audio) {
      nextAudioRef.current.audio.pause();
      nextAudioRef.current.audio.currentTime = 0;
    }
    
    // Now do complete cleanup
    cleanupAudio();
    console.log('⏹️ All TTS processes stopped');
  };

  React.useEffect(() => {
    return () => {
      // Cleanup all audio resources and URLs when component unmounts
      if (typeof window !== 'undefined') {
        cleanupAudio();
      }
    };
  }, []);

  // Cleanup when modal closes
  React.useEffect(() => {
    if (!isOpen && typeof window !== 'undefined') {
      cleanupAudio();
    }
  }, [isOpen]);

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
                {isGeneratingNext && ' • Generating...'}
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

            <select
              value={selectedVoice}
              onChange={(e) => handleVoiceChange(e.target.value)}
              disabled={!isClientHydrated || isSpeaking || isLoadingVoices}
              title="Select voice for text-to-speech"
              style={{
                padding: '3px 6px',
                backgroundColor: (!isClientHydrated || isSpeaking || isLoadingVoices) ? '#6c757d' : theme.modalBg,
                color: theme.text,
                border: `1px solid ${theme.border}`,
                borderRadius: '3px',
                fontSize: '11px',
                cursor: (!isClientHydrated || isSpeaking || isLoadingVoices) ? 'not-allowed' : 'pointer',
                maxWidth: '120px'
              }}
            >
              {!isClientHydrated ? (
                <option>Initializing...</option>
              ) : isLoadingVoices ? (
                <option>Loading voices...</option>
              ) : (
                availableVoices.map((voice) => {
                  const displayName = voice.ShortName
                    .replace(/^[a-z]{2}-[A-Z]{2}-/, '') // Remove locale prefix
                    .replace(/Neural$|Multilingual$|MultilingualNeural$/, '') // Remove suffixes
                    .replace(/([A-Z])/g, ' $1') // Add spaces before caps
                    .trim();
                  const locale = voice.Locale?.replace('en-', '') || '';
                  const gender = voice.Gender || '';
                  
                  return (
                    <option key={voice.ShortName} value={voice.ShortName}>
                      {displayName} ({locale} {gender})
                    </option>
                  );
                })
              )}
            </select>

            <button
              onClick={handleSpeak}
              disabled={!isClientHydrated || isSaving || isOpening || isGeneratingInitial || isLoadingVoices}
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
                cursor: (!isClientHydrated || isSaving || isOpening || isGeneratingInitial || isLoadingVoices) ? 'not-allowed' : 'pointer',
                opacity: (!isClientHydrated || isSaving || isOpening || isGeneratingInitial || isLoadingVoices) ? 0.6 : 1
              }}
            >
              {!isClientHydrated ? 'Loading…' :
               isLoadingVoices ? 'Loading…' : 
               isGeneratingInitial ? 'Generating…' : 
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
