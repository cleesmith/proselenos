// lib/api-key-actions.ts

'use server';

import { getServerSession } from 'next-auth/next';
import { google } from 'googleapis';
import { authOptions } from './auth';
import { InternalSecureStorage } from './secure-storage';
import { getModelsInternal } from './aiInternal';

interface ExtendedSession {
  user: {
    id: string;
    email?: string;
    name?: string;
    image?: string;
  };
  accessToken?: string;
}

// Server action for storing API key
export async function storeApiKeyAction(
  keyName: string, 
  apiKey: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession;
    if (!session || !session.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    if (!session.accessToken) {
      return { success: false, error: 'No access token available' };
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: session.accessToken,
    });
    
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const storage = new InternalSecureStorage(drive, session.user.id);
    
    const success = await storage.storeApiKey(keyName, apiKey);
    return { success };
  } catch (error) {
    console.error('Error in storeApiKeyAction:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Server action for getting API key
// @deprecated Use getBatchSettingsDataAction() instead for better performance
export async function getApiKeyAction(
  keyName: string
): Promise<{ success: boolean; apiKey?: string; error?: string }> {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession;
    if (!session || !session.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    if (!session.accessToken) {
      return { success: false, error: 'No access token available' };
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: session.accessToken,
    });
    
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const storage = new InternalSecureStorage(drive, session.user.id);
    
    const apiKey = await storage.getApiKey(keyName);
    return { success: true, apiKey: apiKey || undefined };
  } catch (error) {
    console.error('Error in getApiKeyAction:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Server action for removing API key
export async function removeApiKeyAction(
  keyName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession;
    if (!session || !session.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    if (!session.accessToken) {
      return { success: false, error: 'No access token available' };
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: session.accessToken,
    });
    
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const storage = new InternalSecureStorage(drive, session.user.id);
    
    const success = await storage.removeApiKey(keyName);
    return { success };
  } catch (error) {
    console.error('Error in removeApiKeyAction:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Server action for getting status of all API keys
// @deprecated Use getBatchSettingsDataAction() instead for better performance
export async function getAllApiKeysStatusAction(): Promise<{ 
  success: boolean; 
  statuses?: { [keyName: string]: boolean }; 
  error?: string 
}> {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession;
    if (!session || !session.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    if (!session.accessToken) {
      return { success: false, error: 'No access token available' };
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: session.accessToken,
    });
    
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const storage = new InternalSecureStorage(drive, session.user.id);
    
    const keyNames = ['openrouter', 'anthropic', 'openai', 'google-ai'];
    const statuses: { [keyName: string]: boolean } = {};
    
    for (const keyName of keyNames) {
      statuses[keyName] = await storage.hasApiKey(keyName);
    }
    
    return { success: true, statuses };
  } catch (error) {
    console.error('Error in getAllApiKeysStatusAction:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function getAvailableModelsAction(): Promise<{ 
  success: boolean; 
  models?: string[]; 
  error?: string 
}> {
  try {
    const models = await getModelsInternal();
    const modelIds = models.map(model => model.id);
    return { success: true, models: modelIds };
  } catch (error: any) {
    // Handle unconfigured provider gracefully - return empty array instead of error
    if (error.message === 'No AI provider configured' || 
        error.message === 'AI_PROVIDER_NOT_CONFIGURED' ||
        error.message === 'AI_MODEL_NOT_CONFIGURED') {
      console.log('AI provider not configured yet, returning empty models list');
      return { success: true, models: [] };
    }
    
    console.error('Error in getAvailableModelsAction:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch models'
    };
  }
}

// Lightweight function to check if API key exists (for Models button visibility)
export async function hasApiKeyAction(
  provider: string
): Promise<{ 
  success: boolean; 
  hasKey?: boolean;
  error?: string 
}> {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession;
    if (!session || !session.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    if (!session.accessToken) {
      return { success: false, error: 'No access token available' };
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: session.accessToken,
    });
    
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const storage = new InternalSecureStorage(drive, session.user.id);
    
    const batchData = await storage.getBatchData(provider);
    
    return { 
      success: true, 
      hasKey: batchData.hasKey
    };
  } catch (error) {
    console.error('Error in hasApiKeyAction:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Optimized batch function for Settings dialog performance  
// Combines API key status, current API key, and available models in single call
export async function getBatchSettingsDataAction(
  provider: string = 'openrouter'
): Promise<{ 
  success: boolean; 
  hasKey?: boolean;
  apiKey?: string; 
  models?: string[];
  error?: string 
}> {
  console.time('getBatchSettingsData-total');
  try {
    const session = await getServerSession(authOptions) as ExtendedSession;
    if (!session || !session.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }

    if (!session.accessToken) {
      return { success: false, error: 'No access token available' };
    }

    console.time('getBatchSettingsData-driveClient');
    // Single OAuth2 client and storage connection
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: session.accessToken,
    });
    
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const storage = new InternalSecureStorage(drive, session.user.id);
    console.timeEnd('getBatchSettingsData-driveClient');
    
    console.time('getBatchSettingsData-batchData');
    // Get all data with single config load
    const batchData = await storage.getBatchData(provider);
    console.timeEnd('getBatchSettingsData-batchData');
    const hasKey = batchData.hasKey;
    const apiKey = batchData.apiKey;
    
    // Get available models (handles provider not configured gracefully)
    let models: string[] = [];
    try {
      const modelsResult = await getModelsInternal();
      models = modelsResult.map(model => model.id);
    } catch (error: any) {
      // Handle unconfigured provider gracefully
      if (error.message === 'No AI provider configured' || 
          error.message === 'AI_PROVIDER_NOT_CONFIGURED' ||
          error.message === 'AI_MODEL_NOT_CONFIGURED') {
        console.log('AI provider not configured yet, returning empty models list');
        models = [];
      } else {
        // Re-throw other model loading errors
        throw error;
      }
    }
    
    console.timeEnd('getBatchSettingsData-total');
    return { 
      success: true, 
      hasKey,
      apiKey: apiKey || undefined,
      models
    };
  } catch (error) {
    console.timeEnd('getBatchSettingsData-total');
    console.error('Error in getBatchSettingsDataAction:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// New helper that avoids the expensive getModelsInternal() call
export async function getKeyAndStatusAction(
  provider: string = 'openrouter'
): Promise<{ success: boolean; hasKey?: boolean; apiKey?: string; error?: string }> {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession;
    if (!session?.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }
    if (!session.accessToken) {
      return { success: false, error: 'No access token available' };
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: session.accessToken });
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const storage = new InternalSecureStorage(drive, session.user.id);

    // getBatchData already loads and decrypts the config once
    const { hasKey, apiKey } = await storage.getBatchData(provider);
    return { success: true, hasKey, apiKey: apiKey || undefined };
  } catch (error: any) {
    console.error('Error in getKeyAndStatusAction:', error);
    return { success: false, error: error.message ?? 'Unknown error' };
  }
}
