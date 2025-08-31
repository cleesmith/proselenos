// lib/aiService.ts

// AI Provider Factory

import { getApiKeyAction } from './api-key-actions';
import { getproselenosConfigAction } from './google-drive-actions';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { fastInitForUser } from '@/app/lib/drive/fastInitServer';

export type AIProvider = 'openrouter' | 'skipped';

export interface AIServiceClass {
  new (config?: any): any;
}

// Per-user service cache to prevent multiple service creation
interface ServiceCacheEntry {
  service: any;
  provider: AIProvider;
  model: string;
  created: number;
}

const serviceCache = new Map<string, ServiceCacheEntry>();
// const CACHE_DURATION = 60 * 60 * 1000; // 1 hour
const CACHE_DURATION = 10 * 1000; // 10 seconds

// setInterval(() => {
//   const now = Date.now();
//   const THREE_HOURS = 3 * 60 * 60 * 1000; // 3 hours in milliseconds
//   for (const [key, entry] of serviceCache.entries()) {
//     if (now - entry.created > THREE_HOURS) {
//       serviceCache.delete(key);
//     }
//   }
// }, 60 * 60 * 1000); // Run cleanup every hour

function cleanupOldEntries() {
  const now = Date.now();
  // const THREE_HOURS = 3 * 60 * 60 * 1000;
  const THREE_HOURS = 10 * 1000;
  
  for (const [key, entry] of serviceCache.entries()) {
    if (now - entry.created > THREE_HOURS) {
      console.log(`Cleaning up old service cache entry: ${key}`);
      serviceCache.delete(key);
    }
  }
}

/**
 * Gets the current provider and model from stored config
 * @param accessToken - User's access token for authentication
 * @returns Object with provider and model, or throws error if not configured
 */
export async function getCurrentProviderAndModel(accessToken: string): Promise<{ provider: AIProvider; model: string }> {
  try {
    // Get the rootFolderId from the user's session/initialization data
    const init = await fastInitForUser(accessToken);
    const rootFolderId = init.config?.settings.proselenos_root_folder_id;
    
    if (!rootFolderId) {
      throw new Error('Proselenos not initialized - missing root folder ID');
    }
    
    const result = await getproselenosConfigAction(accessToken, rootFolderId);
    if (!result.success || !result.data?.config) {
      throw new Error('Failed to load Proselenos configuration');
    }
    
    const config = result.data.config;
    const provider = config.selectedApiProvider as AIProvider;
    const model = config.selectedAiModel;
    
    if (!provider) {
      throw new Error('No AI provider configured');
    }
    if (!model) {
      throw new Error('No AI model configured');
    }
    
    return { provider, model };
  } catch (error: any) {
    // Re-throw the error with more context
    throw new Error(`Failed to get provider and model: ${error.message}`);
  }
}

/**
 * Creates an AI service based on the selected provider (with per-user caching)
 * @param provider - The AI provider to use
 * @param modelName - The model name to use
 * @param userId - Optional user ID for caching (will try to get from session if not provided)
 * @returns The AI service instance or null if skipped
 */
export async function createApiService(provider: AIProvider = 'openrouter', modelName?: string, userId?: string): Promise<any | null> {
  // Clean up old entries on each new service creation
  cleanupOldEntries();

  try {
    if (provider === 'skipped') {
      console.log('AI setup was skipped by user');
      return null;
    }

    // Generate cache key - try to get userId from session if not provided
    let cacheUserId = userId;
    if (!cacheUserId) {
      try {
        const { getServerSession } = require('next-auth');
        const { authOptions } = require('./auth');
        const session = await getServerSession(authOptions);
        cacheUserId = session?.user?.id || 'anonymous';
      } catch {
        cacheUserId = 'anonymous';
      }
    }
    
    const cacheKey = `${cacheUserId}:${provider}:${modelName}`;
    
    // Check cache first
    const cached = serviceCache.get(cacheKey);
    if (cached && (Date.now() - cached.created < CACHE_DURATION)) {
      // console.log(`Using cached API service for ${provider}`);
      return cached.service;
    }

    // console.log(`Creating API service for provider: ${provider}`);

    // Get API key from encrypted storage
    const result = await getApiKeyAction(provider);
    if (!result.success || !result.apiKey) {
      throw new Error(`${provider} API key not found in encrypted storage`);
    }

    let ApiServiceClass: AIServiceClass;
    
    switch (provider) {
      case 'openrouter':
        const { AiApiService } = require('./providers/openrouter');
        ApiServiceClass = AiApiService;
        break;
      default:
        throw new Error(`Unknown AI provider: ${provider}`);
    }
    
    // Create instance with API key and model
    if (!modelName) {
      throw new Error(`Model name not provided for provider ${provider}`);
    }
    
    const service = new ApiServiceClass({ 
      apiKey: result.apiKey,
      model_name: modelName
    });

    // Cache the service
    serviceCache.set(cacheKey, {
      service,
      provider,
      model: modelName,
      created: Date.now()
    });

    return service;
    
  } catch (error) {
    console.error(`Error creating AI service for provider ${provider}:`, error);
    throw error;
  }
}

export default createApiService;
