import { useState, useCallback, useEffect } from 'react';
import { WorkflowState, WorkflowStep, WorkflowStepId } from './types';
import { INITIAL_WORKFLOW_STEPS } from './constants';
import { 
  detectExistingWorkflowFilesAction,
  executeWorkflowStepAction,
  getWorkflowFileContentAction
} from '@/lib/writing-assistant/workflow-actions';
import { getToolPromptAction } from '@/lib/tools-actions';
import { showAlert } from '../shared/alerts';

export function useWritingAssistant(
  currentProjectId: string | null,
  rootFolderId: string,
  currentProvider: string,
  currentModel: string,
  session: any,
  isDarkMode: boolean,
  onLoadFileIntoEditor?: (content: string, fileName: string, fileId?: string) => void
) {
  const [state, setState] = useState<WorkflowState>({
    isModalOpen: false,
    currentStep: 0,
    steps: INITIAL_WORKFLOW_STEPS,
    isLoading: false,
    projectFiles: { chapters: [] }
  });
  
  const [isLoadingPrompt, setIsLoadingPrompt] = useState(false);

  // Open modal and detect existing files
  const openModal = useCallback(async () => {
    if (!currentProjectId) return;
    
    setState(prev => ({ ...prev, isModalOpen: true, isLoading: true }));
    
    try {
      const existingFiles = await detectExistingWorkflowFilesAction(session.accessToken as string, rootFolderId, currentProjectId);
      
      if (existingFiles.success && existingFiles.data) {
        const updatedSteps = await updateStepsWithFiles(state.steps, existingFiles.data);
        
        setState(prev => ({
          ...prev,
          steps: updatedSteps,
          projectFiles: existingFiles.data || { chapters: [] },
          isLoading: false
        }));
      } else {
        setState(prev => ({
          ...prev,
          error: 'Failed to load existing workflow files',
          isLoading: false
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Failed to load existing workflow files',
        isLoading: false
      }));
    }
  }, [currentProjectId, state.steps]);

  // Close modal
  const closeModal = useCallback(() => {
    setState(prev => ({ ...prev, isModalOpen: false }));
  }, []);

  // Check file prerequisites
  const checkPrerequisites = useCallback((stepId: WorkflowStepId): { canRun: boolean; errorMessage?: string } => {
    const step = state.steps.find(s => s.id === stepId);
    if (!step) return { canRun: false, errorMessage: 'Step not found' };

    // Special check for brainstorm - it needs a file created in the Editor first
    if (stepId === 'brainstorm') {
      const brainstormFile = state.projectFiles.brainstorm;
      if (!brainstormFile || !brainstormFile.id) {
        return { 
          canRun: false, 
          errorMessage: 'Error: brainstorm.txt must exist. Please create it in the Editor first with your story ideas.'
        };
      }
      return { canRun: true };
    }

    // Check prerequisites for other steps
    if (stepId === 'outline') {
      if (!state.projectFiles.brainstorm || !state.projectFiles.brainstorm.id) {
        return { 
          canRun: false, 
          errorMessage: 'Error: brainstorm.txt must exist before creating an outline. Please run Brainstorm first.'
        };
      }
    }

    if (stepId === 'world') {
      if (!state.projectFiles.outline || !state.projectFiles.outline.id) {
        return { 
          canRun: false, 
          errorMessage: 'Error: outline.txt must exist before building the world. Please run Outline first.'
        };
      }
    }

    if (stepId === 'chapters') {
      if (!state.projectFiles.outline || !state.projectFiles.outline.id) {
        return { 
          canRun: false, 
          errorMessage: 'Error: outline.txt must exist before writing chapters. Please run Outline first.'
        };
      }
      if (!state.projectFiles.world || !state.projectFiles.world.id) {
        return { 
          canRun: false, 
          errorMessage: 'Error: world.txt must exist before writing chapters. Please run World Builder first.'
        };
      }
    }

    return { canRun: true };
  }, [state.steps, state.projectFiles]);

  // Execute workflow step with prerequisite check
  const executeStep = useCallback(async (stepId: WorkflowStepId) => {
    if (!currentProjectId) return;

    // Check prerequisites
    const { canRun, errorMessage } = checkPrerequisites(stepId);
    if (!canRun) {
      showAlert(errorMessage || 'Cannot run this step', 'error', undefined, isDarkMode);
      return;
    }

    const now = Date.now();
    const interval = setInterval(() => {
      setState(prev => ({
        ...prev,
        steps: prev.steps.map(step =>
          step.id === stepId && step.status === 'executing'
            ? { ...step, elapsedTime: Math.floor((Date.now() - now) / 1000) }
            : step
        )
      }));
    }, 1000) as unknown as number;

    setState(prev => ({
      ...prev,
      steps: prev.steps.map(step =>
        step.id === stepId 
          ? { 
              ...step, 
              status: 'executing',
              startTime: now,
              elapsedTime: 0,
              timerInterval: interval
            } : step
      )
    }));

    try {
      const result = await executeWorkflowStepAction(
        session.accessToken as string,
        rootFolderId,
        stepId,
        '', // No userInput needed - files contain the content
        currentProjectId,
        currentProvider,
        currentModel,
        state.projectFiles
      );

      if (result.success) {
        // Refresh project files to ensure all files are up to date for next steps
        const refreshedFiles = await detectExistingWorkflowFilesAction(session.accessToken as string, rootFolderId, currentProjectId!);
        
        setState(prev => ({
          ...prev,
          steps: prev.steps.map(step => {
            if (step.id === stepId) {
              // Clear timer
              if (step.timerInterval) {
                clearInterval(step.timerInterval);
              }
              return {
                ...step, 
                status: 'completed',
                fileName: result.fileName,
                fileId: result.fileId,
                createdAt: new Date().toISOString(),
                timerInterval: undefined
              };
            }
            return step;
          }),
          projectFiles: refreshedFiles.success && refreshedFiles.data ? refreshedFiles.data : {
            ...prev.projectFiles,
            [stepId]: result.file
          }
        }));
        
        // Update dependent steps
        updateDependentSteps(stepId);
      } else {
        setState(prev => ({
          ...prev,
          steps: prev.steps.map(step => {
            if (step.id === stepId) {
              // Clear timer on error
              if (step.timerInterval) {
                clearInterval(step.timerInterval);
              }
              return {
                ...step, 
                status: 'error', 
                error: result.error,
                timerInterval: undefined
              };
            }
            return step;
          })
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        steps: prev.steps.map(step => {
          if (step.id === stepId) {
            // Clear timer on error
            if (step.timerInterval) {
              clearInterval(step.timerInterval);
            }
            return {
              ...step, 
              status: 'error', 
              error: 'Execution failed',
              timerInterval: undefined
            };
          }
          return step;
        })
      }));
    }
  }, [currentProjectId, currentProvider, currentModel, state.projectFiles]);

  // View file content
  const viewFile = useCallback(async (stepId: WorkflowStepId) => {
    const step = state.steps.find(s => s.id === stepId);
    
    // Special handling for brainstorm step - check if file exists in project files first
    if (stepId === 'brainstorm') {
      const fileName = step?.fileName || 'brainstorm.txt';
      const brainstormFile = state.projectFiles.brainstorm;
      
      const fileId = brainstormFile?.id || step?.fileId;
      if (fileId) {
        // File exists, load its content
        try {
          const result = await getWorkflowFileContentAction(session.accessToken as string, rootFolderId, fileId);
          if (result.success && result.content && onLoadFileIntoEditor) {
            onLoadFileIntoEditor(result.content, fileName, fileId);
          }
        } catch (error) {
          console.error('Failed to load file content:', error);
        }
      } else {
        // File doesn't exist yet, open editor with default content for brainstorm
        const defaultContent = 'Type some of your ideas in here, so the AI can extend and enhance ...';
        if (onLoadFileIntoEditor) {
          onLoadFileIntoEditor(defaultContent, fileName);
        }
      }
      return;
    }

    // Original logic for other steps
    if (!step?.fileId || !step?.fileName) return;

    try {
      const result = await getWorkflowFileContentAction(session.accessToken as string, rootFolderId, step.fileId);
      if (result.success && result.content && onLoadFileIntoEditor) {
        onLoadFileIntoEditor(result.content, step.fileName, step.fileId);
      }
    } catch (error) {
      console.error('Failed to load file content:', error);
    }
  }, [state.steps, onLoadFileIntoEditor]);

  // Redo step handler with prerequisite check
  const redoStep = useCallback(async (stepId: WorkflowStepId) => {
    // Check prerequisites before redoing
    const { canRun, errorMessage } = checkPrerequisites(stepId);
    if (!canRun) {
      showAlert(errorMessage || 'Cannot run this step', 'error', undefined, isDarkMode);
      return;
    }

    setState(prev => ({
      ...prev,
      steps: prev.steps.map(step =>
        step.id === stepId 
          ? { ...step, status: 'ready', error: undefined }
          : step
      )
    }));
    
    await executeStep(stepId);
  }, [checkPrerequisites, executeStep]);

  // Edit prompt handler - using existing AI Tools system
  const editPrompt = useCallback(async (stepId: WorkflowStepId) => {
    if (!onLoadFileIntoEditor || isLoadingPrompt) return;
    
    // Map workflow steps to existing AI Writing Tools prompts
    const toolPromptMap = {
      brainstorm: 'AI Writing Tools/brainstorm.txt',
      outline: 'AI Writing Tools/outline_writer.txt', 
      world: 'AI Writing Tools/world_writer.txt',
      chapters: 'AI Writing Tools/chapter_writer.txt'
    };
    
    const toolId = toolPromptMap[stepId];
    if (!toolId) return;
    
    setIsLoadingPrompt(true);
    try {
      const result = await getToolPromptAction(toolId);
      if (result.success && typeof result.content === 'string') {
        // Pass the file ID for proper existing file mode
        onLoadFileIntoEditor(result.content, `tool-prompts/${toolId}`, result.fileId);
      } else {
        console.error('Failed to load workflow prompt:', result.error);
      }
    } catch (error) {
      console.error('Error loading workflow prompt:', error);
    } finally {
      setIsLoadingPrompt(false);
    }
  }, [onLoadFileIntoEditor, isLoadingPrompt]);

  // Helper function to update dependent steps
  const updateDependentSteps = useCallback((completedStepId: WorkflowStepId) => {
    setState(prev => ({
      ...prev,
      steps: prev.steps.map(step => {
        if (step.dependencies.includes(completedStepId)) {
          const allDependenciesCompleted = step.dependencies.every(depId =>
            prev.steps.find(s => s.id === depId)?.status === 'completed'
          );
          
          return allDependenciesCompleted 
            ? { ...step, status: 'ready' }
            : step;
        }
        return step;
      })
    }));
  }, []);

  // Check if any step is currently executing
  const isAnyStepExecuting = state.steps.some(step => step.status === 'executing');

  return {
    state: {
      ...state,
      isAnyStepExecuting,
      isLoadingPrompt
    },
    actions: {
      openModal,
      closeModal,
      executeStep,
      viewFile,
      redoStep,
      editPrompt
    }
  };
}

// Helper function to update steps based on existing files
async function updateStepsWithFiles(
  steps: WorkflowStep[], 
  existingFiles: any
): Promise<WorkflowStep[]> {
  return steps.map(step => {
    const fileExists = existingFiles[step.id];
    if (fileExists && (Array.isArray(fileExists) ? fileExists.length > 0 : fileExists)) {
      const file = Array.isArray(fileExists) ? fileExists[0] : fileExists;
      
      return {
        ...step,
        status: 'completed',
        fileName: file.name,
        fileId: file.id,
        createdAt: file.modifiedTime || file.createdTime
      };
    }
    
    // All steps start as ready (no more pending/blocked states)
    return {
      ...step,
      status: 'ready'
    };
  });
}