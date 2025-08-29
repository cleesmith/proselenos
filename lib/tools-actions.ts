'use server';

// lib/tools-actions.ts
// Server Actions for tools operations
import { getAvailableToolsInternal, executeToolInternal, initializeToolsInternal, getToolPromptInternal } from './toolsInternal';
import type { ToolExecutionResult } from '../types/api-keys';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { google } from 'googleapis';


// Server action to initialize and copy tool-prompts to Google Drive
export async function getToolsAction(): Promise<{
  success: boolean;
  tools?: any[];
  error?: string;
}> {
  try {
    // First initialize the tool system (this does the copy if needed)
    const initResult = await initializeToolsInternal();
    
    if (!initResult.success) {
      return {
        success: false,
        error: initResult.message || 'Tool initialization failed'
      };
    }

    // If tools were just copied or already exist, get the tools list
    // This should be fast since we know tools are ready
    const result = await getAvailableToolsInternal();
    return result;
  } catch (error) {
    console.error('Error in getToolsAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Server action to get tools from Google Drive (fast, assumes tools are already initialized)
export async function getAvailableToolsAction(): Promise<{
  success: boolean;
  tools?: any[];
  error?: string;
}> {
  console.time('getAvailableTools-total');
  try {
    const result = await getAvailableToolsInternal();
    console.timeEnd('getAvailableTools-total');
    return result;
  } catch (error) {
    console.timeEnd('getAvailableTools-total');
    console.error('Error in getAvailableToolsAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Server action to execute a tool
export async function executeToolAction(
  toolId: string,
  manuscriptContent: string
): Promise<ToolExecutionResult> {
  try {
    const result = await executeToolInternal(toolId, manuscriptContent);
    return result;
  } catch (error) {
    console.error('Error in executeToolAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Server action to get tool prompt content
export async function getToolPromptAction(toolId: string): Promise<{
  success: boolean;
  content?: string;
  fileId?: string;
  error?: string;
}> {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      return { success: false, error: 'Not authenticated or missing user ID' };
    }

    if (!session.accessToken) {
      return { success: false, error: 'No access token available' };
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: session.accessToken,
    });
    
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    const [category, fileName] = toolId.split('/');
    if (!category || !fileName) {
      return { success: false, error: 'Invalid tool ID format' };
    }

    // Step 1: find storygrind_projects folder
    const projects = await drive.files.list({
      q: "name='storygrind_projects' and mimeType='application/vnd.google-apps.folder' and trashed=false",
      fields: 'files(id)',
    });
    const projectsFolderId = projects.data.files?.[0]?.id;
    if (!projectsFolderId) return { success: false, error: 'Projects folder not found' };

    // Step 2: find tool-prompts folder
    const prompts = await drive.files.list({
      q: `'${projectsFolderId}' in parents and name='tool-prompts' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id)',
    });
    const promptsFolderId = prompts.data.files?.[0]?.id;
    if (!promptsFolderId) return { success: false, error: 'tool-prompts folder not found' };

    // Step 3: find category folder
    const cat = await drive.files.list({
      q: `'${promptsFolderId}' in parents and name='${category}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id)',
    });
    const categoryFolderId = cat.data.files?.[0]?.id;
    if (!categoryFolderId) return { success: false, error: `Category folder ${category} not found` };

    // Step 4: find the prompt file
    const fileRes = await drive.files.list({
      q: `'${categoryFolderId}' in parents and name='${fileName}' and mimeType='text/plain' and trashed=false`,
      fields: 'files(id)',
    });
    const fileId = fileRes.data.files?.[0]?.id;
    if (!fileId) return { success: false, error: `${fileName} not found in Drive` };

    // Step 5: read the file content
    const response = await drive.files.get({
      fileId,
      alt: 'media'
    });

    const content = typeof response.data === 'string' 
      ? response.data 
      : response.data.toString();

    return { success: true, content, fileId };
  } catch (error: any) {
    return { success: false, error: error.message ?? 'Failed to load prompt' };
  }
}

// Server action to update tool prompt content
export async function updateToolPromptAction(toolId: string, content: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      return { success: false, error: 'Not authenticated or missing user ID' };
    }

    if (!session.accessToken) {
      return { success: false, error: 'No access token available' };
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: session.accessToken,
    });
    
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    const [category, fileName] = toolId.split('/');
    if (!category || !fileName) {
      return { success: false, error: 'Invalid tool ID format' };
    }

    // Step 1: find storygrind_projects folder
    const projects = await drive.files.list({
      q: "name='storygrind_projects' and mimeType='application/vnd.google-apps.folder' and trashed=false",
      fields: 'files(id)',
    });
    const projectsFolderId = projects.data.files?.[0]?.id;
    if (!projectsFolderId) return { success: false, error: 'Projects folder not found' };

    // Step 2: find tool-prompts folder
    const prompts = await drive.files.list({
      q: `'${projectsFolderId}' in parents and name='tool-prompts' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id)',
    });
    const promptsFolderId = prompts.data.files?.[0]?.id;
    if (!promptsFolderId) return { success: false, error: 'tool-prompts folder not found' };

    // Step 3: find category folder
    const cat = await drive.files.list({
      q: `'${promptsFolderId}' in parents and name='${category}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id)',
    });
    const categoryFolderId = cat.data.files?.[0]?.id;
    if (!categoryFolderId) return { success: false, error: `Category folder ${category} not found` };

    // Step 4: find the prompt file
    const fileRes = await drive.files.list({
      q: `'${categoryFolderId}' in parents and name='${fileName}' and mimeType='text/plain' and trashed=false`,
      fields: 'files(id)',
    });
    const fileId = fileRes.data.files?.[0]?.id;
    if (!fileId) return { success: false, error: `${fileName} not found in Drive` };

    // Step 5: update existing file
    await drive.files.update({
      fileId,
      media: {
        mimeType: 'text/plain',
        body: content,
      },
      fields: 'id, name',
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message ?? 'Failed to update prompt' };
  }
}
