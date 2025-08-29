// lib/tools/promptSync.ts
// System to copy original tool prompts from local app folder to user's Google Drive

import { drive_v3 } from 'googleapis';
import { promises as fs } from 'fs';
import path from 'path';
import { ToolPromptSyncResult, ToolCategory } from '../../types/tools';
import { checkToolPromptsExists } from '../googleDrive';

export class PromptSyncManager {
  private drive: drive_v3.Drive;
  private userId: string;
  private localToolPromptsPath: string;

  constructor(googleDriveClient: drive_v3.Drive, userId: string) {
    this.drive = googleDriveClient;
    this.userId = userId;
    this.localToolPromptsPath = path.join(process.cwd(), 'original-tool-prompts');
  }

  // Find or create the storygrind_projects folder
  private async findOrCreateProjectsFolder(): Promise<string> {
    try {
      // Check if storygrind_projects folder exists
      const folderQuery = await this.drive.files.list({
        q: "name='storygrind_projects' and mimeType='application/vnd.google-apps.folder' and trashed=false",
        fields: 'files(id, name)',
      });

      if (folderQuery.data.files && folderQuery.data.files.length > 0) {
        return folderQuery.data.files[0].id!;
      }

      // Create the folder if it doesn't exist
      const folderResponse = await this.drive.files.create({
        requestBody: {
          name: 'storygrind_projects',
          mimeType: 'application/vnd.google-apps.folder',
        },
        fields: 'id',
      });

      return folderResponse.data.id!;
    } catch (error) {
      console.error('Error finding/creating storygrind_projects folder:', error);
      throw error;
    }
  }

  // Create a folder in Google Drive
  private async createFolder(name: string, parentFolderId: string): Promise<string> {
    try {
      const folderResponse = await this.drive.files.create({
        requestBody: {
          name,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentFolderId],
        },
        fields: 'id',
      });

      return folderResponse.data.id!;
    } catch (error) {
      console.error(`Error creating folder ${name}:`, error);
      throw error;
    }
  }

  // Upload a text file to Google Drive
  private async uploadTextFile(fileName: string, content: string, parentFolderId: string): Promise<void> {
    try {
      await this.drive.files.create({
        requestBody: {
          name: fileName,
          parents: [parentFolderId],
          mimeType: 'text/plain',
        },
        media: {
          mimeType: 'text/plain',
          body: content,
        },
      });
    } catch (error) {
      console.error(`Error uploading file ${fileName}:`, error);
      throw error;
    }
  }

  // Check if a folder exists in Google Drive
  private async folderExists(folderName: string, parentFolderId: string): Promise<boolean> {
    try {
      const response = await this.drive.files.list({
        q: `name='${folderName}' and '${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id)',
      });

      return Boolean(response.data.files && response.data.files.length > 0);
    } catch (error) {
      console.error(`Error checking if folder ${folderName} exists:`, error);
      return false;
    }
  }

  // Check if tool-prompts folder exists in user's Google Drive
  async checkToolPromptsExist(): Promise<boolean> {
    try {
      const projectsFolderId = await this.findOrCreateProjectsFolder();
      return await this.folderExists('tool-prompts', projectsFolderId);
    } catch (error) {
      console.error('Error checking tool prompts existence:', error);
      return false;
    }
  }

  // Copy all tool prompts from local folder to Google Drive
  async syncToolPrompts(): Promise<ToolPromptSyncResult> {
    try {
      console.log('Starting tool prompts copy...');
      
      const projectsFolderId = await this.findOrCreateProjectsFolder();
      
      // Check if tool-prompts folder already exists on Google Drive
      const toolPromptsExists = await checkToolPromptsExists(this.drive, projectsFolderId);
      if (toolPromptsExists) {
        console.log('Tool prompts folder already exists on Google Drive');
        return {
          success: true,
          syncedCount: 0,
          message: 'Tool prompts already exist on Google Drive'
        };
      }
      
      // Check if local tool-prompts folder exists
      try {
        await fs.access(this.localToolPromptsPath);
      } catch {
        return {
          success: false,
          message: 'Local original-tool-prompts folder not found'
        };
      }

      // Create tool-prompts folder
      const toolPromptsFolderId = await this.createFolder('tool-prompts', projectsFolderId);
      
      let syncedCount = 0;
      let skippedCount = 0;
      const errors: string[] = [];

      // Get all directories in local tool-prompts folder
      const localDirs = await fs.readdir(this.localToolPromptsPath, { withFileTypes: true });
      
      for (const dir of localDirs) {
        if (!dir.isDirectory()) continue;
        
        try {
          console.log(`Syncing category: ${dir.name}`);
          
          // Create category folder in Google Drive
          const categoryFolderId = await this.createFolder(dir.name, toolPromptsFolderId);
          
          // Get all .txt files in this category
          const categoryPath = path.join(this.localToolPromptsPath, dir.name);
          const files = await fs.readdir(categoryPath);
          const txtFiles = files.filter(file => file.endsWith('.txt'));
          
          for (const fileName of txtFiles) {
            try {
              const filePath = path.join(categoryPath, fileName);
              const content = await fs.readFile(filePath, 'utf8');
              
              await this.uploadTextFile(fileName, content, categoryFolderId);
              syncedCount++;
              console.log(`Uploaded: ${dir.name}/${fileName}`);
            } catch (error) {
              console.error(`Error uploading file ${fileName}:`, error);
              errors.push(`Failed to upload ${dir.name}/${fileName}`);
              skippedCount++;
            }
          }
        } catch (error) {
          console.error(`Error processing category ${dir.name}:`, error);
          errors.push(`Failed to process category ${dir.name}`);
        }
      }

      console.log(`Copy completed: ${syncedCount} files copied, ${skippedCount} skipped`);

      console.log('Tool prompts sync completed successfully');

      return {
        success: true,
        syncedCount,
        skippedCount,
        errors: errors.length > 0 ? errors : undefined,
        message: `Successfully copied ${syncedCount} tool prompts to Google Drive`
      };

    } catch (error) {
      console.error('Error syncing tool prompts:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error during sync'
      };
    }
  }

  // Get sync status without performing sync
  async getSyncStatus(): Promise<{ hasToolPrompts: boolean; needsSync: boolean }> {
    try {
      const hasToolPrompts = await this.checkToolPromptsExist();
      return {
        hasToolPrompts,
        needsSync: !hasToolPrompts
      };
    } catch (error) {
      console.error('Error getting sync status:', error);
      return {
        hasToolPrompts: false,
        needsSync: true
      };
    }
  }
}