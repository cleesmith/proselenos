// app/proselenos/EditorModal.tsx

// issues:
//  1. Speak-ing text without "proper" punctuation, for example:
//     an AI-based report, like Drunken, the Edge TTS has trouble 
//     generating, and gets hung = can't Quiet or Close to stop reading

// Editor modal component with simple, reliable sentence‑by‑sentence TTS 
// and sentence highlighting

/*
 * This component is a rewrite of the original EditorModal for Proselenos.
 * It retains the sentence‑by‑sentence text‑to‑speech (TTS) playback
 * but adds the ability to highlight the current sentence as it is being
 * spoken.  Highlighting is achieved without modifying the underlying
 * markdown editor (MDEditor) by rendering a separate preview panel
 * that mirrors the content and wraps the currently spoken sentence in
 * a span with a yellow-ish background.  Duplicate sentences are handled
 * by computing character ranges sequentially, so the second occurrence
 * of an identical sentence will be highlighted when appropriate.
 */

'use client';

import dynamic from 'next/dynamic';
import { useState, useRef, useEffect } from 'react';
import React from 'react';
import { ThemeConfig } from '../shared/theme';
import { showAlert, showInputAlert } from '../shared/alerts';
import { commands } from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';

// Dynamically import the markdown editor on the client
const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false });

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
  onSaveFile: (content: string, filename?: string) => Promise<string | void>;
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
  onBrowseFiles,
}: EditorModalProps) {
  // State for file saving and opening
  const [isSaving, setIsSaving] = useState(false);
  const [isOpening, setIsOpening] = useState(false);

  // TTS state variables – simplified
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [sentences, setSentences] = useState<string[]>([]);

  // Voice selection state
  const [availableVoices, setAvailableVoices] = useState<any[]>([]);
  const [selectedVoice, setSelectedVoice] = useState('en-US-EmmaMultilingualNeural');
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [isClientHydrated, setIsClientHydrated] = useState(false);

  // Two-buffer system: current + next audio
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [nextAudio, setNextAudio] = useState<HTMLAudioElement | null>(null);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [nextAudioUrl, setNextAudioUrl] = useState<string | null>(null);

  const [isGeneratingInitial, setIsGeneratingInitial] = useState(false);
  const [isGeneratingNext, setIsGeneratingNext] = useState(false);

  const [startSentenceIndex, setStartSentenceIndex] = useState<number | null>(null);

  // Single abort controller for background generation
  const abortControllerRef = useRef<AbortController | null>(null);

  // Ref for immediate access to nextAudio (avoids React state timing issues)
  const nextAudioRef = useRef<{ audio: HTMLAudioElement; url: string } | null>(null);
  // Ref for the overlay container so we can scroll it
  const overlayRef = useRef<HTMLDivElement | null>(null);

  // Hydrate client on mount
  useEffect(() => {
    setIsClientHydrated(true);
  }, []);

  // Load available voices when client is ready
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
        setAvailableVoices(englishVoices);
        // Load saved voice preference or use default
        const savedVoice = localStorage.getItem('proselenos-selected-voice');
        if (
          savedVoice &&
          englishVoices.some((voice: any) => voice.ShortName === savedVoice)
        ) {
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

  // Persist voice selection
  const handleVoiceChange = (voice: string) => {
    if (typeof window === 'undefined') return;
    setSelectedVoice(voice);
    localStorage.setItem('proselenos-selected-voice', voice);
  };

  // Simplified toolbar commands
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

  // Utility to parse text into sentences
  const parseSentences = (text: string): string[] => {
    if (!text.trim()) return [];
    const result = text
      .replace(/\n\s*\n+/g, ' . ') // Normalize multiple blank lines
      .replace(/([.!?])\s*\n+/g, '$1 ') // Remove newline after punctuation
      .replace(/\n+/g, ' ') // Replace newlines with space
      .split(/(?<=[.!?])\s+(?=[A-Z])/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    return result;
  };

  // Count words in the editor
  const countWords = (text: string) => {
    return text
      .replace(/(\r\n|\r|\n)/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 0)
      .length;
  };

  // Compute the current word count for display
  const wordCount = countWords(editorContent);

  // Save file handler
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
        const defaultName = `manuscript_${new Date().toISOString().slice(0, 10)}`;
        const fileName = await showInputAlert(
          'Enter filename (without .txt extension):',
          defaultName,
          'Enter filename...',
          isDarkMode
        );
        if (!fileName) {
          setIsSaving(false);
          return;
        }
        const baseName = fileName.trim();
        const finalName = /\.txt$/i.test(baseName) ? baseName : `${baseName}.txt`;
        await onSaveFile(editorContent, finalName);
        showAlert('✅ File saved successfully!', 'success', undefined, isDarkMode);
      }
    } catch (error) {
      showAlert('❌ Error saving file!', 'error', undefined, isDarkMode);
    } finally {
      setIsSaving(false);
    }
  };

  // Open file handler
  const handleOpen = async () => {
    setIsOpening(true);
    try {
      onBrowseFiles();
    } finally {
      setIsOpening(false);
    }
  };

  // Generate single sentence audio with cancellation support
  const generateSentenceAudio = async (
    sentence: string
  ): Promise<{ audio: HTMLAudioElement; url: string } | null> => {
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
    if (isGeneratingNext) return;
    const sentence = sentenceArray[nextIndex];
    if (!sentence.trim()) return;
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
        return;
      }
      if (result) {
        // Store in ref for immediate access (fixes race condition)
        nextAudioRef.current = result;
        // Also update state for UI
        setNextAudio(result.audio);
        setNextAudioUrl(result.url);
      } else {
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

  // Handle sentence completion and advance
  const advanceToNextSentence = async (
    finishedIndex: number,
    sentenceArray: string[]
  ) => {
    const nextIndex = finishedIndex + 1;
    if (nextIndex >= sentenceArray.length) {
      // Completed all sentences
      cleanupAudio();
      return;
    }
    // Cleanup finished audio
    if (currentAudioUrl) {
      URL.revokeObjectURL(currentAudioUrl);
    }
    // Check if nextAudio is ready (use ref for immediate access)
    const nextAudioData = nextAudioRef.current;
    if (!nextAudioData) {
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
          // Mark speaking before playback
          setIsSpeaking(true);
          setIsPaused(false);
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
    setCurrentAudio(nextAudioData.audio);
    setCurrentAudioUrl(nextAudioData.url);
    nextAudioRef.current = null;
    setNextAudio(null);
    setNextAudioUrl(null);
    setCurrentSentenceIndex(nextIndex);
    // Mark speaking before playback
    setIsSpeaking(true);
    setIsPaused(false);
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

  // Main TTS handler (Speak/Pause/Resume)
  const handleSpeak = async (): Promise<void> => {
    // Prevent TTS during hydration or on the server
    if (!isClientHydrated || typeof window === 'undefined') {
      showAlert('TTS not available during page load', 'error', undefined, isDarkMode);
      return;
    }

    // Do nothing if the content is empty
    if (!editorContent.trim()) {
      showAlert('No content to read!', 'error', undefined, isDarkMode);
      return;
    }

    // If already speaking, toggle pause/resume
    if (isSpeaking && !isPaused) {
      handlePause();
      return;
    }
    if (isPaused) {
      handleResume();
      return;
    }

    // Split the document into sentences using exact ranges
    const ranges = getSentenceRangesFromOriginal(editorContent);
    const parsedSentences = ranges.map((r) => editorContent.slice(r.start, r.end));
    if (parsedSentences.length === 0) {
      showAlert('No sentences found!', 'error', undefined, isDarkMode);
      return;
    }

    // Save the sentences and decide where to start
    setSentences(parsedSentences);
    const startIndex = startSentenceIndex ?? 0;
    setCurrentSentenceIndex(startIndex);

    // Generate and play the first sentence’s audio
    setIsGeneratingInitial(true);
    const result0 = await generateSentenceAudio(parsedSentences[startIndex]);
    setIsGeneratingInitial(false);
    if (!result0) {
      showAlert('Failed to generate speech', 'error', undefined, isDarkMode);
      return;
    }
    setCurrentAudio(result0.audio);
    setCurrentAudioUrl(result0.url);

    /*
     * Mark as speaking before playback to ensure the highlight preview
     * appears immediately.  Without setting isSpeaking here, the
     * highlight may never render if we rely solely on the onplay event.
     */
    setIsSpeaking(true);
    setIsPaused(false);

    // When this sentence finishes, move on to the next
    result0.audio.onended = () => advanceToNextSentence(startIndex, parsedSentences);
    result0.audio.onerror = () => {
      showAlert('Audio playback error', 'error', undefined, isDarkMode);
      cleanupAudio();
    };

    await result0.audio.play();

    // If there’s another sentence after the current one, pre‑generate it
    if (parsedSentences.length > startIndex + 1) {
      generateNextSentence(startIndex + 1, parsedSentences);
    }
  };

  // Pause/resume/stop handlers
  const handlePause = (): void => {
    if (currentAudio && isSpeaking && !isPaused) {
      currentAudio.pause();
      setIsPaused(true);
    }
  };
  const handleResume = (): void => {
    if (currentAudio && isPaused) {
      currentAudio.play();
      setIsPaused(false);
    }
  };
  const handleStop = (): void => {
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
    // Force stop ref‑stored audio
    if (nextAudioRef.current?.audio) {
      nextAudioRef.current.audio.pause();
      nextAudioRef.current.audio.currentTime = 0;
    }
    cleanupAudio();
  };

  // Cleanup function for audio and TTS state
  const cleanupAudio = () => {
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
    setStartSentenceIndex(null);
  };

  // Cleanup when component unmounts
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined') {
        cleanupAudio();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stop the audio and clean up
  const handleStopAndScroll = () => {
    handleStop(); // existing stop logic
    // After stopping, scroll the editor container to the top
    const editorElement = document.querySelector(
      '.w-md-editor'
    ) as HTMLElement | null;
    if (editorElement) {
      editorElement.scrollTop = 0;
      editorElement.scrollLeft = 0; // optional, in case horizontal scroll changed
    }
  };

  // Cleanup when modal closes
  useEffect(() => {
    if (!isOpen && typeof window !== 'undefined') {
      cleanupAudio();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  /*
   * Build a highlighted HTML string.  Instead of re‑splitting the
   * editor content (which can lead to off‑by‑one errors between the
   * audio sentences and the preview), we rely directly on the
   * `sentences` array that drives the TTS.  This guarantees that
   * the highlighted sentence always corresponds to the sentence
   * currently being spoken. We preserve original spacing and
   * blank lines by slicing exact ranges from the original content.
   */
  // const getHighlightedHtml = () => {
  //   /*
  //    * Use the original editorContent and the same sentence splitting regex
  //    * to compute character ranges for each sentence.  This preserves
  //    * whitespace and ensures that highlighting stays in sync with the
  //    * currentSentenceIndex.  We wrap the current sentence range in a
  //    * span; all other ranges are returned as‑is.  Note that when
  //    * `sentences.length` is zero (i.e. no sentences have been parsed),
  //    * this returns an empty string.
  //    */
  //   if (sentences.length === 0) return '';
  //   const ranges: { start: number; end: number }[] = getSentenceRangesFromOriginal(editorContent);
  //   return ranges
  //     .map((r, idx) => {
  //       const textSlice = editorContent.slice(r.start, r.end);
  //       if (idx === currentSentenceIndex && isSpeaking) {
  //         const bg = isDarkMode ? 'rgba(255, 255, 140, 0.28)' : 'rgba(255, 230, 0, 0.25)';
  //         return `<span style="background-color: ${bg}; border-radius: 3px;">${textSlice}</span>`;
  //       }
  //       return textSlice;
  //     })
  //     .join('');
  // };
  const getHighlightedHtml = () => {
    if (sentences.length === 0) return '';
    const ranges = getSentenceRangesFromOriginal(editorContent);
    const startIdx = startSentenceIndex ?? 0;

    // Only render sentences from startIdx onward
    return ranges.slice(startIdx).map((r, localIdx) => {
      const absoluteIdx = startIdx + localIdx; // index within all sentences
      const textSlice = editorContent.slice(r.start, r.end);

      // Highlight the one currently being spoken
      if (absoluteIdx === currentSentenceIndex && isSpeaking) {
        const bg = isDarkMode ? 'rgba(255, 255, 140, 0.28)' : 'rgba(255, 230, 0, 0.25)';
        return `<span data-current="true" style="background:${bg};">${textSlice}</span>`;
      }

      return textSlice;
    }).join('');
  };

  // Auto-scroll the overlay to keep the current sentence in view
  useEffect(() => {
    if (!isSpeaking) return;
    const overlay = overlayRef.current;
    if (!overlay) return;
    const currentEl = overlay.querySelector('[data-current="true"]') as HTMLElement | null;
    if (currentEl) {
      currentEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentSentenceIndex, isSpeaking]);


  /*
   * Compute exact character ranges of sentences in the original editorContent
   * using the same regex used for splitting into sentences.  This avoids
   * mismatches caused by whitespace normalization.
   */
  interface SentenceRange { start: number; end: number; }
  const getSentenceRangesFromOriginal = (text: string): SentenceRange[] => {
    const ranges: SentenceRange[] = [];
    const regex = /(?<=[.!?])\s+(?=[A-Z])/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      // Include the matched inter-sentence whitespace with the preceding sentence
      const end = match.index + match[0].length;
      ranges.push({ start: lastIndex, end });
      lastIndex = end;
    }
    ranges.push({ start: lastIndex, end: text.length });
    // Filter out empty or whitespace‑only ranges (whitespace stays attached to previous sentence)
    return ranges.filter((r) => text.slice(r.start, r.end).trim().length > 0);
  };

  // Effect: highlight the current sentence inside the editor by selecting it
  useEffect(() => {
    if (!isSpeaking) return;
    if (typeof window === 'undefined') return;
    // Compute ranges in original content
    const ranges = getSentenceRangesFromOriginal(editorContent);
    const range = ranges[currentSentenceIndex];
    const textarea = document.querySelector('.w-md-editor-text-input') as HTMLTextAreaElement | null;
    // this caused the MDEditor textarea to scroll to the bottom:
    // if (textarea && range) {
    //   // Focus the textarea and select the current sentence
    //   textarea.focus();
    //   try {
    //     textarea.setSelectionRange(range.start, range.end);
    //   } catch {
    //     /* ignore errors in selection */
    //   }
    // }
  }, [isSpeaking, currentSentenceIndex, editorContent]);

  // Effect: detect clicks inside the editor and remember the sentence index
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const textarea = document.querySelector('.w-md-editor-text-input') as HTMLTextAreaElement | null;
    if (!textarea) return;

    const clickHandler = () => {
      const pos = textarea.selectionStart;
      const ranges = getSentenceRangesFromOriginal(editorContent);
      let idx = 0;
      for (let i = 0; i < ranges.length; i++) {
        const { start, end } = ranges[i];
        if (pos >= start && pos <= end) {
          idx = i;
          break;
        }
      }
      setStartSentenceIndex(idx);
      setCurrentSentenceIndex(idx); // highlight this sentence in the overlay, if desired
    };

    textarea.addEventListener('click', clickHandler);
    return () => {
      textarea.removeEventListener('click', clickHandler);
    };
  }, [editorContent]);


  // Do not render anything if modal is closed
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        zIndex: 1000,
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        overflow: 'auto',
        backgroundColor: theme.modalBg,
        color: theme.text,
        padding: '0.5rem',
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.5rem',
          borderBottom: `1px solid ${theme.border}`,
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        {/* Left group: title, word count, and sentence progress */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <span>
            <span role="img" aria-label="note">
              📝
            </span>{' '}
            Editor: {currentProject || 'New Project'}
            {currentFileName && ` - ${currentFileName}`}
          </span>
          <span>{wordCount.toLocaleString()} words</span>
          {isSpeaking && sentences.length > 0 && (
            <span>
              (Sentence {currentSentenceIndex + 1} of {sentences.length})
              {isGeneratingNext && ' • Generating...'}
            </span>
          )}
        </div>
        {/* Right group: action buttons and voice selection */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={handleSave}
            disabled={isSaving}
            title={editorMode === 'existing' ? 'Update file' : 'Save as .txt'}
            style={{
              padding: '3px 8px',
              backgroundColor: theme.modalBg,
              color: theme.text,
              border: `1px solid ${theme.border}`,
              borderRadius: '3px',
              fontSize: '11px',
              cursor: isSaving ? 'not-allowed' : 'pointer',
            }}
          >
            {isSaving ? 'Saving…' : editorMode === 'existing' ? 'Update' : 'Save as .txt'}
          </button>
          <button
            onClick={handleOpen}
            disabled={isOpening}
            title="Open file"
            style={{
              padding: '3px 8px',
              backgroundColor: theme.modalBg,
              color: theme.text,
              border: `1px solid ${theme.border}`,
              borderRadius: '3px',
              fontSize: '11px',
              cursor: isOpening ? 'not-allowed' : 'pointer',
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
              backgroundColor:
                !isClientHydrated || isSpeaking || isLoadingVoices ? '#6c757d' : theme.modalBg,
              color: theme.text,
              border: `1px solid ${theme.border}`,
              borderRadius: '3px',
              fontSize: '11px',
              cursor:
                !isClientHydrated || isSpeaking || isLoadingVoices ? 'not-allowed' : 'pointer',
              maxWidth: '140px',
            }}
          >
            {!isClientHydrated ? (
              <option>Initializing...</option>
            ) : isLoadingVoices ? (
              <option>Loading voices...</option>
            ) : (
              availableVoices.map((voice: any) => {
                const displayName = voice.ShortName
                  .replace(/^[a-z]{2}-[A-Z]{2}-/, '')
                  .replace(/Neural$|Multilingual$|MultilingualNeural$/, '')
                  .replace(/([A-Z])/g, ' $1')
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
            disabled={!isClientHydrated || isLoadingVoices || isGeneratingInitial}
            title="Speak / Pause / Resume"
            style={{
              padding: '3px 8px',
              backgroundColor: theme.modalBg,
              color: theme.text,
              border: `1px solid ${theme.border}`,
              borderRadius: '3px',
              fontSize: '11px',
              cursor:
                !isClientHydrated || isLoadingVoices || isGeneratingInitial
                  ? 'not-allowed'
                  : 'pointer',
            }}
          >
            {!isClientHydrated
              ? 'Loading…'
              : isLoadingVoices
              ? 'Loading…'
              : isGeneratingInitial
              ? 'Generating…'
              : isSpeaking
              ? isPaused
                ? '▶️ Resume'
                : '⏸️ Pause'
              : '🔊 Speak'}
          </button>
          <button
            onClick={handleStopAndScroll}
            disabled={!isSpeaking && !isPaused}
            title="Stop speaking"
            style={{
              padding: '3px 8px',
              backgroundColor: theme.modalBg,
              color: theme.text,
              border: `1px solid ${theme.border}`,
              borderRadius: '3px',
              fontSize: '11px',
              cursor: !isSpeaking && !isPaused ? 'not-allowed' : 'pointer',
            }}
          >
            ⏹️ Quiet
          </button>
          <button
            /*
             * Close button must fully stop any ongoing text-to-speech.  Simply
             * calling cleanupAudio() is insufficient because it resets state
             * without actually pausing and rewinding the Audio elements.  Use
             * handleStop() instead to ensure both current and buffered audio
             * are halted before closing the modal.
             */
            onClick={() => {
              handleStop();
              onClose();
            }}
            style={{
              padding: '3px 8px',
              backgroundColor: '#6c757d',
              color: '#fff',
              border: 'none',
              borderRadius: '3px',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
      {/* Editor and overlay container */}
      <div
        style={{
          position: 'relative',
          marginTop: '0.5rem',
        }}
      >
        {/* Editor body */}
        <MDEditor
          value={editorContent}
          onChange={(val) => onContentChange(val || '')}
          height={typeof window !== 'undefined' ? window.innerHeight - 200 : 400}
          preview="edit"
          hideToolbar={false}
          commands={filteredCommands}
          textareaProps={{
            placeholder: `Write your content for ${currentProject || 'your project'}...`,
            style: {
              fontSize: '14px',
              lineHeight: '1.6',
              fontFamily: 'Georgia, serif',
            },
          }}
        />
        {/* Overlay: highlight preview on top of the editor when speaking */}
        {isSpeaking && sentences.length > 0 && (
          <div
            ref={overlayRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              padding: '0.5rem',
              border: `1px solid ${theme.border}`,
              borderRadius: '4px',
              backgroundColor: isDarkMode ? '#343a40' : '#f8f9fa',
              color: theme.text,
              pointerEvents: 'none',
            }}
            dangerouslySetInnerHTML={{ __html: getHighlightedHtml() }}
          />
        )}
      </div>
    </div>
  );
}
