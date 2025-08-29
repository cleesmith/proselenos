// lib/tools/toolBase.ts
// Base class for all tools with common functionality

import { drive_v3 } from 'googleapis';
import { ToolPrompt, ToolMetadata, ToolExecutionResult, ToolExecutionOptions, ToolCategory } from '../../types/tools';
import { ToolPromptManager } from './toolPrompts';
import { streamAIInternal } from '../aiInternal';

export class ToolBase {
  protected drive: drive_v3.Drive;
  protected userId: string;
  protected promptManager: ToolPromptManager;
  public metadata: ToolMetadata;

  constructor(
    googleDriveClient: drive_v3.Drive, 
    userId: string,
    metadata: ToolMetadata
  ) {
    this.drive = googleDriveClient;
    this.userId = userId;
    this.metadata = metadata;
    this.promptManager = new ToolPromptManager(googleDriveClient, userId);
  }

  // Load the prompt content for this tool
  async loadPrompt(): Promise<ToolPrompt | null> {
    try {
      return await this.promptManager.loadToolPrompt(this.metadata.id);
    } catch (error) {
      console.error(`Error loading prompt for tool ${this.metadata.id}:`, error);
      return null;
    }
  }

  // Execute the tool with the given manuscript and options
  async execute(
    manuscript: string, 
    options: ToolExecutionOptions = {}
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Load the prompt
      const prompt = await this.loadPrompt();
      if (!prompt) {
        return {
          success: false,
          toolId: this.metadata.id,
          error: 'Failed to load tool prompt',
          executionTime: Date.now() - startTime
        };
      }

      // Prepare the full prompt by combining tool prompt with manuscript
      const fullPrompt = this.preparePrompt(prompt.content, manuscript, options);

      // Execute via AI service
      const result = await streamAIInternal(
        fullPrompt,
        manuscript,
        {
          temperature: options.temperature || 0.3,
          includeMetaData: options.includeMetadata || false,
          ...options
        }
      );

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        toolId: this.metadata.id,
        result,
        executionTime,
        metadata: {
          toolName: this.metadata.name,
          category: this.metadata.category,
          timestamp: new Date().toISOString(),
          promptLength: prompt.content.length,
          manuscriptLength: manuscript.length,
          resultLength: result.length
        }
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(`Error executing tool ${this.metadata.id}:`, error);
      
      return {
        success: false,
        toolId: this.metadata.id,
        error: error instanceof Error ? error.message : 'Unknown execution error',
        executionTime
      };
    }
  }

  // Prepare the full prompt by combining tool prompt with manuscript
  protected preparePrompt(
    toolPrompt: string, 
    manuscript: string, 
    options: ToolExecutionOptions
  ): string {
    // For most tools, the tool prompt is the system instruction
    // and the manuscript is the user content to be processed
    
    // Add any additional context if provided
    let fullPrompt = toolPrompt;
    
    if (options.additionalContext) {
      fullPrompt += `\n\nAdditional Context:\n${options.additionalContext}`;
    }

    return fullPrompt;
  }

  // Validate that the tool can be executed
  async canExecute(): Promise<boolean> {
    try {
      const prompt = await this.loadPrompt();
      return prompt !== null;
    } catch (error) {
      console.error(`Error checking if tool ${this.metadata.id} can execute:`, error);
      return false;
    }
  }

  // Get tool information
  getInfo(): ToolMetadata {
    return { ...this.metadata };
  }

  // Get tool prompt content (for debugging or user customization)
  async getPromptContent(): Promise<string | null> {
    try {
      const prompt = await this.loadPrompt();
      return prompt?.content || null;
    } catch (error) {
      console.error(`Error getting prompt content for tool ${this.metadata.id}:`, error);
      return null;
    }
  }
}

// Factory function to create tool instances
export function createTool(
  googleDriveClient: drive_v3.Drive,
  userId: string,
  metadata: ToolMetadata
): ToolBase {
  return new ToolBase(googleDriveClient, userId, metadata);
}