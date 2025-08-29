'use client';

import { WorkflowStepProps } from './types';
import StepActions from './StepActions';

export default function WorkflowStep({
  step,
  isActive,
  onExecute,
  onView,
  onRedo,
  onEditPrompt,
  isExecuting,
  isAnyStepExecuting,
  isLoadingPrompt,
  theme,
  onClose
}: WorkflowStepProps) {
  const getStepBorderColor = () => {
    switch (step.status) {
      case 'completed': return '#28a745';
      case 'executing': 
      case 'ready': return '#ffc107';
      case 'error': return '#dc3545';
      default: return '#6c757d';
    }
  };

  const getStepBackgroundColor = () => {
    switch (step.status) {
      case 'completed': return 'rgba(40, 167, 69, 0.1)';
      case 'executing':
      case 'ready': return 'rgba(255, 193, 7, 0.1)';
      case 'error': return 'rgba(220, 53, 69, 0.1)';
      default: return theme.surface || 'rgba(255, 255, 255, 0.05)';
    }
  };

  const getStepNumberColor = () => {
    switch (step.status) {
      case 'completed': return { bg: '#28a745', text: 'white' };
      case 'executing':
      case 'ready': return { bg: '#ffc107', text: 'black' };
      case 'error': return { bg: '#dc3545', text: 'white' };
      default: return { bg: '#6c757d', text: 'white' };
    }
  };

  const stepNumber = ['brainstorm', 'outline', 'world', 'chapters'].indexOf(step.id) + 1;
  const numberColors = getStepNumberColor();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '16px',
        backgroundColor: getStepBackgroundColor(),
        borderRadius: '6px',
        borderLeft: `4px solid ${getStepBorderColor()}`,
        border: `1px solid ${theme.border}`,
        marginBottom: '12px'
      }}
    >
      {/* Step Number */}
      <div
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          backgroundColor: numberColors.bg,
          color: numberColors.text,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '14px',
          fontWeight: 'bold',
          flexShrink: 0
        }}
      >
        {step.status === 'executing' ? '⏳' : stepNumber}
      </div>

      {/* Step Info */}
      <div style={{ flexGrow: 1 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '4px'
          }}
        >
          <span
            style={{
              fontWeight: 'bold',
              fontSize: '14px',
              color: theme.text
            }}
          >
            {step.name}
          </span>
          <button
            onClick={() => onEditPrompt(step.id)}
            disabled={isAnyStepExecuting || isLoadingPrompt}
            style={{
              padding: '2px 6px',
              backgroundColor: (!isAnyStepExecuting && !isLoadingPrompt) ? 'rgba(66, 133, 244, 0.1)' : 'rgba(102, 102, 102, 0.1)',
              color: (!isAnyStepExecuting && !isLoadingPrompt) ? '#4285F4' : '#666',
              border: `1px solid ${(!isAnyStepExecuting && !isLoadingPrompt) ? 'rgba(66, 133, 244, 0.3)' : 'rgba(102, 102, 102, 0.3)'}`,
              borderRadius: '2px',
              fontSize: '9px',
              cursor: (!isAnyStepExecuting && !isLoadingPrompt) ? 'pointer' : 'not-allowed',
              textTransform: 'none'
            }}
          >
            {isLoadingPrompt ? 'loading...' : 'edit prompt'}
          </button>
        </div>
        <div
          style={{
            fontSize: '12px',
            color: theme.textSecondary,
            lineHeight: '1.4'
          }}
        >
          {step.description}
        </div>
        {step.error && (
          <div
            style={{
              fontSize: '11px',
              color: '#dc3545',
              marginTop: '4px'
            }}
          >
            Error: {step.error}
          </div>
        )}
      </div>

      {/* Status Badge and Timer */}
      {step.status === 'executing' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '12px' }}>
          <span style={{
            fontSize: '11px',
            color: '#666',
          }}>
            Running...
          </span>
          <span style={{
            fontSize: '11px',
            color: theme.textMuted,
            fontFamily: 'monospace'
          }}>
            {Math.floor((step.elapsedTime || 0) / 60).toString().padStart(2, '0')}:{((step.elapsedTime || 0) % 60).toString().padStart(2, '0')}
          </span>
        </div>
      )}
      
      {/* Show file name button for completed steps */}
      {step.status === 'completed' && step.fileName && (
        <button
          onClick={() => onView(step.id)}
          disabled={isAnyStepExecuting}
          style={{
            fontSize: '11px',
            padding: '4px 8px',
            borderRadius: '3px',
            backgroundColor: isAnyStepExecuting ? '#666' : '#4285F4',
            color: isAnyStepExecuting ? '#999' : 'white',
            border: 'none',
            marginLeft: '12px',
            cursor: isAnyStepExecuting ? 'not-allowed' : 'pointer'
          }}
        >
          {step.fileName}
        </button>
      )}
      
      {/* Show failed badge for error status */}
      {step.status === 'error' && (
        <div
          style={{
            fontSize: '11px',
            padding: '4px 8px',
            borderRadius: '3px',
            backgroundColor: getStepBorderColor(),
            color: 'white',
            marginLeft: '12px'
          }}
        >
          Failed
        </div>
      )}

      {/* Actions */}
      <StepActions
        step={step}
        onExecute={() => onExecute(step.id)}
        onView={() => onView(step.id)}
        onRedo={() => onRedo(step.id)}
        isExecuting={isExecuting}
        isAnyStepExecuting={isAnyStepExecuting}
        theme={theme}
        onClose={onClose}
      />
    </div>
  );
}