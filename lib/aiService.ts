// aiService.ts - AI Provider Factory
// Migrated from ~/storygrind/client.js for Next.js web environment

import { getApiKeyAction } from './api-key-actions';
import { getStoryGrindConfigAction } from './google-drive-actions';
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
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

/**
 * AUTOMATIC CACHE CLEANUP SYSTEM
 * 
 * This setInterval creates a background cleanup process that prevents memory leaks
 * in the AI service cache. Here's exactly what happens:
 * 
 * PROBLEM: Without cleanup, the serviceCache Map would grow forever as users
 * create AI service instances. Each user gets entries like "user123:openrouter:gpt-4"
 * and these would accumulate indefinitely, eventually crashing the server.
 * 
 * SOLUTION: Every hour, scan all cache entries and delete any that are
 * older than 3 hours based on their creation timestamp.
 * 
 * FOR ACTIVE USERS: If a user stays in the app for 3+ hours, their cache entry
 * gets deleted after exactly 3 hours, regardless of activity. The next AI request
 * will create a new service instance (adds ~100-500ms delay once), then they get
 * another 3 hours of fast cached responses.
 * 
 * TIMING STRATEGY:
 * - Cache entries expire after 3 hours (creation-based, not access-based)
 * - Cleanup runs every hour
 * - Expired entries persist for at most 1 hour after expiration
 * - This prevents both memory leaks and reduces cleanup overhead
 * 
 * TRADE-OFF: Active users experience one slight delay every 3 hours, but we
 * prevent unbounded memory growth in long-running server processes.
 */
setInterval(() => {
  const now = Date.now();
  const THREE_HOURS = 3 * 60 * 60 * 1000; // 3 hours in milliseconds
  for (const [key, entry] of serviceCache.entries()) {
    if (now - entry.created > THREE_HOURS) {
      serviceCache.delete(key);
    }
  }
}, 60 * 60 * 1000); // Run cleanup every hour


/**
 * Gets the current provider and model from stored config
 * @param accessToken - User's access token for authentication
 * @returns Object with provider and model, or throws error if not configured
 */
export async function getCurrentProviderAndModel(accessToken: string): Promise<{ provider: AIProvider; model: string }> {
  try {
    // Get the rootFolderId from the user's session/initialization data
    const init = await fastInitForUser(accessToken);
    const rootFolderId = init.config?.settings.storygrind_root_folder_id;
    
    if (!rootFolderId) {
      throw new Error('StoryGrind not initialized - missing root folder ID');
    }
    
    const result = await getStoryGrindConfigAction(accessToken, rootFolderId);
    if (!result.success || !result.data?.config) {
      throw new Error('Failed to load StoryGrind configuration');
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
