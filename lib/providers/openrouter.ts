// @ts-nocheck

// openrouter.ts - OpenRouter AI Provider
// Migrated from ~/proselenos/client-openrouter.js for Next.js web environment

import { OpenAI } from 'openai';

export interface AIConfig {
  model_name?: string;
  temperature?: number;
  apiKey?: string;
  [key: string]: any;
}

export interface StreamOptions {
  temperature?: number;
  includeMetaData?: boolean;
  [key: string]: any;
}

export interface ModelData {
  id: string;
  [key: string]: any;
}

/**
 * OpenRouter API Service
 * Handles interactions with OpenRouter API services using openai-node SDK
 */
export class AiApiService {
  public config: AIConfig;
  public client: OpenAI | null = null;
  public apiKeyMissing: boolean = true;
  public prompt: string | null = null;
  public user: string = "proselenos";
  public temp: number = 0.3; // 0.0 (conservative) to 2.0 (wild/crazy)

  constructor(config: AIConfig = {}) {
    this.config = {
      ...config,
    };

    // Initialize client immediately if API key is provided
    if (config.apiKey) {
      this.client = new OpenAI({ 
        apiKey: config.apiKey,
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
          'HTTP-Referer': 'https://www.slipthetrap.com/proselenos.html',
          'X-Title': 'Proselenos'
        }
      });
      this.apiKeyMissing = false;
    } else {
      console.error('OpenRouter API key not provided in config');
      this.apiKeyMissing = true;
    }
  }

  /**
   * Get list of available models from OpenRouter API
   * @returns Array of model objects with id and other properties
   */
  async getAvailableModels(): Promise<ModelData[]> {
    if (this.apiKeyMissing || !this.client) {
      return [];
    }

    try {
      const models = await this.client.models.list();
      const allModels = models.data || [];
      
      // Filter for chat-compatible models only and sort alphabetically
      return allModels
        .filter((model: ModelData) => this.isChatCompatible(model))
        .sort((a: ModelData, b: ModelData) => a.id.localeCompare(b.id));
    } catch (error: any) {
      console.error('OpenRouter models list error:', error.message);
      return [];
    }
  }

  /**
   * Check if an OpenRouter model is chat-compatible
   * @param model - Model object from OpenRouter API
   * @returns True if model supports chat completions
   */
  isChatCompatible(model: ModelData): boolean {
    const modelId = model.id || '';
    
    // OpenRouter provides chat-compatible models from various providers
    // Most models on OpenRouter support chat completions
    return !modelId.includes('embedding') && !modelId.includes('whisper');
  }

  /**
   * Verifies the OpenRouter API key and model access.
   */
  async verifyAiAPI(): Promise<boolean> {
    if (this.apiKeyMissing || !this.client) return false;
    try {
      const models = await this.client.models.list();
      
      // Check if we got a valid response with models
      if (models.data && models.data.length > 0) {
        console.log(`OpenRouter API verified successfully - ${models.data.length} models available`);
        return true;
      }
      
      console.error('OpenRouter API: No models available');
      this.apiKeyMissing = true; // Treat as API unavailable
      return false;
    } catch (err: any) {
      console.error('OpenRouter API verify error:', err.message);
      this.apiKeyMissing = true; // Treat API failures as unavailable
      return false;
    }
  }

  /**
   * Streams a response using OpenRouter Chat Completions API
   * @param prompt - The user prompt to send (will prepend manuscript)
   * @param onText - Callback to receive the response as it arrives
   * @param options - Optional configuration
   */
  async streamWithThinking(
    prompt: string, 
    onText: (text: string) => void, 
    options: StreamOptions = {}
  ): Promise<void> {

    if (!this.client || this.apiKeyMissing) {
      throw new Error('OpenRouter client not initialized - missing API key');
    }
    if (!this.prompt) {
      throw new Error('No manuscript loaded.');
    }
    // const fullInput = `=== MANUSCRIPT ===\n${this.prompt}\n=== END MANUSCRIPT ===\n\n=== INSTRUCTIONS ===\n${prompt}\n=== END INSTRUCTIONS ===`;
    let fullInput;

    if (this.prompt.trimStart().startsWith('=== MANUSCRIPT ===')) {
      // this.prompt already has manuscript markers
      fullInput = `${this.prompt}\n\n=== INSTRUCTIONS ===\n${prompt}\n=== END INSTRUCTIONS ===`;
    } else {
      // this.prompt needs manuscript markers added
      fullInput = `=== MANUSCRIPT ===\n${this.prompt}\n=== END MANUSCRIPT ===\n\n=== INSTRUCTIONS ===\n${prompt}\n=== END INSTRUCTIONS ===`;
    }

    try {
      console.time('streamWithThinking');

      // Create the stream response
      const response = await this.client.chat.completions.create({
        model: this.config.model_name!,
        messages: [
          {
            role: "system",
            content: "You are a very experienced creative fiction writer and editor."
          },
          {
            role: "user",
            content: fullInput
          }
        ],
        stream: true,
        temperature: options.temperature || this.temp,
        // @ts-ignore - reasoning is OpenRouter-specific extension
        reasoning: {
          effort: "high", // "high", "medium", or "low" (OpenAI-style)
          exclude: false, // set to true to exclude reasoning tokens from response
          enabled: true // inferred from `effort` or `max_tokens`
        }
      });
      
      // Type assertion to tell TypeScript this is iterable
      const stream = response as any;
      
      for await (const chunk of stream) {
        const content = chunk.choices?.[0]?.delta?.content || '';
        if (content) {
          onText(content);
        }
      }

      console.timeEnd('streamWithThinking');

      if (options.includeMetaData) {
        const metadata = '\n\n--- RESPONSE METADATA ---\n' + JSON.stringify({ model: this.config.model_name }, null, 2);
        onText(metadata);
      }
    } catch (err: any) {
      console.error('OpenRouter chat completions error:', err.message);
      throw err;
    }
  }

  /**
   * Count tokens in a text string using OpenRouter API (no extra dependencies).
   * @param text - Text to count tokens in
   * @returns Token count (returns -1 on error)
   */
  async countTokens(text: string): Promise<number> {
    try {
      if (!this.client || this.apiKeyMissing || !this.config.model_name) {
        throw new Error('OpenRouter client not initialized or model not set');
      }
      
      const response = await this.client.chat.completions.create({
        model: this.config.model_name,
        messages: [{ role: 'user', content: text }],
        max_tokens: 16, // minimal generation to save costs
        temperature: 0
      });
      return response.usage?.prompt_tokens || -1;
    } catch (error: any) {
      console.error('Token counting error:', error);
      return -1;
    }
  }
}

export default AiApiService;