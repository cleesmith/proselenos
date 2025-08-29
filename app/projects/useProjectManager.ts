// Project Manager Hook
// Extracted from app/page.tsx - handles all project-related state and operations

import { useState, useMemo, useCallback } from 'react';
import { showAlert } from '../shared/alerts';
import {
  listGoogleDriveFilesAction,
  createProjectFolderAction,
  selectProjectAction
} from '@/lib/google-drive-actions';
import { 
  listDocxFilesAction, 
  convertDocxToTxtAction, 
  listTxtFilesAction, 
  convertTxtToDocxAction 
} from '@/lib/docx-conversion-actions';
import { uploadFileToProjectAction } from '@/lib/google-drive-actions';

interface ProjectManagerState {
  // Project state
  currentProject: string | null;
  currentProjectId: string | null;
  uploadStatus: string;
  
  // Modal states
  showModal: boolean;
  showDocxSelector: boolean;
  showTxtSelector: boolean;
  showFilenameDialog: boolean;
  showTxtFilenameDialog: boolean;
  
  // Modal data
  modalFiles: any[];
  folderName: string;
  currentFolderId: string;
  breadcrumbs: any[];
  newProjectName: string;
  isProjectFilesBrowser: boolean;
  
  // DOCX conversion state
  docxFiles: any[];
  selectedDocxFile: any | null;
  outputFileName: string;
  isConverting: boolean;
  
  // TXT conversion state
  txtFiles: any[];
  selectedTxtFile: any | null;
  txtOutputFileName: string;
  isConvertingTxt: boolean;
  
  // Upload state
  showUploadModal: boolean;
  selectedUploadFile: File | null;
  isUploading: boolean;
}

interface ProjectManagerActions {
  // Status updates
  setUploadStatus: (status: string) => void;
  setCurrentProject: (project: string | null) => void;
  setCurrentProjectId: (id: string | null) => void;
  
  // Project operations
  openProjectSelector: (session: any, rootFolderId: string, isDarkMode: boolean) => Promise<void>;
  selectProject: (session: any, rootFolderId: string, folder: any, setIsGoogleDriveOperationPending: (loading: boolean) => void, clearSelectedManuscript: () => void) => Promise<void>;
  createNewProject: (session: any, rootFolderId: string, setIsGoogleDriveOperationPending: (loading: boolean) => void, isDarkMode: boolean, toolsActions?: any) => Promise<void>;
  browseProjectFiles: (session: any, rootFolderId: string, isDarkMode: boolean) => Promise<void>;
  
  // Modal controls
  closeModal: () => void;
  setNewProjectName: (name: string) => void;
  
  // Navigation
  navigateToFolder: (session: any, rootFolderId: string, folderId?: string, setIsGoogleDriveOperationPending?: (loading: boolean) => void) => Promise<void>;
  
  // DOCX import
  handleDocxImport: (session: any, isDarkMode: boolean, setIsGoogleDriveOperationPending: (loading: boolean) => void) => Promise<void>;
  selectDocxFile: (file: any) => void;
  performDocxConversion: (session: any, isDarkMode: boolean) => Promise<void>;
  
  // TXT export
  handleTxtExport: (session: any, isDarkMode: boolean, setIsGoogleDriveOperationPending: (loading: boolean) => void) => Promise<void>;
  selectTxtFile: (file: any) => void;
  performTxtConversion: (session: any, isDarkMode: boolean) => Promise<void>;
  
  // Modal state setters
  setShowFilenameDialog: (show: boolean) => void;
  setShowTxtFilenameDialog: (show: boolean) => void;
  setShowDocxSelector: (show: boolean) => void;
  setShowTxtSelector: (show: boolean) => void;
  setOutputFileName: (name: string) => void;
  setTxtOutputFileName: (name: string) => void;
  setSelectedDocxFile: (file: any | null) => void;
  setSelectedTxtFile: (file: any | null) => void;
  
  // Upload operations
  handleFileUpload: (isDarkMode: boolean, setIsGoogleDriveOperationPending: (loading: boolean) => void) => void;
  selectUploadFile: (file: File) => void;
  performFileUpload: (session: any, rootFolderId: string, isDarkMode: boolean) => Promise<void>;
  setShowUploadModal: (show: boolean) => void;
}

export function useProjectManager(): [ProjectManagerState, ProjectManagerActions] {
  // Project state
  const [currentProject, setCurrentProject] = useState<string | null>(null);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState('');
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [showDocxSelector, setShowDocxSelector] = useState(false);
  const [showTxtSelector, setShowTxtSelector] = useState(false);
  const [showFilenameDialog, setShowFilenameDialog] = useState(false);
  const [showTxtFilenameDialog, setShowTxtFilenameDialog] = useState(false);
  
  // Modal data
  const [modalFiles, setModalFiles] = useState<any[]>([]);
  const [folderName, setFolderName] = useState('Drive');
  const [currentFolderId, setCurrentFolderId] = useState('');
  const [breadcrumbs, setBreadcrumbs] = useState<any[]>([]);
  const [newProjectName, setNewProjectName] = useState('');
  const [isProjectFilesBrowser, setIsProjectFilesBrowser] = useState(false);
  
  // DOCX conversion state
  const [docxFiles, setDocxFiles] = useState<any[]>([]);
  const [selectedDocxFile, setSelectedDocxFile] = useState<any | null>(null);
  const [outputFileName, setOutputFileName] = useState('');
  const [isConverting, setIsConverting] = useState(false);
  
  // TXT conversion state
  const [txtFiles, setTxtFiles] = useState<any[]>([]);
  const [selectedTxtFile, setSelectedTxtFile] = useState<any | null>(null);
  const [txtOutputFileName, setTxtOutputFileName] = useState('');
  const [isConvertingTxt, setIsConvertingTxt] = useState(false);
  
  // Upload state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Navigate to folder
  const navigateToFolder = useCallback(async (session: any, rootFolderId: string, folderId?: string, setIsGoogleDriveOperationPending?: (loading: boolean) => void) => {
    if (!session || !rootFolderId) return;

    setUploadStatus('Loading files...');
    if (setIsGoogleDriveOperationPending) setIsGoogleDriveOperationPending(true);
    
    try {
      const result = await listGoogleDriveFilesAction(session.accessToken, rootFolderId, folderId);
      
      if (result.success) {
        setModalFiles(result.data?.files || []);
        setCurrentFolderId(result.data?.currentFolder.id);
        
        // Build breadcrumbs
        const newBreadcrumbs = [{ name: result.data?.rootFolder.name, id: result.data?.rootFolder.id }];
        if (result.data?.currentFolder.id !== result.data?.rootFolder.id) {
          newBreadcrumbs.push({ name: result.data?.currentFolder.name, id: result.data?.currentFolder.id });
        }
        setBreadcrumbs(newBreadcrumbs);
        setFolderName(result.data?.currentFolder.name);
        
        setUploadStatus(`Found ${result.data?.files?.length || 0} files`);
      } else {
        setUploadStatus(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      setUploadStatus(`❌ Error: ${error}`);
    } finally {
      if (setIsGoogleDriveOperationPending) setIsGoogleDriveOperationPending(false);
    }
  }, []);

  // Open project selector modal
  const openProjectSelector = useCallback(async (session: any, rootFolderId: string, isDarkMode: boolean) => {
    if (!session || !rootFolderId) {
      showAlert('You must sign in first!', 'error', undefined, isDarkMode);
      return;
    }

    setIsProjectFilesBrowser(false);
    setNewProjectName(''); // Clear any previous input
    await navigateToFolder(session, rootFolderId); // Start at root
    setShowModal(true);
  }, [navigateToFolder]);

  // Select project from modal (only folders/projects)
  const selectProject = useCallback(async (session: any, rootFolderId: string, folder: any, setIsGoogleDriveOperationPending: (loading: boolean) => void, clearSelectedManuscript: () => void) => {
    // Set the selected folder as the current project
    setCurrentProject(folder.name);
    setCurrentProjectId(folder.id);
    setShowModal(false);
    setUploadStatus(`Selecting project: ${folder.name}...`);
    setIsGoogleDriveOperationPending(true);
    
    // Clear selected manuscript when project changes
    clearSelectedManuscript();
    
    // Save to config
    try {
      const result = await selectProjectAction(session.accessToken, rootFolderId, folder.name, folder.id);
      
      if (result.success) {
        setUploadStatus(`✅ Writing project selected: ${folder.name}`);
      } else {
        setUploadStatus(`⚠️ Project selected locally but config save failed`);
      }
    } catch (error) {
      setUploadStatus(`⚠️ Project selected locally but config save failed`);
    } finally {
      setIsGoogleDriveOperationPending(false);
    }
  }, []);

  // Browse files within the current project folder
  const browseProjectFiles = useCallback(async (session: any, rootFolderId: string, isDarkMode: boolean) => {
    if (!session || !currentProjectId) {
      showAlert('Select a project first!', 'info', undefined, isDarkMode);
      return;
    }

    setIsProjectFilesBrowser(true);
    await navigateToFolder(session, rootFolderId, currentProjectId);
    setShowModal(true);
  }, [currentProjectId, navigateToFolder]);

  // Create new project folder
  const createNewProject = useCallback(async (session: any, rootFolderId: string, setIsGoogleDriveOperationPending: (loading: boolean) => void, isDarkMode: boolean, toolsActions?: any) => {
    if (!session || !newProjectName.trim()) {
      showAlert('Enter a project name!', 'error', undefined, isDarkMode);
      return;
    }

    setUploadStatus('Creating new project...');
    setIsGoogleDriveOperationPending(true);
    
    try {
      const result = await createProjectFolderAction(session.accessToken, rootFolderId, newProjectName.trim());
      
      if (result.success) {
        // Select the newly created project
        setCurrentProject(newProjectName.trim());
        setCurrentProjectId(result.data?.folderId);
        setNewProjectName('');
        setShowModal(false);
        setUploadStatus(`✅ Project created: ${newProjectName.trim()}`);
        
        // Load tools on first project creation if tools aren't ready yet
        if (toolsActions && !toolsActions.toolsReady) {
          setUploadStatus('Loading tools...');
          try {
            await toolsActions.loadToolsFromGoogleDrive(isDarkMode);
            setUploadStatus(`✅ Project and tools ready!`);
          } catch (toolError) {
            console.error('Tool loading failed:', toolError);
            setUploadStatus(`✅ Project created, but tool loading failed`);
          }
        }
      } else {
        setUploadStatus(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      setUploadStatus(`❌ Error: ${error}`);
    } finally {
      setIsGoogleDriveOperationPending(false);
    }
  }, [newProjectName]);

  // Handle DOCX import button click
  const handleDocxImport = async (session: any, isDarkMode: boolean, setIsGoogleDriveOperationPending: (loading: boolean) => void) => {
    if (!currentProject || !currentProjectId) {
      showAlert('Please select a project first.', 'warning', undefined, isDarkMode);
      return;
    }

    setIsGoogleDriveOperationPending(true);
    setUploadStatus('Loading DOCX files...');

    try {
      // Get DOCX files from current project
      const result = await listDocxFilesAction(session.accessToken, currentProjectId);

      if (result.success && result.data?.files) {
        if (result.data.files.length === 0) {
          showAlert('No DOCX files found in the current project. Please upload a DOCX file to your project folder first.', 'info', undefined, isDarkMode);
          return;
        }

        setDocxFiles(result.data.files);
        setShowDocxSelector(true);
        setUploadStatus(`Found ${result.data.files.length} DOCX files`);
      } else {
        showAlert(`Failed to load DOCX files: ${result.error}`, 'error', undefined, isDarkMode);
      }
    } catch (error) {
      showAlert(`Error loading DOCX files: ${error instanceof Error ? error.message : String(error)}`, 'error', undefined, isDarkMode);
    } finally {
      setIsGoogleDriveOperationPending(false);
    }
  };

  // Handle DOCX file selection
  const selectDocxFile = useCallback((file: any) => {
    setSelectedDocxFile(file);
    setShowDocxSelector(false);
    
    // Set default output filename based on DOCX filename
    const defaultName = file.name.replace(/\.docx$/i, '.txt');
    setOutputFileName(defaultName);
    setShowFilenameDialog(true);
  }, []);

  // Handle the DOCX conversion
  const performDocxConversion = async (session: any, isDarkMode: boolean) => {
    if (!selectedDocxFile || !outputFileName.trim() || !currentProjectId) {
      showAlert('Missing required information for conversion', 'error', undefined, isDarkMode);
      return;
    }

    setIsConverting(true);
    setShowFilenameDialog(false);
    setUploadStatus('Converting DOCX to TXT...');

    try {
      const result = await convertDocxToTxtAction(
        session.accessToken,
        selectedDocxFile.id,
        outputFileName.trim(),
        currentProjectId
      );

      if (result.success) {
        showAlert(
          `Conversion complete!\n\nOutput: ${result.data?.fileName}\nChapters found: ${result.data?.chapterCount}\nCharacters: ${result.data?.characterCount.toLocaleString()}`,
          'success',
          'DOCX Conversion Complete',
          isDarkMode
        );
        setUploadStatus(`✅ Conversion complete: ${result.data?.fileName}`);
      } else {
        showAlert(`Conversion failed: ${result.error}`, 'error', undefined, isDarkMode);
        setUploadStatus(`❌ Conversion failed: ${result.error}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      showAlert(`Conversion error: ${errorMsg}`, 'error', undefined, isDarkMode);
      setUploadStatus(`❌ Conversion error: ${errorMsg}`);
    } finally {
      setIsConverting(false);
      setSelectedDocxFile(null);
      setOutputFileName('');
    }
  };

  // Handle TXT export button click
  const handleTxtExport = async (session: any, isDarkMode: boolean, setIsGoogleDriveOperationPending: (loading: boolean) => void) => {
    if (!currentProject || !currentProjectId) {
      showAlert('Please select a project first.', 'warning', undefined, isDarkMode);
      return;
    }

    setIsGoogleDriveOperationPending(true);
    setUploadStatus('Loading TXT files...');

    try {
      // Get TXT files from current project
      const result = await listTxtFilesAction(session.accessToken, currentProjectId);

      if (result.success && result.data?.files) {
        if (result.data.files.length === 0) {
          showAlert('No TXT files found in the current project. Please add a TXT file to your project folder first.', 'info', undefined, isDarkMode);
          return;
        }

        setTxtFiles(result.data.files);
        setShowTxtSelector(true);
        setUploadStatus(`Found ${result.data.files.length} TXT files`);
      } else {
        showAlert(`Failed to load TXT files: ${result.error}`, 'error', undefined, isDarkMode);
      }
    } catch (error) {
      showAlert(`Error loading TXT files: ${error instanceof Error ? error.message : String(error)}`, 'error', undefined, isDarkMode);
    } finally {
      setIsGoogleDriveOperationPending(false);
    }
  };

  // Handle TXT file selection
  const selectTxtFile = useCallback((file: any) => {
    setSelectedTxtFile(file);
    setShowTxtSelector(false);
    
    // Set default output filename based on TXT filename
    const defaultName = file.name.replace(/\.txt$/i, '.docx');
    setTxtOutputFileName(defaultName);
    setShowTxtFilenameDialog(true);
  }, []);

  // Handle the TXT conversion
  const performTxtConversion = async (session: any, isDarkMode: boolean) => {
    if (!selectedTxtFile || !txtOutputFileName.trim() || !currentProjectId) {
      showAlert('Missing required information for conversion', 'error', undefined, isDarkMode);
      return;
    }

    setIsConvertingTxt(true);
    setShowTxtFilenameDialog(false);
    setUploadStatus('Converting TXT to DOCX...');

    try {
      const result = await convertTxtToDocxAction(
        session.accessToken,
        selectedTxtFile.id,
        txtOutputFileName.trim(),
        currentProjectId
      );

      if (result.success) {
        showAlert(
          `Conversion complete!\n\nOutput: ${result.data?.fileName}\nParagraphs formatted: ${result.data?.paragraphCount}\nChapters found: ${result.data?.chapterCount}\nCharacters: ${result.data?.characterCount.toLocaleString()}`,
          'success',
          'TXT to DOCX Conversion Complete',
          isDarkMode
        );
        setUploadStatus(`✅ Conversion complete: ${result.data?.fileName}`);
      } else {
        showAlert(`Conversion failed: ${result.error}`, 'error', undefined, isDarkMode);
        setUploadStatus(`❌ Conversion failed: ${result.error}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      showAlert(`Conversion error: ${errorMsg}`, 'error', undefined, isDarkMode);
      setUploadStatus(`❌ Conversion error: ${errorMsg}`);
    } finally {
      setIsConvertingTxt(false);
      setSelectedTxtFile(null);
      setTxtOutputFileName('');
    }
  };

  // Handle file upload button click
  const handleFileUpload = (isDarkMode: boolean, setIsGoogleDriveOperationPending: (loading: boolean) => void) => {
    if (!currentProject || !currentProjectId) {
      showAlert('Please select a project first.', 'warning', undefined, isDarkMode);
      return;
    }
    setShowUploadModal(true);
  };

  // Handle file selection for upload
  const selectUploadFile = useCallback((file: File) => {
    setSelectedUploadFile(file);
  }, []);

  // Perform the actual file upload
  const performFileUpload = useCallback(async (session: any, rootFolderId: string, isDarkMode: boolean) => {
    if (!selectedUploadFile || !currentProjectId) {
      showAlert('No file selected or no project selected', 'error', undefined, isDarkMode);
      return;
    }

    setIsUploading(true);
    setShowUploadModal(false);
    setUploadStatus(`Uploading ${selectedUploadFile.name}...`);

    try {
      const result = await uploadFileToProjectAction(session.accessToken, rootFolderId, selectedUploadFile, currentProjectId);
      
      if (result.success) {
        setUploadStatus(`✅ File uploaded: ${result.data?.fileName}`);
        showAlert(`File uploaded successfully: ${result.data?.fileName}`, 'success', undefined, isDarkMode);
      } else {
        setUploadStatus(`❌ Upload failed: ${result.error}`);
        showAlert(`Upload failed: ${result.error}`, 'error', undefined, isDarkMode);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      showAlert(`Upload error: ${errorMsg}`, 'error', undefined, isDarkMode);
      setUploadStatus(`❌ Upload error: ${errorMsg}`);
    } finally {
      setIsUploading(false);
      setSelectedUploadFile(null);
    }
  }, [selectedUploadFile, currentProjectId]);

  const closeModal = useCallback(() => setShowModal(false), []);

  const state: ProjectManagerState = {
    currentProject,
    currentProjectId,
    uploadStatus,
    showModal,
    showDocxSelector,
    showTxtSelector,
    showFilenameDialog,
    showTxtFilenameDialog,
    modalFiles,
    folderName,
    currentFolderId,
    breadcrumbs,
    newProjectName,
    isProjectFilesBrowser,
    docxFiles,
    selectedDocxFile,
    outputFileName,
    isConverting,
    txtFiles,
    selectedTxtFile,
    txtOutputFileName,
    isConvertingTxt,
    showUploadModal,
    selectedUploadFile,
    isUploading
  };

  const actions: ProjectManagerActions = useMemo(() => ({
    setUploadStatus,
    setCurrentProject,
    setCurrentProjectId,
    openProjectSelector,
    selectProject,
    createNewProject,
    browseProjectFiles,
    closeModal,
    setNewProjectName,
    navigateToFolder,
    handleDocxImport,
    selectDocxFile,
    performDocxConversion,
    handleTxtExport,
    selectTxtFile,
    performTxtConversion,
    setShowFilenameDialog,
    setShowTxtFilenameDialog,
    setShowDocxSelector,
    setShowTxtSelector,
    setOutputFileName,
    setTxtOutputFileName,
    setSelectedDocxFile,
    setSelectedTxtFile,
    handleFileUpload,
    selectUploadFile,
    performFileUpload,
    setShowUploadModal
  }), [
    openProjectSelector,
    selectProject,
    createNewProject,
    browseProjectFiles,
    closeModal,
    navigateToFolder,
    selectDocxFile,
    selectTxtFile,
    selectUploadFile,
    performFileUpload
  ]);

  return [state, actions];
}