// components/SimpleChatModal.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  getChatProviderModelAction,
  getChatResponseAction,
  saveChatToBrainstormAction
} from '@/lib/chat-actions';
import type { ChatMessage } from '@/lib/chatInternal';
import { showAlert } from '@/app/shared/alerts';

interface SimpleChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode?: boolean;
  currentProject?: string | null;
  currentProjectId?: string | null;
  rootFolderId?: string;
}

export default function SimpleChatModal({ 
  isOpen, 
  onClose, 
  isDarkMode = false,
  currentProject,
  currentProjectId,
  rootFolderId
}: SimpleChatModalProps): React.JSX.Element | null {
  const [input, setInput] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [providerModel, setProviderModel] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setInput('');
      setMessages([]);
      setProviderModel('');
    } else {
      loadProviderModel();
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = (): void => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadProviderModel = async (): Promise<void> => {
    try {
      const result = await getChatProviderModelAction();
      setProviderModel(result.providerModel);
    } catch (error: unknown) {
      console.error('Failed to load provider/model:', error);
      setProviderModel('Provider not available');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    setInput(e.target.value);
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 150); // Max height ~6 lines
      textareaRef.current.style.height = newHeight + 'px';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    // Enter without Shift sends the message
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
    // Shift+Enter adds a newline (default behavior)
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    
    if (!input.trim() || isLoading) return;
    
    const userMessage: ChatMessage = { role: 'user', content: input.trim() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    
    setIsLoading(true);
    
    try {
      const response = await getChatResponseAction(updatedMessages);
      
      if (response.response) {
        const assistantMessage: ChatMessage = { 
          role: 'assistant', 
          content: response.response 
        };
        setMessages([...updatedMessages, assistantMessage]);
        
        if (response.providerModel) {
          setProviderModel(response.providerModel);
        }
      }
    } catch (error: unknown) {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to get response'}`
      };
      setMessages([...updatedMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveChat = async (): Promise<void> => {
    if (!currentProjectId || !rootFolderId) {
      showAlert('No project selected', 'error', undefined, isDarkMode);
      return;
    }
    
    if (messages.length === 0) {
      showAlert('No messages to save', 'warning', undefined, isDarkMode);
      return;
    }
    
    setIsSaving(true);
    
    try {
      const result = await saveChatToBrainstormAction(
        messages, 
        providerModel,
        currentProjectId,
        rootFolderId
      );
      
      if (result.success) {
        showAlert(result.message, 'success', undefined, isDarkMode);
        setMessages([]);
      } else {
        showAlert(`Failed to save: ${result.message}`, 'error', undefined, isDarkMode);
      }
    } catch (error: unknown) {
      showAlert(`Error saving chat: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error', undefined, isDarkMode);
    } finally {
      setIsSaving(false);
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
      backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff',
      zIndex: 2000,
      display: 'flex',
      flexDirection: 'column'
    }}>
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 0.4; }
            50% { opacity: 1; }
          }
        `}
      </style>
      
      {/* Header */}
      <div style={{
        backgroundColor: isDarkMode ? '#2d3748' : '#f7fafc',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: `1px solid ${isDarkMode ? '#4a5568' : '#e2e8f0'}`
      }}>
        <div>
          <h2 style={{
            fontSize: '14px',
            fontWeight: 'bold',
            color: isDarkMode ? '#ffffff' : '#1a202c',
            margin: 0
          }}>
            Project: {currentProject || 'None selected'}
          </h2>
          <div style={{ 
            fontSize: '11px', 
            color: isDarkMode ? '#a0aec0' : '#718096',
            marginTop: '2px'
          }}>
            {providerModel || 'Loading AI Provider & Model...'}
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={handleSaveChat}
            disabled={messages.length === 0 || isSaving}
            style={{
              padding: '3px 8px',
              backgroundColor: (messages.length === 0 || isSaving) ? '#666' : '#28a745',
              color: (messages.length === 0 || isSaving) ? '#999' : '#fff',
              border: 'none',
              borderRadius: '3px',
              fontSize: '11px',
              cursor: (messages.length === 0 || isSaving) ? 'not-allowed' : 'pointer'
            }}
            type="button"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '3px 8px',
              backgroundColor: '#6c757d',
              color: '#fff',
              border: 'none',
              borderRadius: '3px',
              fontSize: '11px',
              cursor: 'pointer'
            }}
            type="button"
          >
            Close
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div style={{ 
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        maxWidth: '1200px',
        width: '100%',
        margin: '0 auto'
      }}>
        {messages.length === 0 && !isLoading && (
          <div style={{
            textAlign: 'center',
            padding: '32px 0',
            color: isDarkMode ? '#a0aec0' : '#718096'
          }}>
            <div style={{ fontSize: '18px', marginBottom: '8px' }}>Start a conversation</div>
            <div style={{ fontSize: '14px' }}>Type your message below to begin</div>
          </div>
        )}
        
        {messages.map((message: ChatMessage, index: number) => (
          <div
            key={index}
            style={{
              display: 'flex',
              justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: '12px'
            }}
          >
            <div
              style={{
                maxWidth: '70%',
                padding: '8px 12px',
                borderRadius: '8px',
                whiteSpace: 'pre-wrap',
                fontSize: '14px',
                lineHeight: '1.5',
                backgroundColor: message.role === 'user'
                  ? '#3182ce'
                  : isDarkMode 
                    ? '#4a5568'
                    : '#f7fafc',
                color: message.role === 'user'
                  ? '#ffffff'
                  : isDarkMode
                    ? '#e2e8f0'
                    : '#1a202c'
              }}
            >
              {message.content}
            </div>
          </div>
        ))}
        
        {/* Typing Indicator */}
        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: isDarkMode ? '#4a5568' : '#f7fafc'
            }}>
              <div style={{ display: 'flex', gap: '4px' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: isDarkMode ? '#a0aec0' : '#718096',
                  animation: 'pulse 1.5s infinite'
                }}></div>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: isDarkMode ? '#a0aec0' : '#718096',
                  animation: 'pulse 1.5s infinite',
                  animationDelay: '0.1s'
                }}></div>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: isDarkMode ? '#a0aec0' : '#718096',
                  animation: 'pulse 1.5s infinite',
                  animationDelay: '0.2s'
                }}></div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div style={{
        padding: '16px',
        borderTop: `1px solid ${isDarkMode ? '#4a5568' : '#e2e8f0'}`,
        backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto'
        }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
              rows={3}
              style={{
                flex: 1,
                padding: '8px 12px',
                border: `1px solid ${isDarkMode ? '#4a5568' : '#cbd5e0'}`,
                borderRadius: '6px',
                fontSize: '14px',
                backgroundColor: isDarkMode ? '#2d3748' : '#ffffff',
                color: isDarkMode ? '#ffffff' : '#1a202c',
                outline: 'none',
                resize: 'none',
                fontFamily: 'inherit',
                lineHeight: '1.5',
                minHeight: '72px', // Approximately 3 lines
                maxHeight: '150px',
                overflowY: 'auto'
              }}
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              style={{
                width: '36px',
                height: '36px',
                padding: '0',
                backgroundColor: (!input.trim() || isLoading) ? '#666' : '#3182ce',
                color: (!input.trim() || isLoading) ? '#999' : '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: (!input.trim() || isLoading) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
              title="Send message"
            >
              {/* Arrow Icon SVG */}
              <svg 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M22 2L11 13"></path>
                <path d="M22 2L15 22L11 13L2 9L22 2Z"></path>
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
