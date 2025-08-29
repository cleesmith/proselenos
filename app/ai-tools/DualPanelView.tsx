'use client';

import React from 'react';
import { ThemeConfig } from '../shared/theme';

interface DualPanelViewProps {
  isVisible: boolean;
  onClose: () => void;
  manuscriptContent: string;
  manuscriptName: string;
  aiReport: string;
  theme: ThemeConfig;
  isDarkMode: boolean;
}

export default function DualPanelView({
  isVisible,
  onClose,
  manuscriptContent,
  manuscriptName,
  aiReport,
  theme,
  isDarkMode
}: DualPanelViewProps) {
  
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 bg-gray-900" style={{ backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5' }}>
      {/* Header */}
      <div className="bg-gray-800 text-white p-4 border-b border-gray-700 flex justify-between items-center" style={{ 
        backgroundColor: theme.statusBg, 
        borderColor: theme.border,
        color: theme.text 
      }}>
        <h1 className="text-xl font-bold">manuscript</h1>
        <button 
          onClick={onClose}
          className="px-3 py-1 rounded"
          style={{ 
            backgroundColor: '#6c757d',
            color: '#fff',
            border: 'none',
            fontSize: '11px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          Close
        </button>
        <h1 className="text-xl font-bold">AI report</h1>
      </div>

      {/* Editor Container */}
      <div className="flex-1 flex overflow-hidden h-full">
        {/* Left Panel */}
        <div className="w-1/2 relative overflow-hidden" style={{ backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff' }}>
          <textarea
            value={manuscriptContent + '\n\n'}
            readOnly
            className="w-full h-full px-4 py-4 font-mono text-sm resize-none focus:outline-none"
            style={{
              backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff',
              color: isDarkMode ? '#4ade80' : '#166534',
              border: 'none',
              paddingBottom: '32px'
            }}
            placeholder={`Loading ${manuscriptName}...`}
            spellCheck={false}
          />
        </div>

        {/* Fixed Divider */}
        <div className="w-1" style={{ backgroundColor: theme.border }}></div>

        {/* Right Panel */}
        <div className="w-1/2 relative overflow-hidden" style={{ backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff' }}>
          <textarea
            value={aiReport + '\n\n'}
            readOnly
            className="w-full h-full px-4 py-4 font-mono text-sm resize-none focus:outline-none"
            style={{
              backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff',
              color: isDarkMode ? '#60a5fa' : '#1e40af',
              border: 'none',
              paddingBottom: '32px'
            }}
            placeholder="AI report will appear here..."
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
}