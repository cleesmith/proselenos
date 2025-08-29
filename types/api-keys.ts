// types/api-keys.ts
// Type definitions for API key management

export interface ApiKeyConfig {
  keyName: string;
  displayName: string;
  description: string;
  required: boolean;
  testEndpoint?: string;
}

export const SUPPORTED_API_KEYS: ApiKeyConfig[] = [
  {
    keyName: 'openrouter',
    displayName: 'OpenRouter',
    description: 'For access to multiple AI providers',
    required: false,
  },
];

export interface UserApiKeyStatus {
  keyName: string;
  isConfigured: boolean;
  isValid?: boolean;
  lastValidated?: string;
}

export interface AppSettings {
  preferredModel: string;
  maxTokens: number;
  temperature: number;
  autoSave: boolean;
  theme: 'light' | 'dark' | 'system';
}

export interface ApiKeyValidationResult {
  isValid: boolean;
  error?: string;
  provider: string;
}

export interface ApiKeyStoreResult {
  success: boolean;
  error?: string;
}

export interface ApiKeyRetrieveResult {
  success: boolean;
  apiKey?: string;
  error?: string;
}

export interface ToolExecutionResult {
  success: boolean;
  result?: string;
  error?: string;
}