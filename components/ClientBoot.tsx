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
import { showAlert } from '../app/shared/alerts';
import {
  getproselenosConfigAction,
  validateCurrentProjectAction,
  installToolPromptsAction,
  updateProviderAndModelAction,
  updateSelectedModelAction,
  createGoogleDriveFileAction,
  updateGoogleDriveFileAction,
  loadProjectMetadataAction,
  saveProjectMetadataAction
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
  const [showProjectSettingsModal, setShowProjectSettingsModal] = useState(false);
  const [projectMetadata, setProjectMetadata] = useState<ProjectMetadata | undefined>(undefined);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);

  const theme = getTheme(isDarkMode);

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
  useEffect(() => {
    const checkToolPromptsStatus = async () => {
      if (!session?.accessToken || hasCheckedToolPrompts || !init) return;
      
      try {
        // Show initializing modal if no settings file (first-time setup)
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
        
        // Check if we need to install tool-prompts folder (without loading tools yet)
        if (Object.keys(init.toolsByCategory).length === 0) {
          // auto-install tool-prompts folder only
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
            const installResult = await installToolPromptsAction(session.accessToken as string, init.config?.settings.proselenos_root_folder_id || '');
            
            if (installResult.success) {
              setIsGoogleDriveReady(true);
              setIsGoogleDriveOperationPending(false);
              // Don't load tools yet - wait until first project is created
            } else {
              Swal.close();
              showAlert(`Tool-prompts install failed: ${installResult.message || installResult.error}`, 'error', undefined, isDarkMode);
              setIsGoogleDriveOperationPending(false);
            }
          } catch (error) {
            Swal.close();
            showAlert(`Tool-prompts install error: ${error instanceof Error ? error.message : String(error)}`, 'error', undefined, isDarkMode);
            setIsGoogleDriveOperationPending(false);
          } finally {
            setIsInstallingToolPrompts(false);
          }
        } else {
          // Tool-prompts already exist
          setIsGoogleDriveReady(true);
          setIsGoogleDriveOperationPending(false);
        }
      } catch (error) {
        console.error('Error checking tool-prompts installation:', error);
      } finally {
        setHasCheckedToolPrompts(true);
      }
    };

    // Start check after fast init completes
    if (init) {
      checkToolPromptsStatus();
    }
  }, [session, hasCheckedToolPrompts, isDarkMode, init, toolsActions]);

  // Helper function to get loading status
  const getLoadingStatus = () => {
    const checks = [
      { name: 'Google Drive', ready: isGoogleDriveReady },
      { name: 'AI Tools', ready: toolsState.toolsReady },
      { name: 'Authentication', ready: !!session?.accessToken },
      { name: 'API Configuration', ready: hasApiKey !== null },
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
    if (!session) return; // Don't run initialization logic without session
    if (isLoggingOut) return; // Skip initialization logic during logout
    
    const status = getLoadingStatus();

    if (status.allReady && !hasShownReadyModal) {
      Swal.close(); // Close initializing alert
      Swal.fire({
        title: 'Ready!',
        html: `All systems loaded successfully!<br><br>Loading... (${status.readyCount}/${status.totalCount}) - Complete!`,
        icon: 'success',
        background: isDarkMode ? '#222' : '#fff',
        color: isDarkMode ? '#fff' : '#333',
        confirmButtonColor: '#10b981',
        confirmButtonText: "Click to read, write, edit ... repeat",
        allowOutsideClick: false,
        allowEscapeKey: false
      }).then(() => {
        setHasShownReadyModal(true);
        setIsSystemInitializing(false); // Enable buttons
        
        // Show welcome guide only for new users
        const isNewUser = !projectState.currentProject && hasApiKey === false;
        if (isNewUser) {
          showWelcomeGuide();
        }
      });
    } else if (!status.allReady && isSystemInitializing) {
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
        }
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
    isDarkMode
  ]);

  // Check if API key exists for Models button visibility
  const checkApiKey = useCallback(async () => {
    if (!session?.accessToken || !currentProvider) return;
    
    try {
      const result = await hasApiKeyAction(currentProvider);
      if (result.success) {
        setHasApiKey(result.hasKey || false);
      }
    } catch (error) {
      console.error('Error checking API key:', error);
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
        const validateResult = await validateCurrentProjectAction(session.accessToken as string, init?.config?.settings.proselenos_root_folder_id || '');
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
      const result = await getproselenosConfigAction(session.accessToken as string, init?.config?.settings.proselenos_root_folder_id || '');
      
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
          const validateResult = await validateCurrentProjectAction(session.accessToken as string, init?.config?.settings.proselenos_root_folder_id || '');
          
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
    await projectActions.browseProjectFiles(session, init?.config?.settings.proselenos_root_folder_id || '', isDarkMode);
  };

  // Settings save handler (API key only)
  // const handleSettingsSave = async (provider: string) => {
  //   if (!session?.accessToken) {
  //     projectActions.setUploadStatus('❌ Not authenticated');
  //     return;
  //   }
    
  //   projectActions.setUploadStatus(`Saving API key for ${provider}...`);
    
  //   try {
  //     setCurrentProvider(provider);
  //     setHasConfiguredProvider(true);
  //     // Check API key status after save
  //     await checkApiKey();
  //     projectActions.setUploadStatus(`✅ API key saved for ${provider}`);
  //   } catch (error) {
  //     projectActions.setUploadStatus(`❌ Failed to save settings: ${error instanceof Error ? error.message : String(error)}`);
  //   }
  // };
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

  const handleCreateNewProject = () => {
    projectActions.createNewProject(session, init?.config?.settings.proselenos_root_folder_id || '', setIsGoogleDriveOperationPending, isDarkMode, toolsActions);
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

  // Non-AI Tools Setup handler
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
                  Add OpenRouter API Key
                </div>
                <div style="font-size: 13px; color: ${isDarkMode ? '#9ca3af' : '#6b7280'}; line-height: 1.4;">
                  Click the "AI API key" button in the header to add your <a href="https://openrouter.ai" target="_blank" style="color: #4285F4; text-decoration: none;">OpenRouter</a> API key
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
                  Create First Project
                </div>
                <div style="font-size: 13px; color: ${isDarkMode ? '#9ca3af' : '#6b7280'}; line-height: 1.4;">
                  Click "Select Project" button to create your first writing project folder
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
                💡 Pro Tip
              </div>
              <div style="font-size: 12px; color: ${isDarkMode ? '#d1d5db' : '#4b5563'}; line-height: 1.4;">
                You can upload Word documents, PDFs, or text files to your projects for AI editing and analysis!
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
          onSignOut={handleSignOut}
        />
      )}

      {!session ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '20px'
        }}>
          <div style={{
            maxWidth: '480px',
            width: '100%',
            textAlign: 'center'
          }}>
            {/* Logo and Title */}
            <div style={{ 
              marginBottom: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '20px'
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
              <div style={{ textAlign: 'left' }}>
                <h1 style={{ 
                  fontSize: '32px',
                  fontWeight: '600',
                  margin: '0 0 8px 0',
                  color: theme.text
                }}>
                  Welcome to Proselenos
                </h1>
                <p style={{ 
                  fontSize: '16px',
                  color: '#9ca3af',
                  margin: '0'
                }}>
                  Professional manuscript editing powered by AI
                </p>
              </div>
            </div>

            {/* How it Works Section */}
            <div style={{
              background: '#242424',
              border: '1px solid #333',
              borderRadius: '12px',
              padding: '24px',
              marginBottom: '32px',
              textAlign: 'left'
            }}>
              <div style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#9ca3af',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '20px',
                textAlign: 'center'
              }}>
                How it works
              </div>

              {/* Step 1 */}
              <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{
                  background: '#333',
                  color: '#4285F4',
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: '600',
                  marginRight: '12px',
                  flexShrink: 0
                }}>1</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#ffffff', marginBottom: '4px' }}>
                    Sign in with Google
                  </div>
                  <div style={{ fontSize: '13px', color: '#6b7280', lineHeight: '1.4' }}>
                    Quick and secure authentication using your Google account
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{
                  background: '#333',
                  color: '#4285F4',
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: '600',
                  marginRight: '12px',
                  flexShrink: 0
                }}>2</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#ffffff', marginBottom: '4px' }}>
                    Google Drive Integration
                  </div>
                  <div style={{ fontSize: '13px', color: '#6b7280', lineHeight: '1.4' }}>
                    We'll create a single "proselenos_projects" folder in your Drive to store your manuscripts and settings
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{
                  background: '#333',
                  color: '#4285F4',
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: '600',
                  marginRight: '12px',
                  flexShrink: 0
                }}>3</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#ffffff', marginBottom: '4px' }}>
                    Add Your OpenRouter API Key
                  </div>
                  <div style={{ fontSize: '13px', color: '#6b7280', lineHeight: '1.4' }}>
                    Use your OpenRouter API key to enable AI-powered editing features
                  </div>
                </div>
              </div>

              {/* Step 4 */}
              <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                <div style={{
                  background: '#333',
                  color: '#4285F4',
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: '600',
                  marginRight: '12px',
                  flexShrink: 0
                }}>4</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#ffffff', marginBottom: '4px' }}>
                    Start Editing
                    <span style={{
                      background: '#10b981',
                      color: 'white',
                      fontSize: '11px',
                      fontWeight: '600',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      marginLeft: '8px',
                      display: 'inline-block'
                    }}>FREE APP</span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#6b7280', lineHeight: '1.4' }}>
                    Proselenos is free to use. You only pay for AI model usage through OpenRouter
                  </div>
                </div>
              </div>
            </div>

            {/* Sign In Button */}
            <button 
              onClick={() => signIn('google')}
              style={{
                background: '#4285F4',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '14px 32px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#357ae8';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(66, 133, 244, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#4285F4';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#fff"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Sign in with Google
            </button>

            {/* Privacy Note */}
            <p style={{
              marginTop: '24px',
              fontSize: '12px',
              color: '#6b7280',
              lineHeight: '1.5'
            }}>
              Your manuscripts remain private and secure on your Google Drive.<br/>
              We only access the "proselenos_projects" folder.
            </p>
          </div>
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
    </div>
  );
}