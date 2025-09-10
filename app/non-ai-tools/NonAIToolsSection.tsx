// Non-AI Tools Section Component
// Following the established AI Tools pattern with Select, Clear, Run buttons

'use client';

import { useState } from 'react';
import { ThemeConfig } from '../shared/theme';
import { NON_AI_TOOLS } from './useNonAITools';
import PublishingAssistantModal from '../publishing-assistant/PublishingAssistantModal';

interface NonAIToolsSectionProps {
  // Tool selection
  selectedNonAITool: string;
  
  // File selection
  selectedManuscriptForTool: any | null;
  
  // Execution state
  isPublishing: boolean;
  publishResult: string | null;
  toolJustFinished: boolean;
  
  // Project state
  currentProject: string | null;
  currentProjectId: string | null;
  rootFolderId: string;
  isGoogleDriveOperationPending: boolean;
  
  // Theme
  theme: ThemeConfig;
  isDarkMode: boolean;
  
  // Other state
  toolExecuting: boolean;
  
  // Session for publishing assistant
  session: any;
  
  // Callbacks
  onToolChange: (tool: string) => void;
  onSetupTool: () => void;
  onClearTool: () => void;
  onExecuteTool: () => void;
  onShowAlert: (type: 'success' | 'error', message: string, isDarkMode: boolean) => void;
}

export default function NonAIToolsSection({
  selectedNonAITool,
  selectedManuscriptForTool,
  isPublishing,
  publishResult,
  toolJustFinished,
  currentProject,
  currentProjectId,
  rootFolderId,
  isGoogleDriveOperationPending,
  theme,
  isDarkMode,
  toolExecuting,
  session,
  onToolChange,
  onSetupTool,
  onClearTool,
  onExecuteTool,
  onShowAlert
}: NonAIToolsSectionProps) {

  // Publishing Assistant state
  const [showPublishingAssistant, setShowPublishingAssistant] = useState(false);

  // Helper function to get appropriate file type label
  const getFileTypeLabel = (toolName: string): string => {
    if (toolName === 'DOCX: Extract Comments as Text') {
      return 'Selected DOCX file:';
    } else if (toolName === 'EPUB to TXT Converter') {
      return 'Selected EPUB:';
    } else {
      return 'Selected file:';
    }
  };

  const isSetupDisabled = isGoogleDriveOperationPending || toolExecuting || isPublishing || !currentProject || !selectedNonAITool;
  const isClearDisabled = (!selectedManuscriptForTool && !publishResult) || isPublishing;
  const isRunDisabled = !selectedManuscriptForTool || isPublishing || isGoogleDriveOperationPending || toolExecuting || toolJustFinished;

  return (
    <div style={{ 
      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
      border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
      borderRadius: '8px',
      padding: '12px'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start', 
        marginBottom: '6px' 
      }}>
        <h2 style={{ 
          fontSize: '16px', 
          fontWeight: 'bold', 
          color: theme.text,
          marginBottom: 0
        }}>
          Run a non-AI tool:
        </h2>
        <button 
          onClick={() => setShowPublishingAssistant(true)}
          disabled={!currentProject || isGoogleDriveOperationPending || toolExecuting || isPublishing}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '10px',
            padding: '2px 8px',
            height: '22px',
            lineHeight: 1,
            backgroundColor: (currentProject && !isGoogleDriveOperationPending && !toolExecuting && !isPublishing) ? '#6f42c1' : '#666',
            color: (currentProject && !isGoogleDriveOperationPending && !toolExecuting && !isPublishing) ? 'white' : '#999',
            border: 'none',
            borderRadius: '3px',
            cursor: (currentProject && !isGoogleDriveOperationPending && !toolExecuting && !isPublishing) ? 'pointer' : 'not-allowed'
          }}
        >
          <span style={{ fontSize: '10px' }}>📚</span>
          Publishing Assistant
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <select
          value={selectedNonAITool}
          onChange={(e) => onToolChange(e.target.value)}
          style={{
            flex: '1',
            maxWidth: '300px',
            padding: '4px 8px',
            backgroundColor: theme.inputBg,
            color: theme.text,
            border: `1px solid ${theme.border}`,
            borderRadius: '3px',
            fontSize: '11px',
            cursor: 'pointer'
          }}
        >
          <option value="">Select a tool first</option>
          {NON_AI_TOOLS.map(tool => (
            <option key={tool} value={tool}>{tool}</option>
          ))}
        </select>
        <button 
          disabled={isSetupDisabled}
          onClick={onSetupTool}
          style={{
            padding: '3px 10px',
            backgroundColor: isSetupDisabled ? '#666' : '#FFC107',
            color: isSetupDisabled ? '#999' : '#000',
            border: 'none',
            borderRadius: '3px',
            fontSize: '11px',
            fontWeight: 'bold',
            cursor: isSetupDisabled ? 'not-allowed' : 'pointer'
          }}
        >
          Select
        </button>

        <button 
          disabled={isClearDisabled}
          onClick={onClearTool}
          style={{
            padding: '3px 10px',
            backgroundColor: isClearDisabled ? '#666' : '#FFA500',
            color: isClearDisabled ? '#999' : '#000',
            border: 'none',
            borderRadius: '3px',
            fontSize: '11px',
            fontWeight: 'bold',
            cursor: isClearDisabled ? 'not-allowed' : 'pointer'
          }}
        >
          Clear
        </button>

        <button 
          disabled={isRunDisabled}
          onClick={onExecuteTool}
          style={{
            padding: '3px 10px',
            backgroundColor: isRunDisabled ? '#666' : '#28a745',
            color: isRunDisabled ? '#999' : '#fff',
            border: 'none',
            borderRadius: '3px',
            fontSize: '11px',
            fontWeight: 'bold',
            cursor: isRunDisabled ? 'not-allowed' : 'pointer'
          }}
        >
          {isPublishing ? 'Running...' : 'Run'}
        </button>

        {/* Elapsed time display - matching AI Tools pattern */}
        {isPublishing && (
          <div style={{
            fontSize: '11px',
            color: '#FFC107',
            fontStyle: 'italic'
          }}>
            Running...
          </div>
        )}
      </div>

      {/* Show selected manuscript info - matching AI Tools pattern */}
      {selectedManuscriptForTool && (
        <div style={{
          marginTop: '8px',
          padding: '6px 8px',
          backgroundColor: theme.statusBg,
          border: `1px solid ${theme.border}`,
          borderRadius: '3px',
          fontSize: '11px',
          color: theme.text,
          marginBottom: '8px'
        }}>
          <strong>{getFileTypeLabel(selectedNonAITool)}</strong> {selectedManuscriptForTool.name}
        </div>
      )}

      {/* Status/Result display */}
      {publishResult && (
        <div style={{
          fontSize: '11px',
          color: publishResult.startsWith('Error:') ? '#dc3545' : '#28a745',
          marginBottom: '8px',
          padding: '4px 8px',
          backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)',
          borderRadius: '3px',
          border: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`
        }}>
          {publishResult}
        </div>
      )}

      <div style={{ 
        fontSize: '11px', 
        color: '#FFC107',
        marginBottom: '10px',
        lineHeight: '1.3',
        maxWidth: '600px'
      }}>
      </div>
      
      {/* Publishing Assistant Modal */}
      {showPublishingAssistant && (
        <PublishingAssistantModal
          isOpen={showPublishingAssistant}
          onClose={() => setShowPublishingAssistant(false)}
          currentProject={currentProject}
          currentProjectId={currentProjectId}
          rootFolderId={rootFolderId}
          theme={theme}
          isDarkMode={isDarkMode}
          session={session}
        />
      )}
    </div>
  );
}