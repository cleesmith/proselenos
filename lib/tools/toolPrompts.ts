// lib/tools/toolPrompts.ts

import { drive_v3 } from 'googleapis';
import { ToolPrompt, ToolCategory } from '../../types/tools';
import { BulkToolLoader } from './bulkToolLoader';

export class ToolPromptManager {
  private bulkLoader: BulkToolLoader;

  constructor(googleDriveClient: drive_v3.Drive, userId: string) {
    this.bulkLoader = BulkToolLoader.getInstance(googleDriveClient, userId);
  }

  async loadToolPrompt(toolId: string): Promise<ToolPrompt | null> {
    return await this.bulkLoader.getToolPrompt(toolId);
  }

  async hasToolPrompts(): Promise<boolean> {
    try {
      const { tools } = await this.bulkLoader.getAllTools();
      return tools.length > 0;
    } catch (error) {
      return false;
    }
  }

  // Get categories dynamically from Google Drive
  async getAvailableCategories(): Promise<string[]> {
    const { categories } = await this.bulkLoader.getAllTools();
    return categories;
  }

  // Get tools by category
  async getToolsByCategory(category: string): Promise<ToolPrompt[]> {
    try {
      const { tools } = await this.bulkLoader.getAllTools();
      const categoryTools = tools.filter(tool => tool.category === category);
      
      const prompts: ToolPrompt[] = [];
      for (const tool of categoryTools) {
        const prompt = await this.bulkLoader.getToolPrompt(tool.id);
        if (prompt) {
          prompts.push(prompt);
        }
      }
      
      return prompts;
    } catch (error) {
      console.error(`Error getting tools for category ${category}:`, error);
      return [];
    }
  }
}
