// Publishing Assistant Hook
// State management for publishing progress workflow

import { useState, useCallback } from 'react';
import { PublishingAssistantState, PublishingProgress, FileType, FileState } from '@/lib/publishing-assistant/types';
import { INITIAL_PUBLISHING_STEPS, executePublishingWithProgress, generateIndividualFile } from '@/lib/publishing-assistant/execution-engine';
import { listGoogleDriveFilesAction, checkManuscriptFilesExistAction, deleteManuscriptOutputAction } from '@/lib/google-drive-actions';

export function usePublishingAssistant(
  currentProjectId: string | null,
  rootFolderId: string,
  session: any
) {
  const [state, setState] = useState<PublishingAssistantState>({
    isModalOpen: false,
    selectedManuscript: null,
    showFileSelector: false,
    files: [],
    progress: {
      currentStep: 0,
      steps: [...INITIAL_PUBLISHING_STEPS],
      isProcessing: false,
      isComplete: false,
      generatedFiles: []
    },
    fileStates: {
      html: { exists: false, isProcessing: false },
      epub: { exists: false, isProcessing: false },
      pdf: { exists: false, isProcessing: false }
    }
  });

  // Open modal and load manuscript files
  const openModal = useCallback(async () => {
    if (!currentProjectId) return;
    
    setState(prev => ({ 
      ...prev, 
      isModalOpen: true,
      showFileSelector: true,
      progress: {
        currentStep: 0,
        steps: [...INITIAL_PUBLISHING_STEPS],
        isProcessing: false,
        isComplete: false,
        generatedFiles: []
      },
      fileStates: {
        html: { exists: false, isProcessing: false },
        epub: { exists: false, isProcessing: false },
        pdf: { exists: false, isProcessing: false }
      }
    }));
    
    try {
      const result = await listGoogleDriveFilesAction(session.accessToken as string, rootFolderId, currentProjectId);
      
      if (result.success && result.data?.files) {
        // Filter for .txt files
        const textFiles = result.data.files.filter((file: any) => 
          (file.name.endsWith('.txt') && file.mimeType === 'text/plain') || 
          file.mimeType === 'application/vnd.google-apps.document'
        );
        
        setState(prev => ({
          ...prev,
          files: textFiles
        }));
      }
    } catch (error) {
      console.error('Error loading files:', error);
    }
  }, [currentProjectId, session]);

  // Close modal
  const closeModal = useCallback(() => {
    setState(prev => ({
      ...prev,
      isModalOpen: false,
      showFileSelector: false,
      selectedManuscript: null,
      progress: {
        currentStep: 0,
        steps: [...INITIAL_PUBLISHING_STEPS],
        isProcessing: false,
        isComplete: false,
        generatedFiles: []
      },
      fileStates: {
        html: { exists: false, isProcessing: false },
        epub: { exists: false, isProcessing: false },
        pdf: { exists: false, isProcessing: false }
      }
    }));
  }, []);

  // Select manuscript file
  const selectManuscript = useCallback(async (file: any) => {
    if (!currentProjectId) return;
    
    setState(prev => ({
      ...prev,
      selectedManuscript: file,
      showFileSelector: false
    }));

    // Check for existing manuscript files
    try {
      const existsResult = await checkManuscriptFilesExistAction(session.accessToken as string, rootFolderId, currentProjectId);
      if (existsResult.success && existsResult.data) {
        const data = existsResult.data;
        setState(prev => ({
          ...prev,
          fileStates: {
            html: { exists: data.html, isProcessing: false },
            epub: { exists: data.epub, isProcessing: false },
            pdf: { exists: data.pdf, isProcessing: false }
          }
        }));
      }
    } catch (error) {
      console.error('Error checking file existence:', error);
    }
  }, [currentProjectId, session]);

  // Start publishing process
  const startPublishing = useCallback(async () => {
    if (!state.selectedManuscript || !currentProjectId) return;
    
    setState(prev => ({
      ...prev,
      progress: {
        ...prev.progress,
        isProcessing: true,
        isComplete: false,
        currentStep: 0,
        steps: [...INITIAL_PUBLISHING_STEPS]
      }
    }));

    // Progress update callback
    const onProgressUpdate = (progress: PublishingProgress) => {
      setState(prev => ({
        ...prev,
        progress
      }));
    };

    // Execute publishing with progress tracking
    const result = await executePublishingWithProgress(
      state.selectedManuscript.id,
      currentProjectId,
      onProgressUpdate
    );

    // Final state update is handled by executePublishingWithProgress
    // through the onProgressUpdate callback
    
  }, [state.selectedManuscript, currentProjectId]);

  // Reset to file selection
  const resetToFileSelection = useCallback(() => {
    setState(prev => ({
      ...prev,
      selectedManuscript: null,
      showFileSelector: true,
      progress: {
        currentStep: 0,
        steps: [...INITIAL_PUBLISHING_STEPS],
        isProcessing: false,
        isComplete: false,
        generatedFiles: []
      },
      fileStates: {
        html: { exists: false, isProcessing: false },
        epub: { exists: false, isProcessing: false },
        pdf: { exists: false, isProcessing: false }
      }
    }));
  }, []);

  // Individual file generation
  const generateFile = useCallback(async (fileType: FileType) => {
    if (!state.selectedManuscript || !currentProjectId) return;

    // Set processing state for this file type
    setState(prev => ({
      ...prev,
      fileStates: {
        ...prev.fileStates,
        [fileType]: { ...prev.fileStates[fileType], isProcessing: true, error: undefined }
      }
    }));

    try {
      // Best-effort delete existing output before (re-)creating
      try {
        await deleteManuscriptOutputAction(
          session.accessToken as string,
          rootFolderId,
          currentProjectId,
          fileType
        );
      } catch (e) {
        // Proceed even if delete fails; generation will overwrite if supported
      }

      const result = await generateIndividualFile(
        fileType,
        state.selectedManuscript.id,
        currentProjectId
      );

      setState(prev => ({
        ...prev,
        fileStates: {
          ...prev.fileStates,
          [fileType]: {
            exists: result.success,
            isProcessing: false,
            error: result.error
          }
        }
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setState(prev => ({
        ...prev,
        fileStates: {
          ...prev.fileStates,
          [fileType]: {
            ...prev.fileStates[fileType],
            isProcessing: false,
            error: errorMessage
          }
        }
      }));
    }
  }, [state.selectedManuscript, currentProjectId]);

  return {
    state,
    actions: {
      openModal,
      closeModal,
      selectManuscript,
      startPublishing,
      resetToFileSelection,
      generateFile
    }
  };
}
