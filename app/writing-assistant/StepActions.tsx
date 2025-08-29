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
  onClose
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
    </div>
  );
}