'use client';

import { useState, useEffect } from 'react';
import { getAvailableModelsAction } from '@/lib/api-key-actions';

interface ModelsDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectModel: (model: string) => void;
  isDarkMode: boolean;
  theme: any;
  currentModel?: string;
}

export default function ModelsDropdown({
  isOpen,
  onClose,
  onSelectModel,
  isDarkMode,
  theme,
  currentModel = ''
}: ModelsDropdownProps) {
  const [loading, setLoading] = useState(false);
  const [allModels, setAllModels] = useState<string[]>([]);
  const [bigThreeModels, setBigThreeModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState(currentModel);
  const [error, setError] = useState<string | null>(null);
  const [showAllModels, setShowAllModels] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Load models when modal opens
  useEffect(() => {
    if (isOpen) {
      loadModels();
      setSelectedModel(currentModel);
      setSearchQuery(''); // Reset search when opening
      // Determine which view to show based on current model
      const isBigThreeModel = currentModel && 
        (currentModel.startsWith('anthropic/') || 
         currentModel.startsWith('google/') || 
         currentModel.startsWith('openai/'));
      setShowAllModels(!isBigThreeModel);
    }
  }, [isOpen, currentModel]);

  const loadModels = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getAvailableModelsAction();
      if (result.success && result.models) {
        // Store all models
        setAllModels(result.models);
        
        // Filter for big 3 providers
        const big3 = result.models.filter(model => 
          model.startsWith('anthropic/') ||
          model.startsWith('google/') ||
          model.startsWith('openai/')
        );
        setBigThreeModels(big3);
      } else {
        setError(result.error || 'Failed to load models');
        setAllModels([]);
        setBigThreeModels([]);
      }
    } catch (error) {
      console.error('Error loading models:', error);
      setError(error instanceof Error ? error.message : 'Failed to load models');
      setAllModels([]);
      setBigThreeModels([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectModel = () => {
    if (selectedModel && selectedModel !== currentModel) {
      onSelectModel(selectedModel);
    }
    onClose();
  };

  // Smart filter that handles multi-word searches like "openai 5"
  const filterModels = (models: string[]) => {
    if (!searchQuery.trim()) return models;
    
    // Split search query by spaces and filter for non-empty terms
    const searchTerms = searchQuery.toLowerCase().split(' ').filter(term => term.length > 0);
    
    return models.filter(model => {
      const modelLower = model.toLowerCase();
      // Model must contain ALL search terms (AND logic)
      return searchTerms.every(term => modelLower.includes(term));
    });
  };

  // Group models by provider for better display
  const groupModelsByProvider = (models: string[]) => {
    const grouped: { [provider: string]: string[] } = {};
    
    models.forEach(model => {
      const provider = model.split('/')[0];
      if (!grouped[provider]) {
        grouped[provider] = [];
      }
      grouped[provider].push(model);
    });
    
    return grouped;
  };

  const renderModelOptions = (models: string[], showGrouping = false) => {
    const filteredModels = filterModels(models);
    
    if (filteredModels.length === 0) {
      return (
        <option disabled value="">
          No models found matching "{searchQuery}"
        </option>
      );
    }

    if (!showGrouping) {
      return filteredModels.map(model => (
        <option key={model} value={model}>
          {model} {model === currentModel ? '(current)' : ''}
        </option>
      ));
    }

    const grouped = groupModelsByProvider(filteredModels);
    const providers = Object.keys(grouped).sort();
    
    return providers.map(provider => (
      <optgroup key={provider} label={provider.charAt(0).toUpperCase() + provider.slice(1)}>
        {grouped[provider].map(model => (
          <option key={model} value={model}>
            {model.replace(`${provider}/`, '')} {model === currentModel ? '(current)' : ''}
          </option>
        ))}
      </optgroup>
    ));
  };

  // Get filtered model count for display
  const getFilteredCount = () => {
    const models = showAllModels ? allModels : bigThreeModels;
    return filterModels(models).length;
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
        width: '550px',
        maxHeight: '90vh',
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
            Select AI Model
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
              onClick={handleSelectModel}
              disabled={loading || !selectedModel || selectedModel === currentModel}
              style={{
                padding: '6px 12px',
                backgroundColor: (loading || !selectedModel || selectedModel === currentModel) ? '#666' : '#007bff',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: (loading || !selectedModel || selectedModel === currentModel) ? 'not-allowed' : 'pointer'
              }}
            >
              Apply
            </button>
          </div>
        </div>

        {/* Content */}
        <div>
          {loading && (
            <div style={{
              textAlign: 'center',
              padding: '20px',
              color: theme.textSecondary
            }}>
              Loading models from OpenRouter...
            </div>
          )}

          {error && (
            <div style={{
              padding: '20px',
              backgroundColor: '#dc3545',
              color: '#fff',
              borderRadius: '4px',
              marginBottom: '20px',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          {!loading && !error && allModels.length > 0 && (
            <div>
              {/* Toggle between Popular and All Models */}
              <div style={{
                display: 'flex',
                gap: '12px',
                marginBottom: '16px'
              }}>
                <button
                  onClick={() => setShowAllModels(false)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    backgroundColor: !showAllModels ? '#28a745' : '#6c757d',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Popular Models ({bigThreeModels.length})
                </button>
                <button
                  onClick={() => setShowAllModels(true)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    backgroundColor: showAllModels ? '#28a745' : '#6c757d',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  All OpenRouter Models ({allModels.length})
                </button>
              </div>

              {/* Search Input */}
              <div style={{ marginBottom: '16px' }}>
                <input
                  type="text"
                  placeholder="Search models... (e.g., &quot;openai 5&quot; or &quot;claude&quot;)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    backgroundColor: theme.inputBg,
                    color: theme.text,
                    border: `1px solid ${theme.border}`,
                    borderRadius: '4px',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
                {searchQuery && (
                  <div style={{
                    marginTop: '6px',
                    fontSize: '12px',
                    color: theme.textSecondary
                  }}>
                    Found {getFilteredCount()} model{getFilteredCount() !== 1 ? 's' : ''} matching "{searchQuery}"
                  </div>
                )}
              </div>

              {/* Model Selection */}
              <div>
                <div style={{
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: theme.text,
                  marginBottom: '8px'
                }}>
                  {showAllModels ? 'All Available Models' : 'Popular Models (Anthropic, Google, OpenAI)'}
                </div>
                <div style={{
                  fontSize: '12px',
                  color: theme.textSecondary,
                  marginBottom: '12px'
                }}>
                  {showAllModels 
                    ? 'Browse all models available on OpenRouter'
                    : 'Quick access to the popular AI models'
                  }
                </div>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  size={10}
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: theme.inputBg,
                    color: theme.text,
                    border: `1px solid ${theme.border}`,
                    borderRadius: '4px',
                    fontSize: '13px',
                    cursor: 'pointer',
                    fontFamily: 'monospace'
                  }}
                >
                  {showAllModels 
                    ? renderModelOptions(allModels, false)
                    : renderModelOptions(bigThreeModels, true)
                  }
                </select>
                
                {/* Model count and info */}
                <div style={{
                  marginTop: '12px',
                  fontSize: '12px',
                  color: theme.textSecondary
                }}>
                  {!searchQuery && (
                    showAllModels 
                      ? `Showing all ${allModels.length} models from OpenRouter`
                      : `Showing ${bigThreeModels.length} models from Anthropic, Google, and OpenAI`
                  )}
                  {selectedModel && (
                    <div style={{
                      marginTop: '8px',
                      padding: '8px',
                      backgroundColor: theme.statusBg,
                      border: `1px solid ${theme.border}`,
                      borderRadius: '4px',
                      fontFamily: 'monospace',
                      fontSize: '12px'
                    }}>
                      Selected: <strong>{selectedModel}</strong>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {!loading && !error && allModels.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '20px',
              color: theme.textSecondary
            }}>
              No models available. Please check your API key in Settings.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}