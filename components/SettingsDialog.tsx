'use client';

import { useState, useEffect } from 'react';
import { storeApiKeyAction, removeApiKeyAction, getBatchSettingsDataAction } from '@/lib/api-key-actions';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (provider: string) => void;
  isDarkMode: boolean;
  theme: any;
  currentProvider?: string;
}

const PROVIDER_DISPLAY_NAMES = {
  'openrouter': 'OpenRouter'
};

export default function SettingsDialog({ 
  isOpen, 
  onClose, 
  onSave, 
  isDarkMode, 
  theme,
  currentProvider
}: SettingsDialogProps) {
  const [selectedProvider, setSelectedProvider] = useState(currentProvider);
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // Load API key settings (key status and actual decrypted key, but no models)
  const loadSettings = async () => {
    if (!selectedProvider) return;
    
    setLoading(true);
    try {
      const result = await getBatchSettingsDataAction(selectedProvider);
      if (result.success) {
        setHasKey(result.hasKey || false);
        setApiKey(result.apiKey || '');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load settings when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);


  const handleSave = async () => {
    if (!selectedProvider) {
      alert('No provider selected');
      return;
    }

    if (!apiKey.trim() && !hasKey) {
      alert('Please enter an API key');
      return;
    }

    setSaving(true);

    try {
      // Only store API key if one was entered
      if (apiKey.trim()) {
        const result = await storeApiKeyAction(selectedProvider, apiKey.trim());
        if (!result.success) {
          alert(`Failed to save API key: ${result.error}`);
          setSaving(false);
          return;
        }
      }

      // Call parent save handler with selected provider only
      onSave(selectedProvider);
      
      // Reset form
      setApiKey('');
      onClose();
    } catch (error) {
      alert(`Error saving settings: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveKey = async () => {
    if (!selectedProvider) {
      alert('No provider selected');
      return;
    }

    if (!hasKey) {
      alert('No API key configured for this provider');
      return;
    }

    if (!confirm(`Remove API key for ${PROVIDER_DISPLAY_NAMES[selectedProvider as keyof typeof PROVIDER_DISPLAY_NAMES]}?`)) {
      return;
    }

    try {
      const result = await removeApiKeyAction(selectedProvider);
      if (result.success) {
        await loadSettings(); // Refresh settings
        alert('API key removed successfully');
      } else {
        alert(`Failed to remove API key: ${result.error}`);
      }
    } catch (error) {
      alert(`Error removing API key: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  if (!isOpen) return null;


  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 4000
    }}>
      <div style={{
        backgroundColor: theme.modalBg,
        border: `2px solid ${theme.border}`,
        borderRadius: '8px',
        padding: '20px',
        width: '500px',
        maxHeight: '80vh',
        overflowY: 'auto'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          paddingBottom: '10px',
          borderBottom: `1px solid ${theme.border}`
        }}>
          <h2 style={{
            fontSize: '18px',
            fontWeight: 'bold',
            color: theme.text,
            margin: 0
          }}>
            AI API key
          </h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '6px 12px',
                backgroundColor: '#6c757d',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '6px 12px',
                backgroundColor: saving ? '#666' : '#007bff',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: saving ? 'not-allowed' : 'pointer'
              }}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        {/* Location */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            fontSize: '14px',
            fontWeight: 'bold',
            color: theme.text,
            marginBottom: '8px'
          }}>
            Location of Writing Projects:
          </div>
          <div style={{
            fontSize: '12px',
            color: theme.textSecondary,
            fontStyle: 'italic'
          }}>
            My Drive › storygrind_projects
          </div>
        </div>

        {/* AI Provider */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            fontSize: '14px',
            fontWeight: 'bold',
            color: theme.text,
            marginBottom: '8px'
          }}>
            AI Provider: OpenRouter
          </div>
        </div>

        {/* API Key */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            fontSize: '14px',
            fontWeight: 'bold',
            color: theme.text,
            marginBottom: '8px'
          }}>
            {PROVIDER_DISPLAY_NAMES[selectedProvider as keyof typeof PROVIDER_DISPLAY_NAMES]} API Key
          </div>
          <div style={{
            fontSize: '12px',
            color: theme.textSecondary,
            marginBottom: '6px'
          }}>
            Enter your {PROVIDER_DISPLAY_NAMES[selectedProvider as keyof typeof PROVIDER_DISPLAY_NAMES]} API key (will be encrypted and stored securely)
          </div>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              value={loading ? 'Loading...' : (showApiKey ? apiKey : (apiKey ? '•'.repeat(apiKey.length) : ''))}
              onChange={(e) => {
                if (!loading) {
                  setApiKey(e.target.value);
                }
              }}
              disabled={loading}
              placeholder={hasKey ? 'API key configured (enter new key to update)' : 'Enter API key...'}
              style={{
                width: '100%',
                padding: '8px 40px 8px 12px',
                backgroundColor: theme.inputBg,
                color: loading ? theme.textSecondary : theme.text,
                border: `1px solid ${theme.border}`,
                borderRadius: '4px',
                fontSize: '14px',
                boxSizing: 'border-box',
                fontFamily: showApiKey ? 'inherit' : 'monospace',
                cursor: loading ? 'wait' : 'text'
              }}
            />
            <button
              onClick={() => setShowApiKey(!showApiKey)}
              title={showApiKey ? "Hide API key" : "Show API key"}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: theme.textSecondary,
                cursor: 'pointer',
                fontSize: '14px',
                padding: '2px'
              }}
            >
              {showApiKey ? '🙈' : '👁️'}
            </button>
          </div>
        </div>


        {/* Language
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            fontSize: '14px',
            fontWeight: 'bold',
            color: theme.text,
            marginBottom: '8px'
          }}>
            Language
          </div>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              backgroundColor: theme.inputBg,
              color: theme.text,
              border: `1px solid ${theme.border}`,
              borderRadius: '4px',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            <option value="English (United States)">English (United States)</option>
            <option value="English (United Kingdom)">English (United Kingdom)</option>
            <option value="English (Canada)">English (Canada)</option>
            <option value="English (Australia)">English (Australia)</option>
          </select>
        </div>
         */}

      </div>
    </div>
  );
}