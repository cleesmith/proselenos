// lib/tools/bulkToolLoader.ts

// Clean bulk loader with DYNAMIC categories from Google Drive folder names

import { drive_v3 } from 'googleapis';
import { findRootFolderByProperty } from '@/lib/googleDrive';
import { ToolPrompt, ToolMetadata, ToolCategory } from '../../types/tools';

// Per-user singleton instances to prevent multiple bulk loading operations
const userInstances = new Map<string, BulkToolLoader>();

interface ToolCache {
  tools: ToolMetadata[];
  prompts: Map<string, ToolPrompt>;
  categories: string[]; // Dynamic categories from actual folder names
  loadedAt: number;
}

export class BulkToolLoader {
  // Store the Drive client for API calls.  This is kept as a mutable property
  // because the access token can change between requests.  When a new
  // BulkToolLoader instance is requested for the same user, the drive
  // reference will be updated via `updateDriveClient`.
  private drive: drive_v3.Drive;
  private userId: string;
  private cache: ToolCache | null = null;
  private loading: Promise<ToolCache> | null = null;
  private readonly CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

  private constructor(googleDriveClient: drive_v3.Drive, userId: string) {
    this.drive = googleDriveClient;
    this.userId = userId;
  }

  /**
   * Update the underlying Google Drive client.  This allows reuse of the
   * BulkToolLoader across multiple requests while still using fresh
   * credentials. Without updating the drive reference, an expired access
   * token can cause 401 errors when making Drive API calls.  This method
   * should be called whenever a new BulkToolLoader instance is requested
   * and an existing instance already exists for the same user.
   */
  public updateDriveClient(newDrive: drive_v3.Drive): void {
    this.drive = newDrive;
  }

  // Static factory method to get or create per-user singleton instance
  static getInstance(googleDriveClient: drive_v3.Drive, userId: string): BulkToolLoader {
    const existing = userInstances.get(userId);
    if (existing) {
      // Always update the drive client with the latest credentials.  Access
      // tokens expire regularly, and using an old Drive instance will
      // produce 401 "invalid authentication credentials" errors.  By
      // updating the drive client here, we ensure that subsequent calls
      // within the same user session use the fresh token.
      existing.updateDriveClient(googleDriveClient);
      return existing;
    }
    const instance = new BulkToolLoader(googleDriveClient, userId);
    userInstances.set(userId, instance);
    return instance;
  }

  // Method to clear user instance (for cleanup)
  static clearUserInstance(userId: string): void {
    userInstances.delete(userId);
  }

  // Get all tools (bulk loads on first call, then serves from memory)
  async getAllTools(): Promise<{ tools: ToolMetadata[]; categories: string[] }> {
    const cache = await this.getCache();
    return {
      tools: cache.tools,
      categories: cache.categories,
    };
  }

  // Get specific tool prompt content (from memory)
  async getToolPrompt(toolId: string): Promise<ToolPrompt | null> {
    const cache = await this.getCache();
    const cachedPrompt = cache.prompts.get(toolId);

    // If we have cached prompt, return it (fast path)
    if (cachedPrompt) {
      return cachedPrompt;
    }

    // Fallback: Tool not in cache, try to fetch it dynamically by path
    console.log(`Tool ${toolId} not in cache, attempting dynamic fetch...`);

    try {
      // Parse toolId format: "category/filename"
      const [category, fileName] = toolId.split('/');
      if (!category || !fileName) {
        console.error(`Invalid tool ID format: ${toolId}`);
        return null;
      }

      // Find tool-prompts folder
      const rootResponse = await this.drive.files.list({
        q: `name='tool-prompts' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
      });

      const toolPromptsFolder = rootResponse.data.files?.[0];
      if (!toolPromptsFolder?.id) {
        console.error('tool-prompts folder not found for dynamic fetch');
        return null;
      }

      // Find category folder
      const categoryResponse = await this.drive.files.list({
        q: `'${toolPromptsFolder.id}' in parents and name='${category}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
      });

      const categoryFolder = categoryResponse.data.files?.[0];
      if (!categoryFolder?.id) {
        console.error(`Category folder '${category}' not found for dynamic fetch`);
        return null;
      }

      // Find tool file
      const toolFileResponse = await this.drive.files.list({
        q: `'${categoryFolder.id}' in parents and name='${fileName}' and mimeType='text/plain' and trashed=false`,
        fields: 'files(id, name)',
      });

      const toolFile = toolFileResponse.data.files?.[0];
      if (!toolFile?.id) {
        console.error(`Tool file '${fileName}' not found in category '${category}' for dynamic fetch`);
        return null;
      }

      // Download tool content
      const contentResponse = await this.drive.files.get({
        fileId: toolFile.id,
        alt: 'media',
      });

      const content =
        typeof contentResponse.data === 'string'
          ? contentResponse.data
          : Buffer.from(contentResponse.data as any).toString('utf8');

      // Create tool prompt object
      const displayName = fileName
        .replace('.txt', '')
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      const toolPrompt: ToolPrompt = {
        id: toolId,
        name: displayName,
        category: category as ToolCategory,
        content: content.trim(),
      };

      // Update cache with newly fetched tool
      cache.prompts.set(toolId, toolPrompt);

      console.log(`Successfully fetched tool ${toolId} dynamically`);
      return toolPrompt;
    } catch (error) {
      console.error(`Failed to fetch tool ${toolId} dynamically:`, error);
      return null;
    }
  }

  // Invalidate cache (when user modifies tools)
  clearCache(): void {
    this.cache = null;
    this.loading = null;
  }

  // Get cache, loading if needed
  private async getCache(): Promise<ToolCache> {
    // Return valid cache
    if (this.cache && Date.now() - this.cache.loadedAt < this.CACHE_DURATION) {
      return this.cache;
    }

    // Prevent concurrent loads
    if (this.loading) {
      return await this.loading;
    }

    // Start bulk load
    this.loading = this.bulkLoadTools();
    this.cache = await this.loading;
    this.loading = null;

    return this.cache;
  }

  // ONE bulk operation to load everything from Google Drive
  private async bulkLoadTools(): Promise<ToolCache> {
    console.log('🚀 Bulk loading tools from Google Drive...');
    const startTime = Date.now();

    // Step 1: Find tool-prompts folder
    const toolPromptsFolderId = await this.findToolPromptsFolder();
    if (!toolPromptsFolderId) {
      throw new Error('tool-prompts folder not found in Google Drive');
    }

    // Step 2: Get all category folders in tool-prompts (DYNAMIC DISCOVERY)
    const categoriesResponse = await this.drive.files.list({
      q: `'${toolPromptsFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      orderBy: 'name', // Sort categories alphabetically
    });

    const categoryFolders = categoriesResponse.data.files || [];
    if (categoryFolders.length === 0) {
      throw new Error('No category folders found in tool-prompts');
    }

    console.log(
      `📁 Found ${categoryFolders.length} categories: ${categoryFolders
        .map((f) => f.name)
        .join(', ')}`,
    );

    // Step 3: Get all files from all categories in parallel
    const categoryFilesPromises = categoryFolders.map(async (folder) => {
      const filesResponse = await this.drive.files.list({
        q: `'${folder.id}' in parents and mimeType='text/plain' and trashed=false`,
        fields: 'files(id, name, modifiedTime)',
        orderBy: 'name', // Sort files alphabetically within categories
      });

      return {
        categoryName: folder.name!,
        files: filesResponse.data.files || [],
      };
    });

    const categoryResults = await Promise.all(categoryFilesPromises);

    // Step 4: Build file map and collect all file IDs
    const fileMap = new Map<
      string,
      { category: string; fileName: string; modifiedTime: string }
    >();
    const allFileIds: string[] = [];

    categoryResults.forEach(({ categoryName, files }) => {
      files.forEach((file) => {
        if (file.id && file.name) {
          allFileIds.push(file.id);
          fileMap.set(file.id, {
            category: categoryName,
            fileName: file.name,
            modifiedTime: file.modifiedTime || new Date().toISOString(),
          });
        }
      });
    });

    console.log(`📄 Found ${allFileIds.length} tool files across all categories`);

    // Step 5: Download ALL file contents in parallel
    console.log(`📥 Downloading ${allFileIds.length} tool files in parallel...`);

    const downloadPromises = allFileIds.map(async (fileId) => {
      const response = await this.drive.files.get({
        fileId,
        alt: 'media',
      });

      const content =
        typeof response.data === 'string'
          ? response.data
          : Buffer.from(response.data as any).toString('utf8');

      return { fileId, content };
    });

    const downloadResults = await Promise.all(downloadPromises);

    // Step 6: Build cache data structures
    const tools: ToolMetadata[] = [];
    const prompts = new Map<string, ToolPrompt>();
    const categorySet = new Set<string>();

    downloadResults.forEach(({ fileId, content }) => {
      const fileInfo = fileMap.get(fileId);
      if (!fileInfo) return;

      const { category, fileName, modifiedTime } = fileInfo;
      categorySet.add(category);

      // Create tool ID and display name
      const toolId = `${category}/${fileName}`;
      const displayName = fileName
        .replace('.txt', '')
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      // Create tool metadata
      const toolMetadata: ToolMetadata = {
        id: toolId,
        name: displayName,
        category: category as ToolCategory,
        description: `${displayName} tool for manuscript processing`,
        fileName,
        filePath: toolId,
      };

      tools.push(toolMetadata);

      // Create tool prompt
      const toolPrompt: ToolPrompt = {
        id: toolId,
        name: displayName,
        category: category as ToolCategory,
        content: content.trim(),
        // source: 'google-drive',
        // lastModified: modifiedTime,
      };

      prompts.set(toolId, toolPrompt);
    });

    // Sort tools by category then name
    tools.sort((a, b) => {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      return a.name.localeCompare(b.name);
    });

    // Categories are sorted alphabetically from the folder names
    const categories = Array.from(categorySet).sort();

    const result: ToolCache = {
      tools,
      prompts,
      categories,
      loadedAt: Date.now(),
    };

    const loadTime = Date.now() - startTime;
    console.log(
      `✅ Bulk loaded ${tools.length} tools from ${categories.length} categories in ${loadTime}ms`,
    );
    console.log(`📋 Categories: ${categories.join(', ')}`);

    return result;
  }

  // Find tool-prompts folder in Google Drive
  private async findToolPromptsFolder(): Promise<string | null> {
    const rootByProp = await findRootFolderByProperty(this.drive);
    if (!rootByProp?.id) {
      throw new Error('proselenos_projects folder not found');
    }
    const projectsFolderId = rootByProp.id!;
    // console.log('BulkToolLoader: using root by appProperties', {
    //   id: projectsFolderId,
    //   name: rootByProp.name,
    //   appProperties: (rootByProp as any).appProperties,
    // });

    // Find tool-prompts folder
    const toolPromptsResponse = await this.drive.files.list({
      q: `name='tool-prompts' and '${projectsFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id)',
    });

    return toolPromptsResponse.data.files && toolPromptsResponse.data.files.length > 0
      ? toolPromptsResponse.data.files[0].id!
      : null;
  }
}
