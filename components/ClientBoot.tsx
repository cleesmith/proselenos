// components/ClientBoot.tsx

'use client';

import { useEffect, useCallback } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { useState } from 'react';
import Swal from 'sweetalert2';
import ProselenosHeader from '../app/proselenos/proselenosHeader';
import SettingsDialog from '../components/SettingsDialog';
import ModelsDropdown from '../components/ModelsDropdown';
import EditorModal from '../app/proselenos/EditorModal';
import ProjectSection from '../app/projects/ProjectSection';
import ProjectSelectorModal from '../app/projects/ProjectSelectorModal';
import ImportDocxModal from '../app/projects/ImportDocxModal';
import ExportModal from '../app/projects/ExportModal';
import UploadModal from '../app/projects/UploadModal';
import { useProjectManager } from '../app/projects/useProjectManager';
import AIToolsSection from '../app/ai-tools/AIToolsSection';
import FileSelectorModal from '../app/ai-tools/FileSelectorModal';
import { useToolsManager } from '../app/ai-tools/useToolsManager';
import NonAIToolsSection from '../app/non-ai-tools/NonAIToolsSection';
import { useNonAITools } from '../app/non-ai-tools/useNonAITools';
import { getTheme } from '../app/shared/theme';
import { showAlert, showStickyErrorWithLogout } from '../app/shared/alerts';
import AboutModal from '../components/AboutModal';
import {
  getproselenosConfigAction,
  validateCurrentProjectAction,
  installToolPromptsAction,
  updateProviderAndModelAction,
  updateSelectedModelAction,
  createGoogleDriveFileAction,
  updateGoogleDriveFileAction,
  loadProjectMetadataAction,
  saveProjectMetadataAction,
  listGoogleDriveFilesAction,
  readGoogleDriveFileAction
} from '@/lib/google-drive-actions';
import { hasApiKeyAction } from '@/lib/api-key-actions';
import ProjectSettingsModal, { ProjectMetadata } from '../app/projects/ProjectSettingsModal';
import type { InitPayloadForClient } from '../app/lib/drive/fastInitServer';

export default function ClientBoot({ init }: { init: InitPayloadForClient | null }) {
  const { data: session, status } = useSession();
  
  // Projects Domain State
  const [projectState, projectActions] = useProjectManager();
  
  // AI Tools Domain State
  const [toolsState, toolsActions] = useToolsManager();
  
  // Non-AI Tools Domain State
  const [nonAIToolsState, nonAIToolsActions] = useNonAITools();
  
  // Core app state
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [editorContent, setEditorContent] = useState('');
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);
  const [currentFileId, setCurrentFileId] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<'new' | 'existing'>('new');
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showModelsDropdown, setShowModelsDropdown] = useState(false);
  const [currentProvider, setCurrentProvider] = useState('openrouter');
  const [currentModel, setCurrentModel] = useState('google/gemini-2.5-flash');
  const [hasConfiguredProvider, setHasConfiguredProvider] = useState(false);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [isGoogleDriveOperationPending, setIsGoogleDriveOperationPending] = useState(false);
  const [hasCheckedToolPrompts, setHasCheckedToolPrompts] = useState(false);
  const [isInstallingToolPrompts, setIsInstallingToolPrompts] = useState(false);
  const [isGoogleDriveReady, setIsGoogleDriveReady] = useState(false);
  const [hasShownReadyModal, setHasShownReadyModal] = useState(false);
  const [isSystemInitializing, setIsSystemInitializing] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [initFailed, setInitFailed] = useState(false);
  const [showProjectSettingsModal, setShowProjectSettingsModal] = useState(false);
  const [projectMetadata, setProjectMetadata] = useState<ProjectMetadata | undefined>(undefined);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  // Editor TXT file selector state
  const [showEditorFileSelector, setShowEditorFileSelector] = useState(false);
  const [editorFileSelectorFiles, setEditorFileSelectorFiles] = useState<any[]>([]);

  const theme = getTheme(isDarkMode);

  // Utility: add a timeout to any promise to prevent hangs during initialization
  const withTimeout = useCallback(async <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        const id = setTimeout(() => {
          clearTimeout(id);
          reject(new Error(`${label} timed out after ${ms}ms`));
        }, ms);
      })
    ]) as T;
  }, []);

  // Initialize from fast init payload
  useEffect(() => {
    if (!init) return;

    // Hydrate config settings
    if (init.config?.settings.current_project) {
      projectActions.setCurrentProject(init.config.settings.current_project);
      projectActions.setCurrentProjectId(init.config.settings.current_project_folder_id);
    }
    if (init.config?.selectedApiProvider) {
      setCurrentProvider(init.config.selectedApiProvider);
      setHasConfiguredProvider(true);
    }
    if (init.config?.selectedAiModel) {
      setCurrentModel(init.config.selectedAiModel);
    }

    // Hydrate tools
    const allTools = Object.entries(init.toolsByCategory).flatMap(([category, tools]) =>
      tools.map(t => ({ 
        id: `${category}/${t.name}`, // Use category/filename format instead of Google Drive file ID
        name: t.name.replace(/\.(txt|md|json)$/i, ''), 
        category 
      }))
    );
    toolsActions.setAvailableTools(allTools);
    toolsActions.setToolsReady(true);

    console.log(`Fast init completed in ${init.durationMs}ms`);
  }, [init]); // Removed projectActions and toolsActions from dependencies
  
  // Check tool-prompts installation status after fast init
//   useEffect(() => {
//     const checkToolPromptsStatus = async () => {
//       if (!session?.accessToken || hasCheckedToolPrompts || !init) return;
    
//       try {
//         // Show initializing modal if no settings file (first-time setup)
//         if (!init.hasSettingsFile) {
//           setIsGoogleDriveOperationPending(true);
//           Swal.fire({
//             title: 'Initializing',
//             html: 'Standby!<br />Connecting and preparing Google Drive...',
//             icon: 'info',
//             background: isDarkMode ? '#222' : '#fff',
//             color: isDarkMode ? '#fff' : '#333',
//             showConfirmButton: false,
//             allowOutsideClick: false,
//             allowEscapeKey: false
//           });
//         }
      
//         // Check if we need to install tool-prompts folder (without loading tools yet)
//         if (Object.keys(init.toolsByCategory).length === 0) {
//           // auto-install tool-prompts folder only
//           setIsInstallingToolPrompts(true);
//           setIsGoogleDriveOperationPending(true);
//           Swal.close(); // close any previous alert
//           Swal.fire({
//             title: 'Initializing',
//             text: 'Preparing proselenos_projects folder on Google Drive...',
//             icon: 'info',
//             background: isDarkMode ? '#222' : '#fff',
//             color: isDarkMode ? '#fff' : '#333',
//             showConfirmButton: false,
//             allowOutsideClick: false,
//             allowEscapeKey: false
//           });
        
//           try {
//             const installResult = await withTimeout(
//               installToolPromptsAction(session.accessToken as string, init.config?.settings.proselenos_root_folder_id || ''),
//               45000,
//               'Google Drive initialization'
//             );
          
//             if (installResult.success) {
//               setIsGoogleDriveReady(true);
//               setIsGoogleDriveOperationPending(false);
//               // cls: Don't load tools yet - wait until first project is created
//               // Immediately load tools now that the folder exists
//               await toolsActions.loadToolsFromGoogleDrive(isDarkMode);
//             } else {
//               Swal.close();
//               setIsGoogleDriveOperationPending(false);
//               setIsInstallingToolPrompts(false);
//               setInitFailed(true);
            
//               // Check if the failure is due to Google Drive permissions
//               const errorMsg = installResult.message || installResult.error || 'Unknown error';
//               const isPermissionError = 
//                 errorMsg.includes('403') ||
//                 errorMsg.includes('insufficient authentication scopes') ||
//                 errorMsg.includes('Permission denied') ||
//                 errorMsg.includes('Request had insufficient authentication scopes') ||
//                 errorMsg.includes('The user has not granted the app') ||
//                 errorMsg.includes('Root folder ID is required'); // ADD THIS KEY PATTERN
            
//               if (isPermissionError) {
//                 const detailedPermissionError = `It looks like Google Drive access wasn't granted when you signed in just now.

// WHY THIS IS NEEDED:
// Proselenos needs to create a dedicated "proselenos_projects" folder in your Google Drive to store your writing projects, settings, and AI tools. Without this permission, the app cannot function at all.

// WHAT HAPPENED:
// When you signed in, there was a checkbox on Google's permission screen that said "See, edit, create, and delete only the specific Google Drive files you use with this app." This checkbox was likely unchecked, so the app didn't receive the necessary permissions.

// WHAT TO DO NEXT:
// 1. When you click "Sign out" below, you'll be taken back to the Proselenos landing page
// 2. Now, Sign in with Google, again
// 3. This time, the permission screen may look different - it might not show a checkbox at all
// 4. Instead, it may simply say you're granting access to "Google Drive files" - this is normal
// 5. But if there is a checkbox, be sure to check it
// 6. Just click "Continue" to proceed

// IMPORTANT PRIVACY NOTE:
// The app can ONLY access files it creates in the "proselenos_projects" folder. It cannot see, read, or modify any of your other Google Drive files, folders, or documents. Your privacy is completely protected.

// This is a one-time setup step. Once granted, you won't see this permission screen again.`;

//                 showStickyErrorWithLogout(
//                   'Google Drive Access Required',
//                   detailedPermissionError,
//                   isDarkMode
//                 );
//               } else {
//                 showStickyErrorWithLogout(
//                   'Initialization failed',
//                   `Tool-prompts install failed: ${errorMsg}`,
//                   isDarkMode
//                 );
//               }
//               return;
//             }
//           } catch (error) {
//             Swal.close();
//             setIsGoogleDriveOperationPending(false);
//             setIsInstallingToolPrompts(false);
//             setInitFailed(true);
          
//             const msg = error instanceof Error ? error.message : String(error);
          
//             // Check if this is a Google Drive permission issue
//             const isPermissionError = 
//               (error as any)?.code === 403 || 
//               (error as any)?.status === 403 || 
//               msg.includes('insufficient authentication scopes') ||
//               msg.includes('Permission denied') ||
//               msg.includes('Request had insufficient authentication scopes') ||
//               msg.includes('The user has not granted the app') ||
//               msg.includes('403') ||
//               msg.includes('Root folder ID is required'); // ADD THIS KEY PATTERN HERE TOO
          
//             if (isPermissionError) {
//               const detailedPermissionError = `It looks like Google Drive access wasn't granted when you signed in just now.

// WHY THIS IS NEEDED:
// Proselenos needs to create a dedicated "proselenos_projects" folder in your Google Drive to store your writing projects, settings, and AI tools. Without this permission, the app cannot function at all.

// WHAT HAPPENED:
// When you signed in, there was a checkbox on Google's permission screen that said "See, edit, create, and delete only the specific Google Drive files you use with this app." This checkbox was likely unchecked, so the app didn't receive the necessary permissions.

// WHAT TO DO NEXT:
// 1. When you click "Sign out" below, you'll be taken back to the Proselenos landing page
// 2. Now, Sign in with Google, again
// 3. This time, the permission screen may look different - it might not show a checkbox at all
// 4. Instead, it may simply say you're granting access to "Google Drive files" - this is normal
// 5. But if there is a checkbox, be sure to check it
// 6. Just click "Continue" to proceed

// IMPORTANT PRIVACY NOTE:
// The app can ONLY access files it creates in the "proselenos_projects" folder. It cannot see, read, or modify any of your other Google Drive files, folders, or documents. Your privacy is completely protected.

// This is a one-time setup step. Once granted, you won't see this permission screen again.`;

//               showStickyErrorWithLogout(
//                 'Google Drive Access Required',
//                 detailedPermissionError,
//                 isDarkMode
//               );
//             } else {
//               showStickyErrorWithLogout(
//                 'Initialization error',
//                 `Something went wrong setting up your workspace: ${msg}

// Please try signing in again. If the problem persists, check your internet connection.`,
//                 isDarkMode
//               );
//             }
//             return;
//           } finally {
//             setIsInstallingToolPrompts(false);
//           }
//         } else {
//           // Tool-prompts already exist
//           setIsGoogleDriveReady(true);
//           setIsGoogleDriveOperationPending(false);
//         }
//       } catch (error) {
//         console.error('Error checking tool-prompts installation:', error);
//       } finally {
//         setHasCheckedToolPrompts(true);
//       }
//     };

//     // Start check after fast init completes
//     if (init) {
//       checkToolPromptsStatus();
//     }
//   }, [session, hasCheckedToolPrompts, isDarkMode, init, toolsActions]);
  useEffect(() => {
    const checkToolPromptsStatus = async () => {
      // Only run once per session/init
      if (!session?.accessToken || hasCheckedToolPrompts || !init) return;

      try {
        // Show an initializing modal if this is a first-time setup (no settings file yet)
        if (!init.hasSettingsFile) {
          setIsGoogleDriveOperationPending(true);
          Swal.fire({
            title: 'Initializing',
            html: 'Standby!<br />Connecting and preparing Google Drive...',
            icon: 'info',
            background: isDarkMode ? '#222' : '#fff',
            color: isDarkMode ? '#fff' : '#333',
            showConfirmButton: false,
            allowOutsideClick: false,
            allowEscapeKey: false
          });
        }

        // If there are no tool categories at all, we need to install the tool-prompts folder
        if (Object.keys(init.toolsByCategory).length === 0) {
          setIsInstallingToolPrompts(true);
          setIsGoogleDriveOperationPending(true);
          Swal.close(); // close any previous alert
          Swal.fire({
            title: 'Initializing',
            text: 'Preparing proselenos_projects folder on Google Drive...',
            icon: 'info',
            background: isDarkMode ? '#222' : '#fff',
            color: isDarkMode ? '#fff' : '#333',
            showConfirmButton: false,
            allowOutsideClick: false,
            allowEscapeKey: false
          });

          try {
            // Attempt to install the original tool-prompts folder from the app bundle
            const installResult = await withTimeout(
              installToolPromptsAction(
                session.accessToken as string,
                init.config?.settings.proselenos_root_folder_id || ''
              ),
              45_000,
              'Google Drive initialization'
            );

            if (installResult.success) {
              // Installation succeeded: mark Drive as ready and stop the spinner
              setIsGoogleDriveReady(true);
              setIsGoogleDriveOperationPending(false);
              // Do NOT load tools here; first-time users will load them when they create the first project
            } else {
              // Installation failed: show an error modal and mark init as failed
              Swal.close();
              setIsGoogleDriveOperationPending(false);
              setIsInstallingToolPrompts(false);
              setInitFailed(true);

              const errorMsg = installResult.message || installResult.error || 'Unknown error';
              const isPermissionError =
                errorMsg.includes('403') ||
                errorMsg.includes('insufficient authentication scopes') ||
                errorMsg.includes('Permission denied') ||
                errorMsg.includes('Request had insufficient authentication scopes') ||
                errorMsg.includes('The user has not granted the app') ||
                errorMsg.includes('Root folder ID is required');

              if (isPermissionError) {
                // Explain to the user how to re‑grant Drive permissions
                const detailedPermissionError = `It looks like Google Drive access wasn't granted when you signed in just now.

  WHY THIS IS NEEDED:
  Proselenos needs to create a dedicated "proselenos_projects" folder in your Google Drive to store your writing projects, settings, and AI tools. Without this permission, the app cannot function at all.

  WHAT HAPPENED:
  When you signed in, there was a checkbox on Google's permission screen that said "See, edit, create, and delete only the specific Google Drive files you use with this app." This checkbox was likely unchecked, so the app didn't receive the necessary permissions.

  WHAT TO DO NEXT:
  1. When you click "Sign out" below, you'll be taken back to the Proselenos landing page
  2. Now, sign in with Google again
  3. This time, the permission screen may look different – it might not show a checkbox at all
  4. Instead, it may simply say you're granting access to "Google Drive files" – this is normal
  5. But if there is a checkbox, be sure to check it
  6. Just click "Continue" to proceed

  IMPORTANT PRIVACY NOTE:
  The app can ONLY access files it creates in the "proselenos_projects" folder. It cannot see, read, or modify any of your other Google Drive files, folders, or documents. Your privacy is completely protected.

  This is a one‑time setup step. Once granted, you won't see this permission screen again.`;

                showStickyErrorWithLogout(
                  'Google Drive Access Required',
                  detailedPermissionError,
                  isDarkMode
                );
              } else {
                showStickyErrorWithLogout(
                  'Initialization failed',
                  `Tool-prompts install failed: ${errorMsg}`,
                  isDarkMode
                );
              }
              return;
            }
          } catch (error) {
            // Catch runtime errors during installation (network issues, timeouts, etc.)
            Swal.close();
            setIsGoogleDriveOperationPending(false);
            setIsInstallingToolPrompts(false);
            setInitFailed(true);

            const msg = error instanceof Error ? error.message : String(error);
            const isPermissionError =
              (error as any)?.code === 403 ||
              (error as any)?.status === 403 ||
              msg.includes('insufficient authentication scopes') ||
              msg.includes('Permission denied') ||
              msg.includes('Request had insufficient authentication scopes') ||
              msg.includes('The user has not granted the app') ||
              msg.includes('403') ||
              msg.includes('Root folder ID is required');

            if (isPermissionError) {
              const detailedPermissionError = `It looks like Google Drive access wasn't granted when you signed in just now.

  WHY THIS IS NEEDED:
  Proselenos needs to create a dedicated "proselenos_projects" folder in your Google Drive to store your writing projects, settings, and AI tools. Without this permission, the app cannot function at all.

  WHAT HAPPENED:
  When you signed in, there was a checkbox on Google's permission screen that said "See, edit, create, and delete only the specific Google Drive files you use with this app." This checkbox was likely unchecked, so the app didn't receive the necessary permissions.

  WHAT TO DO NEXT:
  1. When you click "Sign out" below, you'll be taken back to the Proselenos landing page
  2. Now, sign in with Google again
  3. This time, the permission screen may look different – it might not show a checkbox at all
  4. Instead, it may simply say you're granting access to "Google Drive files" – this is normal
  5. But if there is a checkbox, be sure to check it
  6. Just click "Continue" to proceed

  IMPORTANT PRIVACY NOTE:
  The app can ONLY access files it creates in the "proselenos_projects" folder. It cannot see, read, or modify any of your other Google Drive files, folders, or documents. Your privacy is completely protected.

  This is a one‑time setup step. Once granted, you won't see this permission screen again.`;

              showStickyErrorWithLogout(
                'Google Drive Access Required',
                detailedPermissionError,
                isDarkMode
              );
            } else {
              showStickyErrorWithLogout(
                'Initialization error',
                `Something went wrong setting up your workspace: ${msg}

  Please try signing in again. If the problem persists, check your internet connection.`,
                isDarkMode
              );
            }
            return;
          } finally {
            // Whether success or failure, stop showing the install spinner
            setIsInstallingToolPrompts(false);
          }
        } else {
          // The tool‑prompts folder already exists on the user's Drive
          setIsGoogleDriveReady(true);
          setIsGoogleDriveOperationPending(false);
          // Load tools immediately if they haven't been loaded yet
          if (!toolsState.toolsReady) {
            try {
              await toolsActions.loadToolsFromGoogleDrive(isDarkMode);
            } catch (err) {
              console.error('Error loading AI tools:', err);
            }
          }
        }
      } catch (error) {
        console.error('Error checking tool-prompts installation:', error);
      } finally {
        // Mark that we have performed this check so it doesn’t run again
        setHasCheckedToolPrompts(true);
      }
    };

    // Start the check after the fast-init payload is available
    if (init) {
      checkToolPromptsStatus();
    }
    // Depend on toolsState.toolsReady to avoid stale closures
  }, [
    session,
    hasCheckedToolPrompts,
    isDarkMode,
    init,
    toolsState.toolsReady,
    toolsActions,
    isInstallingToolPrompts
  ]);


  // Helper function to get loading status
  const getLoadingStatus = () => {
    const checks = [
      { name: 'Google Drive', ready: isGoogleDriveReady },
      { name: 'AI Tools', ready: toolsState.toolsReady },
      { name: 'Authentication', ready: !!session?.accessToken },
      { name: 'Project', ready: projectState.currentProject || !init?.config?.settings.current_project }
    ];
    
    const readyCount = checks.filter(check => check.ready).length;
    const notReady = checks.filter(check => !check.ready);
    
    return {
      allReady: readyCount === checks.length,
      readyCount,
      totalCount: checks.length,
      notReady: notReady.map(check => check.name)
    };
  };

  // Show Ready modal when all systems are ready
  useEffect(() => {
    if (!session) return;          // Don't run initialization logic without session
    if (isLoggingOut) return;      // Skip initialization logic during logout
    if (initFailed) return;        // Don't show init modals after failure

    const status = getLoadingStatus();

    if (status.allReady && !hasShownReadyModal) {
      // Mark as shown before opening the Ready modal so it fires only once
      setHasShownReadyModal(true);
      Swal.close(); // Close any initializing alert
      Swal.fire({
        title: 'Ready!',
        html: `All systems loaded successfully!<br><br>Loading... (${status.readyCount}/${status.totalCount}) - Complete!`,
        icon: 'success',
        background: isDarkMode ? '#222' : '#fff',
        color: isDarkMode ? '#fff' : '#333',
        confirmButtonColor: '#10b981',
        confirmButtonText: 'Click to read, write, edit ... repeat',
        allowOutsideClick: false,
        allowEscapeKey: false,
      }).then(() => {
        setIsSystemInitializing(false); // Enable UI buttons
        // Show welcome guide only for new users (treat unknown as missing)
        const isNewUser =
          !projectState.currentProject &&
          (hasApiKey === false || hasApiKey === null);
        if (isNewUser) {
          showWelcomeGuide();
        }
      });
    } else if (!status.allReady && isSystemInitializing && !initFailed) {
      // Show persistent initializing modal
      Swal.fire({
        title: 'Initializing Proselenos...',
        html: `Loading... (${status.readyCount}/${status.totalCount})<br>Waiting for: ${status.notReady.join(', ')}`,
        icon: 'info',
        background: isDarkMode ? '#222' : '#fff',
        color: isDarkMode ? '#fff' : '#333',
        showConfirmButton: false,
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });
    }
  }, [
    isGoogleDriveReady,
    toolsState.toolsReady,
    session?.accessToken,
    hasApiKey,
    projectState.currentProject,
    init?.config?.settings.current_project,
    hasShownReadyModal,
    isSystemInitializing,
    isLoggingOut,
    isDarkMode,
    initFailed,
  ]);

  // When a project is selected (either by creation or selection),
  // automatically disable system-initializing state so buttons reappear.
  useEffect(() => {
    if (projectState.currentProject && isSystemInitializing) {
      setIsSystemInitializing(false);
    }
  }, [projectState.currentProject, isSystemInitializing]);


  // Check if API key exists for Models button visibility
  const checkApiKey = useCallback(async () => {
    if (!session?.accessToken || !currentProvider) return;
    
    try {
      const result = await withTimeout(hasApiKeyAction(currentProvider), 8000, 'Checking API key');
      if (result.success) {
        setHasApiKey(result.hasKey || false);
      } else {
        setHasApiKey(false);
      }
    } catch (error) {
      console.error('Error checking API key:', error);
      setHasApiKey(false);
    }
  }, [session?.accessToken, currentProvider]);

  // Auto-load previous project when session is ready (if not loaded from fast init)
  useEffect(() => {
    if (session?.accessToken && !projectState.currentProject && !init?.config?.settings.current_project) {
      loadFullConfig();
    }
  }, [session?.accessToken, projectState.currentProject, init]);

  // Check API key status when session or provider changes
  useEffect(() => {
    if (session?.accessToken && currentProvider) {
      checkApiKey();
    }
  }, [session?.accessToken, currentProvider, checkApiKey]);

  // Validate current project if it exists
  useEffect(() => {
    const validateProject = async () => {
      if (!session?.accessToken || !projectState.currentProject || !projectState.currentProjectId) return;

      try {
        const validateResult = await withTimeout(
          validateCurrentProjectAction(session.accessToken as string, init?.config?.settings.proselenos_root_folder_id || ''),
          12000,
          'Validating project'
        );
        if (validateResult.success && validateResult.data?.isValid) {
          projectActions.setUploadStatus(`✅ Project loaded: ${projectState.currentProject}`);
        } else {
          projectActions.setUploadStatus('⚠️ Previous project no longer exists. Please select a project.');
        }
      } catch (error) {
        console.error('Error validating project:', error);
      }
    };

    validateProject();
  }, [session, projectState.currentProject, projectState.currentProjectId, projectActions.setUploadStatus, init]);

  // Load full config (including settings decryption) when needed
  const loadFullConfig = useCallback(async () => {
    if (!session || isLoadingConfig) return;
    
    setIsLoadingConfig(true);
    
    try {
      const result = await withTimeout(
        getproselenosConfigAction(session.accessToken as string, init?.config?.settings.proselenos_root_folder_id || ''),
        15000,
        'Loading configuration'
      );
      
      if (result.success && result.data?.config) {
        const config = result.data.config;
        const { current_project, current_project_folder_id } = config.settings;
        
        // Load provider and model settings if they exist
        if (config.selectedApiProvider) {
          setCurrentProvider(config.selectedApiProvider);
          setHasConfiguredProvider(true);
        }
        if (config.selectedAiModel) {
          setCurrentModel(config.selectedAiModel);
        }
        
        // Only set project if it exists and is valid
        if (current_project && current_project_folder_id) {
          // Validate project still exists
          const validateResult = await withTimeout(
            validateCurrentProjectAction(session.accessToken as string, init?.config?.settings.proselenos_root_folder_id || ''),
            12000,
            'Validating project'
          );
          
          if (validateResult.success && validateResult.data?.isValid) {
            projectActions.setCurrentProject(current_project);
            projectActions.setCurrentProjectId(current_project_folder_id);
            projectActions.setUploadStatus(`✅ Project loaded: ${current_project}`);
          } else {
            projectActions.setUploadStatus('⚠️ Previous project no longer exists. Please select a project.');
          }
        }
      }
    } catch (error) {
      console.error('Error loading config:', error);
    } finally {
      setIsLoadingConfig(false);
    }
  }, [session, isLoadingConfig, projectActions.setCurrentProject, projectActions.setCurrentProjectId, projectActions.setUploadStatus, init]);

  // Toggle theme
  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  // Handle sign out
  const handleSignOut = () => {
    setIsLoggingOut(true);
    Swal.close(); // Close any modals
    signOut();
  };

  // Open full-screen editor for current project
  const openEditor = () => {
    if (!projectState.currentProject) {
      showAlert('Select a Project first!\nEditor is restricted to a Writing Project.', 'warning', undefined, isDarkMode);
      return;
    }
    setEditorContent('');
    setCurrentFileName(null);
    setCurrentFileId(null);
    setEditorMode('new');
    setShowEditorModal(true);
  };

  // Editor file operations
  const handleEditorSaveFile = async (content: string, fileName?: string) => {
    if (!session?.accessToken) {
      throw new Error('Not authenticated');
    }
    
    // Existing file mode - update the existing file
    if (editorMode === 'existing' && currentFileId) {
      const result = await updateGoogleDriveFileAction(session.accessToken, init?.config?.settings.proselenos_root_folder_id || '', currentFileId, content);
      if (!result.success) {
        throw new Error(result.error);
      }
      return;
    }
    
    // New file mode - create new file (requires filename and project)
    if (!fileName) {
      throw new Error('File name is required for new files');
    }
    if (!projectState.currentProjectId) {
      throw new Error('Project ID is required for new files');
    }
    
    const result = await createGoogleDriveFileAction(session.accessToken, init?.config?.settings.proselenos_root_folder_id || '', content, fileName, projectState.currentProjectId);
    if (!result.success) {
      throw new Error(result.error);
    }
  };

  const handleEditorBrowseFiles = async () => {
    if (!session?.accessToken) {
      projectActions.setUploadStatus('❌ Not authenticated');
      showAlert('You must sign in first!', 'error', undefined, isDarkMode);
      return;
    }
    if (!projectState.currentProjectId) {
      showAlert('Select a project first!', 'info', undefined, isDarkMode);
      return;
    }

    setIsGoogleDriveOperationPending(true);
    projectActions.setUploadStatus('Loading TXT files...');
    try {
      const result = await listGoogleDriveFilesAction(
        session.accessToken,
        init?.config?.settings.proselenos_root_folder_id || '',
        projectState.currentProjectId
      );
      if (result.success && result.data?.files) {
        const txtFiles = result.data.files.filter((file: any) =>
          (typeof file.name === 'string' && file.name.toLowerCase().endsWith('.txt')) ||
          file.mimeType === 'text/plain'
        );
        if (txtFiles.length === 0) {
          showAlert('No TXT files found in the current project. Please add a .txt file first.', 'info', undefined, isDarkMode);
          return;
        }
        setEditorFileSelectorFiles(txtFiles);
        setShowEditorFileSelector(true);
        projectActions.setUploadStatus(`Found ${txtFiles.length} TXT files`);
      } else {
        showAlert(`Failed to load project files: ${result.error}`, 'error', undefined, isDarkMode);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      showAlert(`Error loading project files: ${msg}`, 'error', undefined, isDarkMode);
    } finally {
      setIsGoogleDriveOperationPending(false);
    }
  };

  const handleEditorFileSelectorClose = () => {
    setShowEditorFileSelector(false);
  };

  const handleEditorFileSelect = async (file: any) => {
    if (!session?.accessToken) {
      showAlert('Not authenticated!', 'error', undefined, isDarkMode);
      return;
    }
    try {
      const result = await readGoogleDriveFileAction(
        session.accessToken,
        init?.config?.settings.proselenos_root_folder_id || '',
        file.id
      );
      if (result.success) {
        const content = result.data && (result.data as any).content ? (result.data as any).content : '';
        handleLoadFileIntoEditor(content, file.name, file.id);
      } else {
        showAlert(`Failed to load file: ${result.error}`, 'error', undefined, isDarkMode);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      showAlert(`Error reading file: ${msg}`, 'error', undefined, isDarkMode);
    } finally {
      setShowEditorFileSelector(false);
    }
  };

  // Settings save handler (API key only)
  const handleSettingsSave = async (provider: string) => {
    if (!session?.accessToken) {
      projectActions.setUploadStatus('❌ Not authenticated');
      return;
    }
    
    projectActions.setUploadStatus(`Saving settings for ${provider}...`);
    
    try {
      // Set local state first
      setCurrentProvider(provider);
      setHasConfiguredProvider(true);
      
      // IMPORTANT: Actually save the provider to the config file
      // This was missing before - that's why selectedApiProvider stayed empty!
      const updateResult = await updateProviderAndModelAction(
        session.accessToken, 
        init?.config?.settings.proselenos_root_folder_id || '', 
        provider, 
        'google/gemini-2.5-flash-lite' // Default model - almost free for testing
      );
      
      if (!updateResult.success) {
        throw new Error(updateResult.error || 'Failed to update provider config');
      }
      
      // Set default model in local state too
      setCurrentModel('google/gemini-2.5-flash-lite');
      
      // Check API key status after save
      await checkApiKey();
      projectActions.setUploadStatus(`✅ Settings saved for ${provider}. Click Models button to select your preferred model.`);
    } catch (error) {
      projectActions.setUploadStatus(`❌ Failed to save settings: ${error instanceof Error ? error.message : String(error)}`);
      console.error('Settings save error:', error);
    }
  };

  // Project action handlers
  const handleSelectProject = () => {
    projectActions.openProjectSelector(session, init?.config?.settings.proselenos_root_folder_id || '', isDarkMode);
  };

  const handleOpenSettings = async () => {
    // Load full config including settings decryption when opening settings
    if (!hasConfiguredProvider && init?.hasSettingsFile) {
      await loadFullConfig();
    }
    setShowSettingsDialog(true);
  };

  const handleOpenAbout = () => {
    setShowAboutModal(true);
  };

  const handleModelsClick = () => {
    setShowModelsDropdown(true);
  };

  const handleModelSelect = async (model: string) => {
    if (!session?.accessToken) {
      projectActions.setUploadStatus('❌ Not authenticated');
      return;
    }

    projectActions.setUploadStatus(`Updating AI model to ${model}...`);
    
    try {
      const result = await updateSelectedModelAction(session.accessToken, init?.config?.settings.proselenos_root_folder_id || '', model);
      if (result.success) {
        setCurrentModel(model);
        projectActions.setUploadStatus(`✅ AI model updated to ${model}`);
      } else {
        projectActions.setUploadStatus(`❌ Failed to update model: ${result.error}`);
      }
    } catch (error) {
      projectActions.setUploadStatus(`❌ Failed to update model: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleProjectSettings = async () => {
    if (!projectState.currentProject || !projectState.currentProjectId) {
      showAlert('Please select a project first!', 'warning', undefined, isDarkMode);
      return;
    }
    
    if (!session?.accessToken) {
      showAlert('Not authenticated!', 'error', undefined, isDarkMode);
      return;
    }

    setIsLoadingMetadata(true);
    setShowProjectSettingsModal(true);

    try {
      const result = await loadProjectMetadataAction(session.accessToken, init?.config?.settings.proselenos_root_folder_id || '', projectState.currentProjectId);
      if (result.success && result.data) {
        setProjectMetadata(result.data);
      } else {
        showAlert(`Failed to load project settings: ${result.error}`, 'error', undefined, isDarkMode);
      }
    } catch (error) {
      showAlert(`Error loading project settings: ${error instanceof Error ? error.message : String(error)}`, 'error', undefined, isDarkMode);
    } finally {
      setIsLoadingMetadata(false);
    }
  };

  const handleDocxImport = () => {
    projectActions.handleDocxImport(session, isDarkMode, setIsGoogleDriveOperationPending);
  };

  const handleTxtExport = () => {
    projectActions.handleTxtExport(session, isDarkMode, setIsGoogleDriveOperationPending);
  };

  const handleFileUpload = () => {
    projectActions.handleFileUpload(isDarkMode, setIsGoogleDriveOperationPending);
  };

  const handleUploadFileSelect = (file: File) => {
    projectActions.selectUploadFile(file);
  };

  const handlePerformUpload = () => {
    projectActions.performFileUpload(session, init?.config?.settings.proselenos_root_folder_id || '', isDarkMode);
  };

  const handleCloseUploadModal = () => {
    projectActions.setShowUploadModal(false);
  };

  // Project modal handlers
  const handleProjectSelect = (folder: any) => {
    projectActions.selectProject(session, init?.config?.settings.proselenos_root_folder_id || '', folder, setIsGoogleDriveOperationPending, () => {
      // Clear selected manuscript when project changes (placeholder for AI tools phase)
    });
  };

  const handleProjectNavigation = (folderId: string) => {
    projectActions.navigateToFolder(session, init?.config?.settings.proselenos_root_folder_id || '', folderId, setIsGoogleDriveOperationPending);
  };

  // Create the very first project and wait for the async call to finish
  const handleCreateNewProject = async () => {
    await projectActions.createNewProject(
      session,
      init?.config?.settings.proselenos_root_folder_id || '',
      setIsGoogleDriveOperationPending,
      isDarkMode
      // , toolsActions
    );
    // Once the project exists and tools are loaded, turn off initialization
    setIsSystemInitializing(false);
  };

  const handleLoadFileIntoEditor = (content: string, fileName: string, fileId?: string) => {
    setEditorContent(content);
    setCurrentFileName(fileName);
    setCurrentFileId(fileId || null);
    setEditorMode(fileId ? 'existing' : 'new');
    setShowEditorModal(true);
  };

  // AI Tools handlers
  const handleCategoryChange = (category: string) => {
    toolsActions.setSelectedCategory(category);
    const filtered = toolsState.availableTools.filter(tool => tool.category === category);
    toolsActions.setToolsInCategory(filtered);
  };

  const handleSetupTool = () => {
    toolsActions.setupAITool(
      session,
      init?.config?.settings.proselenos_root_folder_id || '',
      projectState.currentProject,
      projectState.currentProjectId,
      setIsGoogleDriveOperationPending,
      isDarkMode
    );
  };

  const handleExecuteTool = () => {
    toolsActions.executeAITool(
      session,
      init?.config?.settings.proselenos_root_folder_id || '',
      projectState.currentProject,
      projectState.currentProjectId,
      currentProvider,
      currentModel,
      projectActions.setUploadStatus,
      isDarkMode
    );
  };

  // Non-AI Tools Select handler
  const handleNonAISetupTool = () => {
    nonAIToolsActions.setupNonAITool(
      session,
      projectState.currentProject,
      projectState.currentProjectId,
      setIsGoogleDriveOperationPending,
      isDarkMode
    );
  };

  const handleFileSelectorClose = () => {
    toolsActions.setShowFileSelector(false);
    toolsActions.setToolResult('');
  };

  const handleFileSelect = (file: any) => {
    toolsActions.setSelectedManuscriptForTool(file);
    toolsActions.setShowFileSelector(false);
  };

  // Non-AI Tools File Selector handlers
  const handleNonAIFileSelectorClose = () => {
    nonAIToolsActions.setShowFileSelector(false);
  };

  const handleNonAIFileSelect = (file: any) => {
    nonAIToolsActions.setSelectedManuscriptForTool(file);
    nonAIToolsActions.setShowFileSelector(false);
  };

  // Non-AI Tools action handlers
  const handleNonAIToolChange = (tool: string) => {
    nonAIToolsActions.setSelectedNonAITool(tool);
  };

  const handleNonAIClearTool = () => {
    nonAIToolsActions.clearTool();
  };

  const handleNonAIExecuteTool = () => {
    nonAIToolsActions.handleRun(
      session,
      isGoogleDriveOperationPending,
      toolsState.toolExecuting,
      projectState.currentProjectId,
      (type, message, isDarkMode) => showAlert(message, type, undefined, isDarkMode),
      isDarkMode
    );
  };

  // Project Settings Modal handlers
  const handleProjectSettingsClose = () => {
    setShowProjectSettingsModal(false);
    setProjectMetadata(undefined);
  };

  const handleProjectSettingsSave = async (metadata: ProjectMetadata) => {
    if (!projectState.currentProjectId) {
      showAlert('No project selected!', 'error', undefined, isDarkMode);
      return;
    }
    
    if (!session?.accessToken) {
      showAlert('Not authenticated!', 'error', undefined, isDarkMode);
      return;
    }

    setIsSavingMetadata(true);
    projectActions.setUploadStatus('Saving project settings...');

    try {
      const result = await saveProjectMetadataAction(session.accessToken, init?.config?.settings.proselenos_root_folder_id || '', projectState.currentProjectId, metadata);
      if (result.success) {
        setProjectMetadata(metadata);
        projectActions.setUploadStatus('✅ Project settings saved successfully');
        // Auto-close modal on successful save
        setShowProjectSettingsModal(false);
        setProjectMetadata(undefined);
      } else {
        projectActions.setUploadStatus(`❌ Failed to save project settings: ${result.error}`);
        showAlert(`Failed to save project settings: ${result.error}`, 'error', undefined, isDarkMode);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      projectActions.setUploadStatus(`❌ Error saving project settings: ${errorMessage}`);
      showAlert(`Error saving project settings: ${errorMessage}`, 'error', undefined, isDarkMode);
    } finally {
      setIsSavingMetadata(false);
    }
  };

  // Show welcome guide for new users
  const showWelcomeGuide = () => {
    Swal.fire({
      title: '🎉 Welcome to Proselenos!',
      html: `
        <div style="text-align: left; line-height: 1.6;">
          <div style="margin-bottom: 24px;">
            <p style="margin: 0 0 20px 0; color: ${isDarkMode ? '#9ca3af' : '#6b7280'}; font-size: 14px;">
              Let's get you set up with these 4 essential steps:
            </p>
            
            <!-- Step 1 -->
            <div style="display: flex; align-items: flex-start; margin-bottom: 16px;">
              <div style="
                background: #4285F4; 
                color: white; 
                width: 24px; 
                height: 24px; 
                border-radius: 50%; 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                font-size: 12px; 
                font-weight: 600; 
                margin-right: 12px; 
                flex-shrink: 0;
              ">1</div>
              <div style="flex: 1;">
                <div style="font-weight: 600; margin-bottom: 4px; color: ${isDarkMode ? '#fff' : '#111'};">
                  Create First Project
                </div>
                <div style="font-size: 13px; color: ${isDarkMode ? '#9ca3af' : '#6b7280'}; line-height: 1.4;">
                  Click "Select Project" button to create your first writing project folder
                </div>
              </div>
            </div>
            
            <!-- Step 2 -->
            <div style="display: flex; align-items: flex-start; margin-bottom: 16px;">
              <div style="
                background: #4285F4; 
                color: white; 
                width: 24px; 
                height: 24px; 
                border-radius: 50%; 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                font-size: 12px; 
                font-weight: 600; 
                margin-right: 12px; 
                flex-shrink: 0;
              ">2</div>
              <div style="flex: 1;">
                <div style="font-weight: 600; margin-bottom: 4px; color: ${isDarkMode ? '#fff' : '#111'};">
                  Add OpenRouter API Key
                </div>
                <div style="font-size: 13px; color: ${isDarkMode ? '#9ca3af' : '#6b7280'}; line-height: 1.4;">
                  Click the "AI API key" button in the header to add your <a href="https://openrouter.ai" target="_blank" style="color: #4285F4; text-decoration: none;">OpenRouter</a> API key
                </div>
              </div>
            </div>
            
            <!-- Step 3 -->
            <div style="display: flex; align-items: flex-start; margin-bottom: 16px;">
              <div style="
                background: #4285F4; 
                color: white; 
                width: 24px; 
                height: 24px; 
                border-radius: 50%; 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                font-size: 12px; 
                font-weight: 600; 
                margin-right: 12px; 
                flex-shrink: 0;
              ">3</div>
              <div style="flex: 1;">
                <div style="font-weight: 600; margin-bottom: 4px; color: ${isDarkMode ? '#fff' : '#111'};">
                  Choose AI Model
                </div>
                <div style="font-size: 13px; color: ${isDarkMode ? '#9ca3af' : '#6b7280'}; line-height: 1.4;">
                  Click "Models" button and select <strong>google/gemini-2.5-flash</strong> for fast, affordable editing
                </div>
              </div>
            </div>
            
            <!-- Step 4 -->
            <div style="display: flex; align-items: flex-start; margin-bottom: 20px;">
              <div style="
                background: #10b981; 
                color: white; 
                width: 24px; 
                height: 24px; 
                border-radius: 50%; 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                font-size: 12px; 
                font-weight: 600; 
                margin-right: 12px; 
                flex-shrink: 0;
              ">4</div>
              <div style="flex: 1;">
                <div style="font-weight: 600; margin-bottom: 4px; color: ${isDarkMode ? '#fff' : '#111'};">
                  Test with Chat
                </div>
                <div style="font-size: 13px; color: ${isDarkMode ? '#9ca3af' : '#6b7280'}; line-height: 1.4;">
                  Click the "Chat" button to verify your setup is working correctly
                </div>
              </div>
            </div>
            
            <!-- Pro Tip -->
            <div style="
              background: ${isDarkMode ? '#333' : '#f3f4f6'}; 
              padding: 12px; 
              border-radius: 8px; 
              border-left: 4px solid #10b981;
            ">
              <div style="font-weight: 600; margin-bottom: 4px; color: ${isDarkMode ? '#10b981' : '#059669'}; font-size: 13px;">
                💡 Tip
              </div>
              <div style="font-size: 12px; color: ${isDarkMode ? '#d1d5db' : '#4b5563'}; line-height: 1.4;">
                You can upload Word documents or text files to your projects for AI editing and analysis!
              </div>
              <div style="font-size: 12px; color: ${isDarkMode ? '#d1d5db' : '#4b5563'}; line-height: 1.3;">
                Just in case, these 4 steps are repeated on the About page!
              </div>
            </div>
          </div>
        </div>
      `,
      icon: 'success',
      background: isDarkMode ? '#222' : '#fff',
      color: isDarkMode ? '#fff' : '#333',
      confirmButtonText: "Let's Get Started!",
      confirmButtonColor: '#4285F4',
      width: 600,
      customClass: {
        popup: 'swal2-responsive'
      }
    });
  };

  if (status === 'loading') {
    return (
      <div style={{ 
        padding: '20px', 
        backgroundColor: theme.bg, 
        color: theme.text, 
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center' 
      }}>
        Loading Proselenos...
      </div>
    );
  }

  return (
    <div style={{ 
      backgroundColor: theme.bg, 
      color: theme.text, 
      minHeight: '100vh',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Header - Only show when logged in */}
      {session && (
        <ProselenosHeader
          session={session}
          theme={theme}
          isDarkMode={isDarkMode}
          currentProvider={currentProvider}
          currentModel={currentModel}
          hasConfiguredProvider={hasConfiguredProvider}
          hasApiKey={hasApiKey === true}
          isGoogleDriveOperationPending={isGoogleDriveOperationPending}
          toolExecuting={toolsState.toolExecuting}
          currentProject={projectState.currentProject}
          currentProjectId={projectState.currentProjectId}
          rootFolderId={init?.config?.settings.proselenos_root_folder_id || ''}
          isSystemInitializing={isSystemInitializing}
          onThemeToggle={toggleTheme}
          onModelsClick={handleModelsClick}
          onSettingsClick={handleOpenSettings}
          onEditorClick={openEditor}
          onAboutClick={handleOpenAbout}
          onSignOut={handleSignOut}
        />
      )}

{!session ? (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#0f0f0f',
        color: '#ffffff',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        {/* Header Bar */}
        <header style={{
          borderBottom: '1px solid #2a2a2a',
          padding: '0 24px',
          height: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#1a1a1a'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              fontWeight: 'bold'
            }}>
              <img 
                src="/icon.png" 
                alt="Proselenos Logo"
                style={{
                  width: '80px',
                  height: '96px',
                  objectFit: 'contain'
                }}
              />
            </div>
            <span style={{ fontSize: '18px', fontWeight: '600' }}>Proselenos</span>
          </div>
          
          <nav style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
            <a href="#features" style={{ color: '#a0a0a0', textDecoration: 'none', fontSize: '14px' }}>Features</a>
            <a href="#pricing" style={{ color: '#a0a0a0', textDecoration: 'none', fontSize: '14px' }}>Pricing</a>
            <button
              onClick={() => signIn('google')}
              style={{
                backgroundColor: '#4285f4',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3367d6'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#4285f4'}
            >
              Sign in with Google
            </button>
          </nav>
        </header>

        {/* Main Content */}
        <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '80px 24px' }}>
          {/* Hero Section */}
          <div style={{ textAlign: 'center', marginBottom: '80px' }}>
            <h1 style={{
              fontSize: '48px',
              fontWeight: '700',
              margin: '0 0 16px 0',
              background: 'linear-gradient(135deg, #ffffff 0%, #a0a0a0 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              lineHeight: '1.2'
            }}>
              Welcome to Proselenos
            </h1>
            <p style={{
              fontSize: '20px',
              color: '#a0a0a0',
              margin: '0 0 40px 0',
              maxWidth: '600px',
              marginLeft: 'auto',
              marginRight: 'auto'
            }}>
              Professional manuscript editing powered by AI
            </p>
          </div>

          {/* Description */}
          <div style={{
            backgroundColor: '#1a1a1a',
            borderRadius: '16px',
            padding: '40px',
            marginBottom: '60px',
            border: '1px solid #2a2a2a'
          }}>
            <p style={{
              fontSize: '16px',
              lineHeight: '1.7',
              color: '#e0e0e0',
              margin: 0,
              textAlign: 'left',
              maxWidth: '800px',
              marginLeft: 'auto',
              marginRight: 'auto'
            }}>
              Proselenos is a powerful manuscript-editing platform designed specifically for writers working 
              on full-length writing projects. Whether you're editing a novel, memoir, or non-fiction work, 
              Proselenos provides comprehensive tools to refine and polish your complete manuscript. 
              Upload your entire manuscript and get detailed editing assistance, structural analysis, and 
              formatting help to bring your work to professional publishing standards.
              <br />
              <blockquote>&nbsp;&nbsp;&nbsp; 🌖 <i>Like the moon, Proselenos reflects just enough light to make your prose shine.</i> ✨</blockquote>
            </p>
          </div>

          {/* Features Section */}
          <section id="features" style={{ marginBottom: '60px' }}>
            <h2 style={{
              fontSize: '32px',
              fontWeight: '600',
              textAlign: 'center',
              marginBottom: '40px',
              color: '#ffffff'
            }}>
              Key Features
            </h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '24px'
            }}>
              {[
                {
                  title: 'Secure storage',
                  description: 'Your manuscripts and settings are stored in your personal Google Drive and secured by Google.'
                },
                {
                  title: 'Full manuscript editing',
                  description: 'Including consistency checking and narrative flow optimisation.'
                },
                {
                  title: 'Advanced editing tools',
                  description: 'Grammar checking, style analysis, pacing optimisation, structural improvements, as well as your own customized AI prompts.'
                },
                {
                  title: 'Document management',
                  description: 'Import/Export Word .docx documents, to manage your flow with other writing applications.'
                },
                {
                  title: 'Project organisation',
                  description: 'Organise multiple manuscript projects with easy switching between writing projects.'
                },
                {
                  title: 'Publishing preparation',
                  description: 'Generate publication-ready EPUB and PDF files for digital and print publishing. Also, the included Editor is capable of reading aloud your manuscript.'
                }
              ].map((feature, index) => (
                <div key={index} style={{
                  backgroundColor: '#1a1a1a',
                  borderRadius: '12px',
                  padding: '24px',
                  border: '1px solid #2a2a2a',
                  transition: 'border-color 0.2s'
                }}>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    marginBottom: '12px',
                    color: '#ffffff'
                  }}>
                    {feature.title}:
                  </h3>
                  <p style={{
                    fontSize: '14px',
                    lineHeight: '1.6',
                    color: '#a0a0a0',
                    margin: 0
                  }}>
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Pricing Section */}
          <section id="pricing" style={{ marginBottom: '60px' }}>
            <h2 style={{
              fontSize: '32px',
              fontWeight: '600',
              textAlign: 'center',
              marginBottom: '40px',
              color: '#ffffff'
            }}>
              Pricing
            </h2>
            <div style={{
              backgroundColor: '#1a1a1a',
              borderRadius: '16px',
              padding: '40px',
              border: '1px solid #2a2a2a',
              textAlign: 'center',
              maxWidth: '500px',
              margin: '0 auto'
            }}>
              <h3 style={{
                fontSize: '24px',
                fontWeight: '600',
                marginBottom: '16px',
                color: '#4285f4'
              }}>
                Free
              </h3>
              <p style={{
                fontSize: '16px',
                color: '#e0e0e0',
                lineHeight: '1.6',
                margin: 0
              }}>
                Proselenos is free to use!
                <br /><br />
                OpenRouter charges for API key usage based on your AI model selection and usage.
              </p>
            </div>
          </section>

          {/* Privacy & Security Section */}
          <section style={{ marginBottom: '60px' }}>
            <h2 style={{
              fontSize: '32px',
              fontWeight: '600',
              textAlign: 'center',
              marginBottom: '40px',
              color: '#ffffff'
            }}>
              Privacy & Security
            </h2>
            <div style={{
              backgroundColor: '#1a1a1a',
              borderRadius: '16px',
              padding: '40px',
              border: '1px solid #2a2a2a'
            }}>
              <p style={{
                fontSize: '16px',
                lineHeight: '1.7',
                color: '#e0e0e0',
                marginBottom: '24px',
                textAlign: 'left'
              }}>
                Your manuscripts remain private and secure on your Google Drive, which is the only storage available for this app due to the costs of online hosting.
                <br /><br />
                Proselenos requests only the Google permissions necessary to function:
              </p>
              <div style={{ marginBottom: '24px' }}>
                <p style={{
                  fontSize: '14px',
                  color: '#a0a0a0',
                  margin: '0 0 8px 0',
                  fontFamily: 'monospace',
                  backgroundColor: '#0f0f0f',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #2a2a2a'
                }}>
                  openid, email, profile
                </p>
                <p style={{
                  fontSize: '14px',
                  color: '#e0e0e0',
                  margin: '8px 0 0 0'
                }}>
                  - used to authenticate you and display your basic account information
                </p>
              </div>
              <div style={{ marginBottom: '24px' }}>
                <p style={{
                  fontSize: '14px',
                  color: '#a0a0a0',
                  margin: '0 0 8px 0',
                  fontFamily: 'monospace',
                  backgroundColor: '#0f0f0f',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #2a2a2a'
                }}>
                  https://www.googleapis.com/auth/drive.file
                </p>
                <p style={{
                  fontSize: '14px',
                  color: '#e0e0e0',
                  margin: '8px 0 0 0'
                }}>
                  - allows the app to create, read, and update files in the dedicated <b>proselenos_projects</b> folder in your Google Drive
                  <br /><br />
                  <b><i>All other folders and files created by you on Google Drive, can not be accessed by this app!</i></b>
                </p>
              </div>
              <p style={{
                fontSize: '14px',
                lineHeight: '1.6',
                color: '#a0a0a0',
                margin: 0,
                textAlign: 'center'
              }}>
                You can <a href="https://myaccount.google.com/permissions" style={{ color: '#4299e1' }}>revoke these permissions</a> at any time through your Google Account settings.
                <br /><br />
                For more information, see our
                <a href="/privacy.html" style={{ color: '#4299e1' }}> Privacy Policy</a> 
                &nbsp;and&nbsp;  
                <a href="/terms.html" style={{ color: '#4299e1' }}> Terms of Service</a>.
              </p>
            </div>
          </section>

          {/* Final CTA */}
          <div style={{ textAlign: 'center' }}>

            <a
              href="https://a.co/d/5feXsK0"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-xl px-4 py-2 text-sm font-medium shadow hover:opacity-90 focus:outline-none focus:ring"
              style={{ backgroundColor: '#794bc4', color: '#fff' }}
              aria-label="Proselenos book"
            >
              Proselenos the book
            </a>

            &nbsp;&nbsp;&nbsp;&nbsp;

            <button
              onClick={() => signIn('google')}
              style={{
                backgroundColor: '#4285f4',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                padding: '16px 32px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 4px 12px rgba(66, 133, 244, 0.3)'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#3367d6';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#4285f4';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              Sign in with Google
            </button>
          </div>
        </main>
      </div>

) : (

  <div style={{ padding: '16px 20px' }}>
    {/* Projects Section */}
    <ProjectSection
      currentProject={projectState.currentProject}
      uploadStatus={projectState.uploadStatus}
      isLoadingConfig={isLoadingConfig}
      isGoogleDriveOperationPending={isGoogleDriveOperationPending}
      toolExecuting={toolsState.toolExecuting}
      theme={theme}
      isDarkMode={isDarkMode}
      isSystemInitializing={isSystemInitializing}
      isDocxConverting={projectState.isConverting}
      isDocxDialogOpen={projectState.showDocxSelector || projectState.showFilenameDialog}
      isTxtConverting={projectState.isConvertingTxt}
      isTxtDialogOpen={projectState.showTxtSelector || projectState.showTxtFilenameDialog}
      onSelectProject={handleSelectProject}
      onProjectSettings={handleProjectSettings}
      onFileUpload={handleFileUpload}
      onDocxImport={handleDocxImport}
      onTxtExport={handleTxtExport}
    />

    {/* AI Tools Section */}
      <AIToolsSection
        session={session}
        selectedCategory={toolsState.selectedCategory}
        selectedTool={toolsState.selectedTool}
        toolsInCategory={toolsState.toolsInCategory}
        toolsReady={toolsState.toolsReady}
        isInstallingToolPrompts={isInstallingToolPrompts}
        selectedManuscriptForTool={toolsState.selectedManuscriptForTool}
        toolExecuting={toolsState.toolExecuting}
        toolResult={toolsState.toolResult}
        toolJustFinished={toolsState.toolJustFinished}
        savedReportFileName={toolsState.savedReportFileName}
        savedReportFileId={toolsState.savedReportFileId}
        elapsedTime={toolsState.elapsedTime}
        manuscriptContent={toolsState.manuscriptContent}
        currentProject={projectState.currentProject}
        currentProjectId={projectState.currentProjectId}
        isGoogleDriveOperationPending={isGoogleDriveOperationPending}
      rootFolderId={init?.config?.settings.proselenos_root_folder_id || ''}
      isSystemInitializing={isSystemInitializing}
      theme={theme}
      isDarkMode={isDarkMode}
      currentProvider={currentProvider}
      currentModel={currentModel}
      onCategoryChange={handleCategoryChange}
      onToolChange={toolsActions.setSelectedTool}
      onSetupTool={handleSetupTool}
      onClearTool={toolsActions.clearTool}
      onExecuteTool={handleExecuteTool}
      onLoadFileIntoEditor={handleLoadFileIntoEditor}
    />

    {/* Non-AI Tools Section */}
    <div style={{ marginBottom: '20px' }}>
      <NonAIToolsSection
        selectedNonAITool={nonAIToolsState.selectedNonAITool}
        selectedManuscriptForTool={nonAIToolsState.selectedManuscriptForTool}
        isPublishing={nonAIToolsState.isPublishing}
        publishResult={nonAIToolsState.publishResult}
        toolJustFinished={nonAIToolsState.toolJustFinished}
        currentProject={projectState.currentProject}
        currentProjectId={projectState.currentProjectId}
        rootFolderId={init?.config?.settings.proselenos_root_folder_id || ''}
        isGoogleDriveOperationPending={isGoogleDriveOperationPending}
        theme={theme}
        isDarkMode={isDarkMode}
        toolExecuting={toolsState.toolExecuting}
        session={session}
        onToolChange={handleNonAIToolChange}
        onSetupTool={handleNonAISetupTool}
        onClearTool={handleNonAIClearTool}
        onExecuteTool={handleNonAIExecuteTool}
        onShowAlert={(type, message, isDarkMode) => showAlert(message, type, undefined, isDarkMode)}
      />
    </div>
  </div>
)}



      {/* Settings Dialog */}
      <SettingsDialog
        isOpen={showSettingsDialog}
        onClose={() => setShowSettingsDialog(false)}
        onSave={handleSettingsSave}
        isDarkMode={isDarkMode}
        theme={theme}
        currentProvider={currentProvider}
      />

      {/* Models Dropdown */}
      <ModelsDropdown
        isOpen={showModelsDropdown}
        onClose={() => setShowModelsDropdown(false)}
        onSelectModel={handleModelSelect}
        isDarkMode={isDarkMode}
        theme={theme}
        currentModel={currentModel}
      />

      {/* Editor Modal */}
  <EditorModal
        isOpen={showEditorModal}
        theme={theme}
        isDarkMode={isDarkMode}
        currentProject={projectState.currentProject}
        currentProjectId={projectState.currentProjectId}
        currentFileName={currentFileName}
        currentFileId={currentFileId}
        editorMode={editorMode}
        editorContent={editorContent}
        onClose={() => setShowEditorModal(false)}
        onContentChange={setEditorContent}
        onSaveFile={handleEditorSaveFile}
        onBrowseFiles={handleEditorBrowseFiles}
      />

      {/* Editor TXT File Selector Modal */}
      <FileSelectorModal
        isOpen={showEditorFileSelector}
        theme={theme}
        isDarkMode={isDarkMode}
        fileSelectorFiles={editorFileSelectorFiles}
        selectedManuscriptForTool={null}
        onClose={handleEditorFileSelectorClose}
        onSelectFile={handleEditorFileSelect}
      />

      {/* Project Selector Modal */}
      <ProjectSelectorModal
        session={session}
        isOpen={projectState.showModal}
        theme={theme}
        isDarkMode={isDarkMode}
        currentProject={projectState.currentProject}
        rootFolderId={init?.config?.settings.proselenos_root_folder_id || ''}
        modalFiles={projectState.modalFiles}
        folderName={projectState.folderName}
        breadcrumbs={projectState.breadcrumbs}
        newProjectName={projectState.newProjectName}
        isProjectFilesBrowser={projectState.isProjectFilesBrowser}
        isGoogleDriveOperationPending={isGoogleDriveOperationPending}
        toolExecuting={toolsState.toolExecuting}
        onClose={projectActions.closeModal}
        onSelectProject={handleProjectSelect}
        onNavigateToFolder={handleProjectNavigation}
        onCreateNewProject={handleCreateNewProject}
        onNewProjectNameChange={projectActions.setNewProjectName}
        onLoadFileIntoEditor={handleLoadFileIntoEditor}
        onUploadStatusUpdate={projectActions.setUploadStatus}
      />

      {/* Import DOCX Modal */}
      <ImportDocxModal
        showDocxSelector={projectState.showDocxSelector}
        showFilenameDialog={projectState.showFilenameDialog}
        docxFiles={projectState.docxFiles}
        selectedDocxFile={projectState.selectedDocxFile}
        outputFileName={projectState.outputFileName}
        isConverting={projectState.isConverting}
        theme={theme}
        isDarkMode={isDarkMode}
        onSelectFile={projectActions.selectDocxFile}
        onCancelFileSelector={() => {
          projectActions.setShowDocxSelector(false);
          projectActions.setSelectedDocxFile(null);
        }}
        onFilenameChange={projectActions.setOutputFileName}
        onCancelFilename={() => {
          projectActions.setShowFilenameDialog(false);
          projectActions.setSelectedDocxFile(null);
          projectActions.setOutputFileName('');
        }}
        onConfirmConversion={() => projectActions.performDocxConversion(session, isDarkMode)}
      />

      {/* Export TXT Modal */}
      <ExportModal
        showTxtSelector={projectState.showTxtSelector}
        showTxtFilenameDialog={projectState.showTxtFilenameDialog}
        txtFiles={projectState.txtFiles}
        selectedTxtFile={projectState.selectedTxtFile}
        txtOutputFileName={projectState.txtOutputFileName}
        isConvertingTxt={projectState.isConvertingTxt}
        theme={theme}
        isDarkMode={isDarkMode}
        onSelectFile={projectActions.selectTxtFile}
        onCancelFileSelector={() => {
          projectActions.setShowTxtSelector(false);
          projectActions.setSelectedTxtFile(null);
        }}
        onFilenameChange={projectActions.setTxtOutputFileName}
        onCancelFilename={() => {
          projectActions.setShowTxtFilenameDialog(false);
          projectActions.setSelectedTxtFile(null);
          projectActions.setTxtOutputFileName('');
        }}
        onConfirmConversion={() => projectActions.performTxtConversion(session, isDarkMode)}
      />

      {/* Upload Modal */}
      <UploadModal
        isOpen={projectState.showUploadModal}
        theme={theme}
        isDarkMode={isDarkMode}
        currentProject={projectState.currentProject}
        selectedUploadFile={projectState.selectedUploadFile}
        isUploading={projectState.isUploading}
        onClose={handleCloseUploadModal}
        onFileSelect={handleUploadFileSelect}
        onUpload={handlePerformUpload}
      />

      {/* AI Tools File Selector Modal */}
      <FileSelectorModal
        isOpen={toolsState.showFileSelector}
        theme={theme}
        isDarkMode={isDarkMode}
        fileSelectorFiles={toolsState.fileSelectorFiles}
        selectedManuscriptForTool={toolsState.selectedManuscriptForTool}
        selectedTool={toolsState.selectedTool}
        onClose={handleFileSelectorClose}
        onSelectFile={handleFileSelect}
      />

      {/* Non-AI Tools File Selector Modal */}
      <FileSelectorModal
        isOpen={nonAIToolsState.showFileSelector}
        theme={theme}
        isDarkMode={isDarkMode}
        fileSelectorFiles={nonAIToolsState.fileSelectorFiles}
        selectedManuscriptForTool={nonAIToolsState.selectedManuscriptForTool}
        selectedTool={nonAIToolsState.selectedNonAITool}
        onClose={handleNonAIFileSelectorClose}
        onSelectFile={handleNonAIFileSelect}
      />

      {/* Project Settings Modal */}
      <ProjectSettingsModal
        isOpen={showProjectSettingsModal}
        theme={theme}
        isDarkMode={isDarkMode}
        currentProject={projectState.currentProject}
        currentProjectId={projectState.currentProjectId}
        isLoading={isLoadingMetadata}
        isSaving={isSavingMetadata}
        initialMetadata={projectMetadata}
        onClose={handleProjectSettingsClose}
        onSave={handleProjectSettingsSave}
      />

      {/* About Modal */}
      <AboutModal
        isOpen={showAboutModal}
        onClose={() => setShowAboutModal(false)}
        isDarkMode={isDarkMode}
        theme={theme}
      />
    </div>
  );
}
