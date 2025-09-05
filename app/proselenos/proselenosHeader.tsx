// Header Component

'use client';

import { useState } from 'react';
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

  const [showLogoutAlert, setShowLogoutAlert] = useState(false);

  const handleLogoutClick = () => {
    setShowLogoutAlert(true);
  };

  const handleConfirmLogout = () => {
    setShowLogoutAlert(false);
    onSignOut();
  };

  const handleCancelLogout = () => {
    setShowLogoutAlert(false);
  };

  return (
    <>
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
                <span title={`Provider: ${currentProvider}, Model: ${currentModel}`}>
                  {currentProvider}:{currentModel}
                </span>
              ) : (
                <span style={{ color: '#dc3545' }}>No AI provider</span>
              )}
            </div>
          )}
        </div>

        {/* Right - Control Buttons */}
        {session && (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <ChatButton 
              isDarkMode={isDarkMode}
              currentProject={currentProject}
              currentProjectId={currentProjectId}
              rootFolderId={rootFolderId}
              isSystemInitializing={isSystemInitializing}
            />
            <button 
              onClick={onModelsClick}
              disabled={isSystemInitializing}
              style={{
                padding: '3px 8px',
                backgroundColor: isSystemInitializing ? '#666' : '#28a745',
                color: isSystemInitializing ? '#999' : '#fff',
                border: 'none',
                borderRadius: '3px',
                fontSize: '11px',
                cursor: isSystemInitializing ? 'not-allowed' : 'pointer'
              }}
            >
              Models
            </button>
            <button 
              onClick={onSettingsClick}
              disabled={isSystemInitializing || isGoogleDriveOperationPending}
              style={{
                padding: '3px 8px',
                backgroundColor: (isSystemInitializing || isGoogleDriveOperationPending) ? 
                  '#333' : '#555',
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
              onClick={handleLogoutClick}
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

      {/* Custom Logout Confirmation Dialog */}
      {showLogoutAlert && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 5000
        }}>
          <div style={{
            backgroundColor: theme.modalBg,
            border: `2px solid ${theme.border}`,
            borderRadius: '8px',
            padding: '24px',
            minWidth: '320px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{
              fontSize: '16px',
              fontWeight: 'bold',
              color: theme.text,
              marginBottom: '16px',
              textAlign: 'center'
            }}>
              Confirm Logout
            </div>
            <div style={{
              fontSize: '14px',
              color: theme.text,
              marginBottom: '20px',
              textAlign: 'center'
            }}>
              Are you sure you want to log out?
            </div>
            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'center'
            }}>
              <button
                onClick={handleCancelLogout}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#6c757d',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmLogout}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#dc3545',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}