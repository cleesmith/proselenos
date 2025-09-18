// components/ChatButton.tsx

"use client";

import React, { useState } from 'react';
import { showAlert } from '@/app/shared/alerts';
import SimpleChatModal from './SimpleChatModal';

// Complete interface definition
interface ChatButtonProps {
  className?: string;
  isDarkMode?: boolean;
  currentProject?: string | null;
  currentProjectId?: string | null;
  rootFolderId?: string;
  isSystemInitializing?: boolean;
}

export default function ChatButton({ 
  className = '', 
  isDarkMode = false,
  currentProject,
  currentProjectId,
  rootFolderId,
  isSystemInitializing = false
}: ChatButtonProps): React.JSX.Element {
  
  // Explicit state typing
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Event handler with explicit typing
  const handleClick = (): void => {
    if (!currentProject || !currentProjectId) {
      showAlert('Please select a project first', 'warning', undefined, isDarkMode);
      return;
    }
    setIsModalOpen(true);
  };

  const handleModalClose = (): void => {
    setIsModalOpen(false);
  };

  return (
    <>
      <button
        onClick={handleClick}
        disabled={isSystemInitializing || !currentProject}
        style={{
          padding: '3px 8px',
          backgroundColor: (isSystemInitializing || !currentProject) ? '#666' : '#9C27B0',
          color: (isSystemInitializing || !currentProject) ? '#999' : '#fff',
          border: 'none',
          borderRadius: '3px',
          fontSize: '11px',
          cursor: (isSystemInitializing || !currentProject) ? 'not-allowed' : 'pointer'
        }}
        type="button"
      >
        Chat
      </button>

      <SimpleChatModal 
        isOpen={isModalOpen}
        onClose={handleModalClose}
        isDarkMode={isDarkMode}
        currentProject={currentProject}
        currentProjectId={currentProjectId}
        rootFolderId={rootFolderId}
      />
    </>
  );
}
