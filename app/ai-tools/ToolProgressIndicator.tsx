// app/ai-tools/ToolProgressIndicator.tsx

'use client';

import { ThemeConfig } from '../shared/theme';

interface ToolProgressIndicatorProps {
  toolExecuting: boolean;
  elapsedTime: number;
  theme: ThemeConfig;
  toolResult?: string;
  onEditClick?: () => void;
}

export default function ToolProgressIndicator({
  toolExecuting,
  elapsedTime,
  theme,
  toolResult,
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
      
      {/* Edit button appears only when tool is finished and has results */}
      {!toolExecuting && elapsedTime > 0 && toolResult && (
        <div style={{ display: 'flex', gap: '4px' }}>

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
