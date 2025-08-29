// app/ai-tools/ToolProgressIndicator.tsx

'use client';

import { ThemeConfig } from '../shared/theme';

interface ToolProgressIndicatorProps {
  toolExecuting: boolean;
  elapsedTime: number;
  theme: ThemeConfig;
  toolResult?: string;
  onViewClick?: () => void;
  onEditClick?: () => void;
}

export default function ToolProgressIndicator({
  toolExecuting,
  elapsedTime,
  theme,
  toolResult,
  onViewClick,
  onEditClick
}: ToolProgressIndicatorProps) {
  
  if (!toolExecuting && elapsedTime === 0) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{
        fontSize: '11px',
        color: theme.textMuted,
        marginLeft: '8px',
        fontFamily: 'monospace'
      }}>
        {Math.floor(elapsedTime / 60).toString().padStart(2, '0')}:{(elapsedTime % 60).toString().padStart(2, '0')}
      </span>
      
      {/* View and Edit buttons appear only when tool is finished and has results */}
      {!toolExecuting && elapsedTime > 0 && toolResult && (
        <div style={{ display: 'flex', gap: '4px' }}>

          {/* View button commented out
          {onViewClick && (
            <button
              onClick={onViewClick}
              style={{
                padding: '2px 8px',
                backgroundColor: '#007bff',
                color: '#fff',
                border: 'none',
                borderRadius: '3px',
                fontSize: '10px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              View
            </button>
          )}
          */}

          {onEditClick && (
            <button
              onClick={onEditClick}
              style={{
                padding: '2px 8px',
                backgroundColor: '#28a745',
                color: '#fff',
                border: 'none',
                borderRadius: '3px',
                fontSize: '10px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              View-Edit
            </button>
          )}
        </div>
      )}
    </div>
  );
}