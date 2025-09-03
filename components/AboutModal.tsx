'use client';

import { ThemeConfig } from '../app/shared/theme';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  theme: ThemeConfig;
}

export default function AboutModal({
  isOpen,
  onClose,
  isDarkMode,
  theme
}: AboutModalProps) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        background: isDarkMode ? '#222' : '#fff',
        color: isDarkMode ? '#fff' : '#333',
        borderRadius: '12px',
        maxWidth: '800px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: `1px solid ${isDarkMode ? '#333' : '#e5e7eb'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '24px',
            fontWeight: '600'
          }}>
            About Proselenos
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              color: isDarkMode ? '#9ca3af' : '#6b7280',
              cursor: 'pointer',
              padding: '0',
              width: '30px',
              height: '30px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{
          padding: '24px',
          overflow: 'auto',
          flex: 1
        }}>
          {/* Welcome Guide Section */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{
              fontSize: '20px',
              fontWeight: '600',
              marginBottom: '16px',
              color: '#4285F4'
            }}>
              🎉 Getting Started
            </h3>
            <p style={{
              margin: '0 0 20px 0',
              color: isDarkMode ? '#9ca3af' : '#6b7280',
              fontSize: '14px'
            }}>
              Follow these 4 essential steps to set up Proselenos:
            </p>
            
            {/* Step 1: Add OpenRouter API Key */}
            <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{
                background: '#4285F4',
                color: 'white',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: '600',
                marginRight: '12px',
                flexShrink: 0
              }}>1</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                  Add OpenRouter API Key
                </div>
                <div style={{ fontSize: '13px', color: isDarkMode ? '#9ca3af' : '#6b7280', lineHeight: '1.4' }}>
                  Click the "AI API key" button in the header to add your <a href="https://openrouter.ai" target="_blank" style={{ color: '#4285F4', textDecoration: 'none' }}>OpenRouter</a> API key
                </div>
              </div>
            </div>
            
            {/* Step 2: Choose AI Model */}
            <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{
                background: '#4285F4',
                color: 'white',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: '600',
                marginRight: '12px',
                flexShrink: 0
              }}>2</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                  Choose AI Model
                </div>
                <div style={{ fontSize: '13px', color: isDarkMode ? '#9ca3af' : '#6b7280', lineHeight: '1.4' }}>
                  Click "Models" button and select <strong>google/gemini-2.5-flash</strong> for fast, affordable editing
                </div>
              </div>
            </div>
            
            {/* Step 3: Test with Chat */}
            <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{
                background: '#10b981',
                color: 'white',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: '600',
                marginRight: '12px',
                flexShrink: 0
              }}>3</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                  Test with Chat
                </div>
                <div style={{ fontSize: '13px', color: isDarkMode ? '#9ca3af' : '#6b7280', lineHeight: '1.4' }}>
                  Click the "Chat" button to verify your setup is working correctly
                </div>
              </div>
            </div>
            
            {/* Step 4: Create First Project */}
            <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div style={{
                background: '#4285F4',
                color: 'white',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: '600',
                marginRight: '12px',
                flexShrink: 0
              }}>4</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                  Create First Project
                </div>
                <div style={{ fontSize: '13px', color: isDarkMode ? '#9ca3af' : '#6b7280', lineHeight: '1.4' }}>
                  Click "Select Project" button to create your first writing project folder
                </div>
              </div>
            </div>
          </div>

          {/* How Projects Work */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              marginBottom: '12px',
              color: '#4285F4'
            }}>
              📁 How Projects Work
            </h3>
            <p style={{ fontSize: '14px', color: isDarkMode ? '#d1d5db' : '#374151', lineHeight: '1.6', marginBottom: '12px' }}>
              Projects are individual folders in your Google Drive that organize your writing work:
            </p>
            <ul style={{ fontSize: '14px', color: isDarkMode ? '#d1d5db' : '#374151', lineHeight: '1.6', paddingLeft: '20px' }}>
              <li style={{ marginBottom: '8px' }}>Each project is a separate folder in your <strong>proselenos_projects</strong> directory</li>
              <li style={{ marginBottom: '8px' }}>Upload manuscript files (.docx or .txt) to your project folder</li>
              <li style={{ marginBottom: '8px' }}>AI tools work on files within your selected project</li>
              <li style={{ marginBottom: '8px' }}>Keep different books, articles, or writing projects organized separately</li>
            </ul>
          </div>

          {/* Editing Manuscripts with AI */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              marginBottom: '12px',
              color: '#4285F4'
            }}>
              ✏️ Editing Manuscripts with AI
            </h3>
            <p style={{ fontSize: '14px', color: isDarkMode ? '#d1d5db' : '#374151', lineHeight: '1.6', marginBottom: '12px' }}>
              Proselenos offers powerful AI-powered editing tools:
            </p>
            <ul style={{ fontSize: '14px', color: isDarkMode ? '#d1d5db' : '#374151', lineHeight: '1.6', paddingLeft: '20px' }}>
              <li style={{ marginBottom: '8px' }}><strong>Grammar & Style:</strong> Fix grammar, improve sentence structure, enhance readability</li>
              <li style={{ marginBottom: '8px' }}><strong>Content Analysis:</strong> Character development, plot consistency, pacing feedback</li>
              <li style={{ marginBottom: '8px' }}><strong>Genre-Specific:</strong> Tools tailored for fiction, non-fiction, academic writing</li>
              <li style={{ marginBottom: '8px' }}><strong>Custom Tools:</strong> Specialized editing prompts for specific needs</li>
            </ul>
          </div>

          {/* Why OpenRouter */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              marginBottom: '12px',
              color: '#4285F4'
            }}>
              🤖 Why OpenRouter?
            </h3>
            <p style={{ fontSize: '14px', color: isDarkMode ? '#d1d5db' : '#374151', lineHeight: '1.6', marginBottom: '12px' }}>
              OpenRouter provides the best AI experience for writers:
            </p>
            <ul style={{ fontSize: '14px', color: isDarkMode ? '#d1d5db' : '#374151', lineHeight: '1.6', paddingLeft: '20px' }}>
              <li style={{ marginBottom: '8px' }}><strong>Model Variety:</strong> Access to GPT-4, Claude, Gemini, and more from one API</li>
              <li style={{ marginBottom: '8px' }}><strong>Competitive Pricing:</strong> Often cheaper than direct provider APIs</li>
              <li style={{ marginBottom: '8px' }}><strong>Reliability:</strong> Automatic fallbacks if one model is unavailable</li>
              <li style={{ marginBottom: '8px' }}><strong>Flexibility:</strong> Switch between models based on your specific editing needs</li>
            </ul>
          </div>

          {/* AI Writing Assistant */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              marginBottom: '12px',
              color: '#4285F4'
            }}>
              ✍️ AI Writing Assistant
            </h3>
            <p style={{ fontSize: '14px', color: isDarkMode ? '#d1d5db' : '#374151', lineHeight: '1.6', marginBottom: '12px' }}>
              Proselenos isn't just for editing - it's also a powerful writing companion:
            </p>
            <ul style={{ fontSize: '14px', color: isDarkMode ? '#d1d5db' : '#374151', lineHeight: '1.6', paddingLeft: '20px' }}>
              <li style={{ marginBottom: '8px' }}><strong>Draft Creation:</strong> Generate initial drafts, outlines, and story structures</li>
              <li style={{ marginBottom: '8px' }}><strong>Brainstorming:</strong> Develop characters, plot ideas, and world-building elements</li>
              <li style={{ marginBottom: '8px' }}><strong>Research Assistance:</strong> Get help with fact-checking and background research</li>
              <li style={{ marginBottom: '8px' }}><strong>Writer's Block:</strong> Overcome creative blocks with AI-generated suggestions</li>
            </ul>
          </div>

          {/* Publishing Assistant */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              marginBottom: '12px',
              color: '#4285F4'
            }}>
              📚 Publishing Assistant
            </h3>
            <p style={{ fontSize: '14px', color: isDarkMode ? '#d1d5db' : '#374151', lineHeight: '1.6', marginBottom: '12px' }}>
              Get your manuscript ready for Kindle Direct Publishing (KDP):
            </p>
            <ul style={{ fontSize: '14px', color: isDarkMode ? '#d1d5db' : '#374151', lineHeight: '1.6', paddingLeft: '20px' }}>
              <li style={{ marginBottom: '8px' }}><strong>Format Optimization:</strong> Prepare your manuscript for both ebook and paperback formats</li>
              <li style={{ marginBottom: '8px' }}><strong>Metadata Generation:</strong> Create compelling book descriptions, keywords, and categories</li>
              <li style={{ marginBottom: '8px' }}><strong>Quality Checks:</strong> Final proofreading and formatting validation</li>
              <li style={{ marginBottom: '8px' }}><strong>Publishing Guidance:</strong> Step-by-step assistance for KDP submission</li>
            </ul>
          </div>

          {/* Pro Tip */}
          <div style={{
            background: isDarkMode ? '#333' : '#f3f4f6',
            padding: '16px',
            borderRadius: '8px',
            borderLeft: '4px solid #10b981'
          }}>
            <div style={{ fontWeight: '600', marginBottom: '8px', color: isDarkMode ? '#10b981' : '#059669', fontSize: '14px' }}>
              💡 Pro Tip
            </div>
            <div style={{ fontSize: '13px', color: isDarkMode ? '#d1d5db' : '#4b5563', lineHeight: '1.5' }}>
              Start with uploading a chapter or section of your work to test different AI models and find the one that best matches your writing style and needs. You can upload Word documents (.docx) or text files (.txt) to get started!
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}