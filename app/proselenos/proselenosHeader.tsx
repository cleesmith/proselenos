// Header Component

'use client';

import { ThemeConfig } from '../shared/theme';
import ChatButton from '@/components/ChatButton';

interface ProselenosHeaderProps {
  session: any;
  theme: ThemeConfig;
  isDarkMode: boolean;
  currentProvider: string;
  currentModel: string;
  hasConfiguredProvider: boolean;
  hasApiKey: boolean;
  isGoogleDriveOperationPending: boolean;
  toolExecuting: boolean;
  currentProject?: string | null;
  currentProjectId?: string | null;
  rootFolderId?: string;
  isSystemInitializing: boolean;
  onThemeToggle: () => void;
  onModelsClick: () => void;
  onSettingsClick: () => void;
  onEditorClick: () => void;
  onAboutClick: () => void;
  onSignOut: () => void;
}

export default function ProselenosHeader({
  session,
  theme,
  isDarkMode,
  currentProvider,
  currentModel,
  hasConfiguredProvider,
  hasApiKey,
  isGoogleDriveOperationPending,
  toolExecuting,
  currentProject,
  currentProjectId,
  rootFolderId,
  isSystemInitializing,
  onThemeToggle,
  onModelsClick,
  onSettingsClick,
  onEditorClick,
  onAboutClick,
  onSignOut
}: ProselenosHeaderProps) {
  return (
    <div style={{
      backgroundColor: theme.headerBg,
      padding: '8px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottom: `1px solid ${theme.border}`
    }}>
      {/* Left - Dark/Light Mode Toggle */}
      <button 
        onClick={onThemeToggle}
        title={isDarkMode ? 'go Light' : 'go Dark'}
        style={{
          background: 'none',
          border: 'none',
          color: '#4285F4',
          fontSize: '18px',
          cursor: 'pointer',
          padding: '4px'
        }}
      >
        {isDarkMode ? '☀️' : '🌙'}
      </button>

      {/* Center - Logo, Title, Model Info, Date */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '12px',
        flex: 1,
        marginLeft: '20px'
      }}>
        <img 
          src="icon.png" 
          alt="Proselenos Logo"
          title="Polish your manuscript with Proselenos"
          style={{
            width: '32px',
            height: '32px'
          }}
        />
        <div style={{ 
          fontSize: '18px', 
          fontWeight: 'bold', 
          color: theme.text 
        }}>
          Proselenos
        </div>
        {session && (
          <div 
            style={{ 
              fontSize: '10px', 
              color: '#4285F4',
              fontFamily: 'monospace',
              marginLeft: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            {hasConfiguredProvider ? (
              <>
                {currentProvider}:
                {currentModel}
              </>
            ) : (
              <button
                onClick={onSettingsClick}
                disabled={isSystemInitializing}
                style={{
                  background: isSystemInitializing ? '#666' : '#dc3545',
                  color: isSystemInitializing ? '#999' : 'white',
                  border: 'none',
                  borderRadius: '2px',
                  padding: '2px 6px',
                  fontSize: '9px',
                  cursor: isSystemInitializing ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold'
                }}
              >
                click AI API key button to set up
              </button>
            )}
          </div>
        )}
      </div>

      {/* Right - Action Buttons */}
      {session && (
        <div style={{ display: 'flex', gap: '6px' }}>
          {hasApiKey && (
            <>
              <ChatButton 
                isDarkMode={isDarkMode}
                currentProject={currentProject}
                currentProjectId={currentProjectId}
                rootFolderId={rootFolderId}
                isSystemInitializing={isSystemInitializing}
              />
              <button 
                onClick={onModelsClick}
              disabled={isSystemInitializing || isGoogleDriveOperationPending || toolExecuting}
              style={{
                padding: '3px 8px',
                backgroundColor: (isSystemInitializing || isGoogleDriveOperationPending) ? '#333' : '#007bff',
                color: (isSystemInitializing || isGoogleDriveOperationPending) ? '#999' : '#fff',
                border: 'none',
                borderRadius: '3px',
                fontSize: '11px',
                cursor: (isSystemInitializing || isGoogleDriveOperationPending) ? 'not-allowed' : 'pointer'
              }}>
              Models
            </button>
            </>
          )}
          <button 
            onClick={onSettingsClick}
            disabled={isSystemInitializing || isGoogleDriveOperationPending || toolExecuting}
            style={{
              padding: '3px 8px',
              backgroundColor: (isSystemInitializing || isGoogleDriveOperationPending) ? '#333' : '#555',
              color: (isSystemInitializing || isGoogleDriveOperationPending) ? '#999' : '#fff',
              border: 'none',
              borderRadius: '3px',
              fontSize: '11px',
              cursor: (isSystemInitializing || isGoogleDriveOperationPending) ? 'not-allowed' : 'pointer'
            }}>
            AI API key
          </button>
          <button 
            onClick={() => {
              console.log('Editor button clicked:', { isGoogleDriveOperationPending, toolExecuting });
              onEditorClick();
            }}
            disabled={isSystemInitializing || isGoogleDriveOperationPending || toolExecuting}
            style={{
              padding: '3px 8px',
              backgroundColor: (isSystemInitializing || isGoogleDriveOperationPending || toolExecuting) ? '#666' : '#4285F4',
              color: (isSystemInitializing || isGoogleDriveOperationPending || toolExecuting) ? '#999' : '#fff',
              border: 'none',
              borderRadius: '3px',
              fontSize: '11px',
              cursor: (isSystemInitializing || isGoogleDriveOperationPending || toolExecuting) ? 'not-allowed' : 'pointer'
            }}
          >
            Editor
          </button>
          <button 
            onClick={onAboutClick}
            disabled={isSystemInitializing}
            style={{
              padding: '3px 8px',
              backgroundColor: isSystemInitializing ? '#666' : '#6366f1',
              color: isSystemInitializing ? '#999' : '#fff',
              border: 'none',
              borderRadius: '3px',
              fontSize: '11px',
              cursor: isSystemInitializing ? 'not-allowed' : 'pointer'
            }}
          >
            About
          </button>
          <button 
            onClick={onSignOut}
            style={{
              padding: '3px 8px',
              backgroundColor: '#dc3545',
              color: '#fff',
              border: 'none',
              borderRadius: '3px',
              fontSize: '11px',
              cursor: 'pointer'
            }}
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}