// lib/tools/toolSystem.ts
// Main tool execution coordinator and system manager

import { drive_v3 } from 'googleapis';
import { 
  ToolExecutionRequest, 
  ToolExecutionResult, 
  ToolListResponse,
  ToolPromptSyncResult,
  ToolMetadata 
} from '../../types/tools';
import { ToolRegistry } from './registry';
import { ToolBase, createTool } from './toolBase';
import { PromptSyncManager } from './promptSync';
import { ToolPromptManager } from './toolPrompts';

export class ToolSystem {
  private drive: drive_v3.Drive;
  private userId: string;
  private registry: ToolRegistry;
  private syncManager: PromptSyncManager;
  private promptManager: ToolPromptManager;

  constructor(googleDriveClient: drive_v3.Drive, userId: string) {
    this.drive = googleDriveClient;
    this.userId = userId;
    this.registry = new ToolRegistry(googleDriveClient, userId);
    this.syncManager = new PromptSyncManager(googleDriveClient, userId);
    this.promptManager = new ToolPromptManager(googleDriveClient, userId);
  }

  // Initialize the tool system for a user (sync prompts if needed)
  async initialize(): Promise<ToolPromptSyncResult> {
    try {
      console.log(`Initializing tool system for user ${this.userId}`);
      
      const syncStatus = await this.syncManager.getSyncStatus();
      
      if (syncStatus.needsSync) {
        console.log('User needs tool prompts sync, performing sync...');
        return await this.syncManager.syncToolPrompts();
      }

      return {
        success: true,
        syncedCount: 0,
        message: 'Tool system already initialized'
      };

    } catch (error) {
      console.error('Error initializing tool system:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown initialization error'
      };
    }
  }

  // Get all available tools
  async getAvailableTools(): Promise<ToolListResponse> {
    try {
      return await this.registry.getAllTools();
    } catch (error) {
      console.error('Error getting available tools:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Execute a specific tool
  async executeTool(request: ToolExecutionRequest): Promise<ToolExecutionResult> {
    try {
      console.log(`Executing tool: ${request.toolId}`);
      
      // Tool system should already be initialized at startup - don't re-initialize

      // Find the tool metadata
      const toolMetadata = await this.registry.findTool(request.toolId);
      if (!toolMetadata) {
        return {
          success: false,
          toolId: request.toolId,
          error: `Tool not found: ${request.toolId}`
        };
      }

      // Create and execute the tool
      const tool = createTool(this.drive, this.userId, toolMetadata);
      
      // Check if tool can be executed
      const canExecute = await tool.canExecute();
      if (!canExecute) {
        return {
          success: false,
          toolId: request.toolId,
          error: 'Tool cannot be executed - prompt not available'
        };
      }

      // Execute the tool
      const result = await tool.execute(request.manuscript, request.options);
      
      console.log(`Tool execution completed: ${request.toolId}, success: ${result.success}`);
      return result;

    } catch (error) {
      console.error(`Error executing tool ${request.toolId}:`, error);
      return {
        success: false,
        toolId: request.toolId,
        error: error instanceof Error ? error.message : 'Unknown execution error'
      };
    }
  }

  // Get tool information by ID
  async getToolInfo(toolId: string): Promise<ToolMetadata | null> {
    try {
      return await this.registry.findTool(toolId);
    } catch (error) {
      console.error(`Error getting tool info for ${toolId}:`, error);
      return null;
    }
  }

  // Check if a tool exists and can be executed
  async validateTool(toolId: string): Promise<boolean> {
    try {
      const toolMetadata = await this.registry.findTool(toolId);
      if (!toolMetadata) {
        return false;
      }

      const tool = createTool(this.drive, this.userId, toolMetadata);
      return await tool.canExecute();
    } catch (error) {
      console.error(`Error validating tool ${toolId}:`, error);
      return false;
    }
  }

  // Get sync status
  async getSyncStatus(): Promise<{ hasToolPrompts: boolean; needsSync: boolean }> {
    try {
      return await this.syncManager.getSyncStatus();
    } catch (error) {
      console.error('Error getting sync status:', error);
      return {
        hasToolPrompts: false,
        needsSync: true
      };
    }
  }

  // Force sync tool prompts
  async forceSyncPrompts(): Promise<ToolPromptSyncResult> {
    try {
      return await this.syncManager.syncToolPrompts();
    } catch (error) {
      console.error('Error forcing sync:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown sync error'
      };
    }
  }

  // Get all tools in a specific category
  async getToolsByCategory(category: string): Promise<ToolMetadata[]> {
    try {
      const validCategories = await this.registry.getAvailableCategories();
      if (!validCategories.includes(category as any)) {
        return [];
      }
      return await this.registry.getToolsByCategory(category as any);
    } catch (error) {
      console.error(`Error getting tools for category ${category}:`, error);
      return [];
    }
  }

  // Get tool prompt content (for debugging or customization)
  async getToolPromptContent(toolId: string): Promise<string | null> {
    try {
      const toolMetadata = await this.registry.findTool(toolId);
      if (!toolMetadata) {
        return null;
      }

      const tool = createTool(this.drive, this.userId, toolMetadata);
      return await tool.getPromptContent();
    } catch (error) {
      console.error(`Error getting prompt content for ${toolId}:`, error);
      return null;
    }
  }
}

// Factory function to create tool system instances
export function createToolSystem(
  googleDriveClient: drive_v3.Drive,
  userId: string
): ToolSystem {
  return new ToolSystem(googleDriveClient, userId);
}