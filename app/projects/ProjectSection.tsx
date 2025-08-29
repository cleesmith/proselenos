// Project Section Component
// Extracted from app/page.tsx lines 985-1118

'use client';

import { ThemeConfig } from '../shared/theme';

interface ProjectSectionProps {
  currentProject: string | null;
  uploadStatus: string;
  isLoadingConfig: boolean;
  isGoogleDriveOperationPending: boolean;
  toolExecuting: boolean;
  theme: ThemeConfig;
  isDarkMode: boolean;
  isSystemInitializing: boolean;
  onSelectProject: () => void;
  onProjectSettings: () => void;
  onFileUpload: () => void;
  onDocxImport: () => void;
  onTxtExport: () => void;
}

export default function ProjectSection({
  currentProject,
  uploadStatus,
  isLoadingConfig,
  isGoogleDriveOperationPending,
  toolExecuting,
  theme,
  isDarkMode,
  isSystemInitializing,
  onSelectProject,
  onProjectSettings,
  onFileUpload,
  onDocxImport,
  onTxtExport
}: ProjectSectionProps) {
  return (
    <div style={{ 
      marginBottom: '12px',
      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
      border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
      borderRadius: '8px',
      padding: '12px'
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: '8px'
      }}>
        <h2 style={{ 
          fontSize: '16px', 
          fontWeight: 'bold', 
          color: theme.text,
          margin: '0'
        }}>
          Writing Project:
        </h2>
        
        <div style={{ 
          display: 'flex', 
          gap: '8px', 
          marginLeft: '20px',
          flex: '1',
          justifyContent: 'space-evenly'
        }}>
          <button 
            onClick={onSelectProject}
            disabled={isSystemInitializing || isGoogleDriveOperationPending || toolExecuting}
            style={{
              padding: '3px 8px',
              backgroundColor: isGoogleDriveOperationPending ? '#666' : '#dc3545',
              color: isGoogleDriveOperationPending ? '#999' : '#fff',
              border: 'none',
              borderRadius: '3px',
              fontSize: '11px',
              fontWeight: 'bold',
              cursor: isGoogleDriveOperationPending ? 'not-allowed' : 'pointer'
            }}
          >
            Select Project
          </button>
          
          <button 
            onClick={onProjectSettings}
            disabled={isSystemInitializing || isGoogleDriveOperationPending || toolExecuting}
            style={{
              padding: '3px 8px',
              backgroundColor: isGoogleDriveOperationPending ? '#666' : '#4285F4',
              color: isGoogleDriveOperationPending ? '#999' : '#fff',
              border: 'none',
              borderRadius: '3px',
              fontSize: '11px',
              cursor: isGoogleDriveOperationPending ? 'not-allowed' : 'pointer'
            }}>
            Project Settings
          </button>
          
          <button 
            onClick={onFileUpload}
            disabled={isSystemInitializing || isGoogleDriveOperationPending || toolExecuting || !currentProject}
            style={{
              padding: '3px 8px',
              backgroundColor: (isGoogleDriveOperationPending || !currentProject) ? '#666' : '#FF6B35',
              color: (isGoogleDriveOperationPending || !currentProject) ? '#999' : '#fff',
              border: 'none',
              borderRadius: '3px',
              fontSize: '11px',
              cursor: (isGoogleDriveOperationPending || !currentProject) ? 'not-allowed' : 'pointer'
            }}
          >
            UPLOAD
          </button>
          
          <button 
            onClick={onDocxImport}
            disabled={isSystemInitializing || isGoogleDriveOperationPending || toolExecuting || !currentProject}
            style={{
              padding: '3px 8px',
              backgroundColor: (isGoogleDriveOperationPending || !currentProject) ? '#666' : '#9C27B0',
              color: (isGoogleDriveOperationPending || !currentProject) ? '#999' : '#fff',
              border: 'none',
              borderRadius: '3px',
              fontSize: '11px',
              cursor: (isGoogleDriveOperationPending || !currentProject) ? 'not-allowed' : 'pointer'
            }}
          >
            IMPORT .docx
          </button>
          
          <button 
            onClick={onTxtExport}
            disabled={isSystemInitializing || isGoogleDriveOperationPending || toolExecuting || !currentProject}
            style={{
              padding: '3px 8px',
              backgroundColor: (isGoogleDriveOperationPending || !currentProject) ? '#666' : '#9C27B0',
              color: (isGoogleDriveOperationPending || !currentProject) ? '#999' : '#fff',
              border: 'none',
              borderRadius: '3px',
              fontSize: '11px',
              cursor: (isGoogleDriveOperationPending || !currentProject) ? 'not-allowed' : 'pointer'
            }}
          >
            EXPORT .docx
          </button>
        </div>
      </div>
      
      <div style={{ 
        fontSize: '20px', 
        fontWeight: 'bold', 
        color: theme.text,
        marginBottom: '6px' 
      }}>
        {currentProject || 'No Project Selected'}
      </div>

      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '4px', 
        marginBottom: '10px',
        fontSize: '12px',
        color: theme.textMuted
      }}>
        {isLoadingConfig ? (
          <span style={{ color: '#ff9500' }}>Standby, loading settings...</span>
        ) : (
          `My Drive › proselenos_projects › ${currentProject ? currentProject : '(none)'}`
        )}
      </div>

      {uploadStatus && (
        <div style={{
          marginTop: '8px',
          padding: '4px 8px',
          backgroundColor: theme.statusBg,
          border: `1px solid ${theme.border}`,
          borderRadius: '3px',
          fontSize: '10px',
          color: uploadStatus.includes('✅') ? '#0f0' : uploadStatus.includes('❌') ? '#f00' : theme.text
        }}>
          {uploadStatus}
        </div>
      )}
    </div>
  );
}