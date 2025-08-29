// lib/tools/registry.ts

import { ToolMetadata, ToolCategory, ToolListResponse } from '../../types/tools';
import { drive_v3 } from 'googleapis';
import { BulkToolLoader } from './bulkToolLoader';

export class ToolRegistry {
  private bulkLoader: BulkToolLoader;

  constructor(googleDriveClient: drive_v3.Drive, userId: string) {
    this.bulkLoader = BulkToolLoader.getInstance(googleDriveClient, userId);
  }

  async getAllTools(): Promise<ToolListResponse> {
    try {
      const { tools, categories } = await this.bulkLoader.getAllTools();
      return {
        success: true,
        tools,
        categories: categories as ToolCategory[]
      };
    } catch (error) {
      console.error('Error getting all tools:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load tools from Google Drive'
      };
    }
  }

  async getToolsByCategory(category: ToolCategory): Promise<ToolMetadata[]> {
    const { tools } = await this.bulkLoader.getAllTools();
    return tools.filter(tool => tool.category === category);
  }

  async findTool(toolId: string): Promise<ToolMetadata | null> {
    const { tools } = await this.bulkLoader.getAllTools();
    return tools.find(tool => tool.id === toolId) || null;
  }

  // Categories discovered dynamically from Google Drive folder names
  async getAvailableCategories(): Promise<string[]> {
    const { categories } = await this.bulkLoader.getAllTools();
    return categories;
  }

  // Clear cache when user modifies tools
  clearCache(): void {
    this.bulkLoader.clearCache();
  }
}
