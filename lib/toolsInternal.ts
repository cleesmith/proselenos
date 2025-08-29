// lib/toolsInternal.ts - Internal tool functions (not exposed as public API)
// Only callable from within the app, never accessible from outside

import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { google } from 'googleapis';
import { createToolSystem } from './tools/toolSystem';
import { 
  ToolExecutionResult, 
  ToolListResponse, 
  ToolMetadata, 
  ToolPromptSyncResult,
  ToolExecutionOptions 
} from '../types/tools';

// Get authenticated Google Drive client and tool system
async function getToolSystemForUser() {
  console.time('getToolSystemForUser');
  const session = await getServerSession(authOptions);
  if (!session || !session.user || !session.user.id) {
    throw new Error('Not authenticated or missing user ID');
  }

  if (!session.accessToken) {
    throw new Error('No access token available');
  }

  console.time('createDriveClient');
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: session.accessToken,
  });
  
  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  console.timeEnd('createDriveClient');
  
  const toolSystem = createToolSystem(drive, session.user.id);

  console.timeEnd('getToolSystemForUser');
  return { toolSystem, userId: session.user.id };
}

/**
 * Internal function to get all available tools - NOT a public API endpoint
 * @returns List of available tools with metadata
 */
export async function getAvailableToolsInternal(): Promise<ToolListResponse> {
  try {
    const { toolSystem } = await getToolSystemForUser();
    return await toolSystem.getAvailableTools();
  } catch (error) {
    console.error('Internal tools list error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Internal function to execute a tool - NOT a public API endpoint
 * @param toolId - The tool to execute
 * @param manuscript - The manuscript content
 * @param options - Optional execution parameters
 * @returns Tool execution result
 */
export async function executeToolInternal(
  toolId: string,
  manuscript: string,
  options: ToolExecutionOptions = {}
): Promise<ToolExecutionResult> {
  try {
    console.log(`Internal tool execution: ${toolId}`);
    
    const { toolSystem } = await getToolSystemForUser();
    
    const result = await toolSystem.executeTool({
      toolId,
      manuscript,
      options
    });
    
    console.log(`Tool execution result: ${toolId}, success: ${result.success}`);
    return result;
    
  } catch (error) {
    console.error(`Internal tool execution error for ${toolId}:`, error);
    return {
      success: false,
      toolId,
      error: error instanceof Error ? error.message : 'Unknown execution error'
    };
  }
}

/**
 * Internal function to initialize tool system - NOT a public API endpoint
 * @returns Sync result indicating if prompts were copied
 */
export async function initializeToolsInternal(): Promise<ToolPromptSyncResult> {
  try {
    console.log('Initializing tools internally...');
    
    const { toolSystem } = await getToolSystemForUser();
    return await toolSystem.initialize();
    
  } catch (error) {
    console.error('Internal tool initialization error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown initialization error'
    };
  }
}

/**
 * Internal function to get tools by category - NOT a public API endpoint
 * @param category - The tool category
 * @returns List of tools in the category
 */
export async function getToolsByCategoryInternal(category: string): Promise<ToolMetadata[]> {
  try {
    const { toolSystem } = await getToolSystemForUser();
    return await toolSystem.getToolsByCategory(category);
  } catch (error) {
    console.error(`Internal tools by category error for ${category}:`, error);
    return [];
  }
}

/**
 * Internal function to get tool information - NOT a public API endpoint
 * @param toolId - The tool ID
 * @returns Tool metadata or null if not found
 */
export async function getToolInfoInternal(toolId: string): Promise<ToolMetadata | null> {
  try {
    const { toolSystem } = await getToolSystemForUser();
    return await toolSystem.getToolInfo(toolId);
  } catch (error) {
    console.error(`Internal tool info error for ${toolId}:`, error);
    return null;
  }
}

/**
 * Internal function to validate if a tool can be executed - NOT a public API endpoint
 * @param toolId - The tool ID
 * @returns True if tool can be executed
 */
export async function validateToolInternal(toolId: string): Promise<boolean> {
  try {
    const { toolSystem } = await getToolSystemForUser();
    return await toolSystem.validateTool(toolId);
  } catch (error) {
    console.error(`Internal tool validation error for ${toolId}:`, error);
    return false;
  }
}

/**
 * Internal function to get sync status - NOT a public API endpoint
 * @returns Sync status information
 */
export async function getToolSyncStatusInternal(): Promise<{ hasToolPrompts: boolean; needsSync: boolean }> {
  try {
    const { toolSystem } = await getToolSystemForUser();
    return await toolSystem.getSyncStatus();
  } catch (error) {
    console.error('Internal sync status error:', error);
    return {
      hasToolPrompts: false,
      needsSync: true
    };
  }
}

/**
 * Internal function to force sync tool prompts - NOT a public API endpoint
 * @returns Sync result
 */
export async function forceSyncToolsInternal(): Promise<ToolPromptSyncResult> {
  try {
    console.log('Force syncing tools internally...');
    
    const { toolSystem } = await getToolSystemForUser();
    return await toolSystem.forceSyncPrompts();
    
  } catch (error) {
    console.error('Internal force sync error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown sync error'
    };
  }
}

/**
 * Internal function to get tool prompt content - NOT a public API endpoint
 * @param toolId - The tool ID
 * @returns Tool prompt content or null if not found
 */
export async function getToolPromptInternal(toolId: string): Promise<string | null> {
  try {
    const { toolSystem } = await getToolSystemForUser();
    return await toolSystem.getToolPromptContent(toolId);
  } catch (error) {
    console.error(`Internal get prompt error for ${toolId}:`, error);
    return null;
  }
}