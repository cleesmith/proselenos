// Progress Step Component
// Individual step display for publishing progress

'use client';

import { ProgressStepProps } from '@/lib/publishing-assistant/types';

export default function ProgressStep({ 
  step, 
  isActive, 
  theme,
  fileState,
  onAction
}: ProgressStepProps) {
  
  const getStatusColor = () => {
    switch (step.status) {
      case 'completed':
        return '#28a745';
      case 'active':
        return '#ffc107';
      case 'error':
        return '#dc3545';
      default:
        return '#6c757d';
    }
  };

  return (
    <div 
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px',
        marginBottom: '8px',
        backgroundColor: isActive 
          ? (theme.isDarkMode ? 'rgba(255, 193, 7, 0.1)' : 'rgba(255, 193, 7, 0.05)')
          : 'transparent',
        border: isActive 
          ? '1px solid rgba(255, 193, 7, 0.3)'
          : '1px solid transparent',
        borderRadius: '6px',
        transition: 'all 0.3s ease'
      }}
    >
      
      {/* Step Content */}
      <div style={{ flex: 1 }}>
        <div 
          style={{
            fontSize: '14px',
            fontWeight: 'bold',
            color: getStatusColor(),
            marginBottom: '2px'
          }}
        >
          {step.name}
        </div>
        <div 
          style={{
            fontSize: '12px',
            color: theme.textSecondary,
            marginBottom: step.message || step.error ? '4px' : '0'
          }}
        >
          {step.description}
        </div>
        
        {/* Status Message */}
        {step.message && (
          <div 
            style={{
              fontSize: '11px',
              color: getStatusColor(),
              fontStyle: 'italic'
            }}
          >
            {step.message}
          </div>
        )}
        
        {/* Error Message */}
        {step.error && (
          <div 
            style={{
              fontSize: '11px',
              color: '#dc3545',
              fontStyle: 'italic'
            }}
          >
            Error: {step.error}
          </div>
        )}
      </div>
      
      {/* Action Button */}
      {fileState && onAction && (
        <div style={{ marginLeft: 'auto' }}>
          {fileState.isProcessing ? (
            <div 
              style={{
                width: '16px',
                height: '16px',
                border: '2px solid transparent',
                borderTop: '2px solid #ffc107',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}
            />
          ) : (
            <button
              onClick={onAction}
              disabled={fileState.isProcessing}
              style={{
                padding: '6px 12px',
                backgroundColor: fileState.exists ? '#ffc107' : '#28a745',
                color: fileState.exists ? '#000' : 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '11px',
                cursor: fileState.isProcessing ? 'not-allowed' : 'pointer',
                fontWeight: 'bold',
                minWidth: '60px'
              }}
            >
              {fileState.exists ? 'Redo' : 'Create'}
            </button>
          )}
        </div>
      )}
      
      {/* Loading Spinner for Active Step (fallback for old batch mode) */}
      {step.status === 'active' && !fileState && (
        <div 
          style={{
            width: '16px',
            height: '16px',
            border: '2px solid transparent',
            borderTop: '2px solid #ffc107',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}
        />
      )}
      
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}