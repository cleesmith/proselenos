// app/writing-assistant/StepActions.tsx

'use client';

import { StepActionsProps } from './types';

export default function StepActions({
  step,
  onExecute,
  onView,
  onRedo,
  isExecuting,
  isAnyStepExecuting,
  theme,
  onClose,
  onOpenChatForBrainstorm // Add this new prop
}: StepActionsProps) {
  
  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      {/* Run Button - Always visible */}
      <button
        onClick={onExecute}
        disabled={isExecuting || isAnyStepExecuting}
        style={{
          padding: '6px 16px',
          borderRadius: '4px',
          border: 'none',
          fontSize: '12px',
          fontWeight: '500',
          cursor: (isExecuting || isAnyStepExecuting) ? 'not-allowed' : 'pointer',
          backgroundColor: (isExecuting || isAnyStepExecuting) ? '#666' : '#28a745',
          color: (isExecuting || isAnyStepExecuting) ? '#999' : 'white',
          transition: 'background-color 0.2s'
        }}
      >
        {isExecuting ? 'Running...' : 'Run'}
      </button>

      {/* Chat Button - Only for brainstorm step */}
      {step.id === 'brainstorm' && onOpenChatForBrainstorm && (
        <button
          onClick={() => onOpenChatForBrainstorm(onClose)} // Pass onClose here
          disabled={isExecuting || isAnyStepExecuting}
          style={{
            padding: '6px 16px',
            borderRadius: '4px',
            border: 'none',
            fontSize: '12px',
            fontWeight: '500',
            cursor: (isExecuting || isAnyStepExecuting) ? 'not-allowed' : 'pointer',
            backgroundColor: (isExecuting || isAnyStepExecuting) ? '#666' : '#9C27B0',
            color: (isExecuting || isAnyStepExecuting) ? '#999' : 'white',
            transition: 'background-color 0.2s'
          }}
        >
          Chat
        </button>
      )}
    </div>
  );
}