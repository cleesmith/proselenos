// app/proselenos/proselenosHeader.tsx
// Header Component

'use client';

import { useState } from 'react';
import { ThemeConfig } from '../shared/theme';
import ChatButton from '@/components/ChatButton';
import ChatPopoutButton from '@/components/ChatPopoutButton';
import StyledSmallButton from '@/components/StyledSmallButton';

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
              className="ml-2"
              isDarkMode={isDarkMode}
              currentProject={currentProject}
              currentProjectId={currentProjectId}
              rootFolderId={rootFolderId}
              isSystemInitializing={isSystemInitializing}
            />
            <ChatPopoutButton
              className="ml-1"
              isDarkMode={isDarkMode}
              currentProject={currentProject}
              currentProjectId={currentProjectId}
              rootFolderId={rootFolderId}
            />

            <StyledSmallButton
              onClick={onModelsClick}
              disabled={isSystemInitializing || !currentProject}
              theme={theme}
            >
              Models
            </StyledSmallButton>
            <StyledSmallButton
              onClick={onSettingsClick}
              disabled={isSystemInitializing || isGoogleDriveOperationPending || !currentProject}
              theme={theme}
            >
              AI API key
            </StyledSmallButton>
            <StyledSmallButton
              onClick={() => {
                console.log('Editor button clicked:', { isGoogleDriveOperationPending, toolExecuting });
                onEditorClick();
              }}
              disabled={isSystemInitializing || isGoogleDriveOperationPending || toolExecuting || !currentProject}
              theme={theme}
            >
              Editor
            </StyledSmallButton>
            <StyledSmallButton onClick={onAboutClick} theme={theme}>About</StyledSmallButton>
            <StyledSmallButton onClick={handleLogoutClick} theme={theme}>Sign out</StyledSmallButton>
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
              Confirm Sign out
            </div>
            <div style={{
              fontSize: '14px',
              color: theme.text,
              marginBottom: '20px',
              textAlign: 'center'
            }}>
              Are you sure you want to Sign out?
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
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
