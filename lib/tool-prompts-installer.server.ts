// lib/tool-prompts-installer.server.ts
// Server-side only - handles file system operations

import { uploadFolderToGoogleDrive } from './uploadToGoogleDrive';
import { getAuthClient, getDriveClient, checkToolPromptsExists } from './googleDrive';
import { ToolPromptsInstallResult } from './tool-prompts-installer';
import path from 'path';

export async function installToolPrompts(
  accessToken: string,
  proselenosRootFolderId: string
): Promise<ToolPromptsInstallResult> {
  try {
    const authClient = getAuthClient(accessToken);
    const drive = getDriveClient(authClient);
    
    // Check if tool-prompts folder already exists on Google Drive
    const toolPromptsExists = await checkToolPromptsExists(drive, proselenosRootFolderId);
    if (toolPromptsExists) {
      return {
        success: true,
        message: 'Tool-prompts folder already exists on Google Drive',
        filesUploaded: 0,
        foldersCreated: 0
      };
    }
    
    // Check if original-tool-prompts folder exists locally
    const toolPromptsPath = path.join(process.cwd(), 'original-tool-prompts');
    
    // Upload the tool-prompts folder to Google Drive
    const result = await uploadFolderToGoogleDrive(
      authClient,
      toolPromptsPath,
      proselenosRootFolderId,
      'tool-prompts'
    );
    
    if (result.success) {
      return {
        success: true,
        message: `Successfully installed Tools and Prompts!\nUploaded ${result.filesUploaded} files and created ${result.foldersCreated} folders.`,
        filesUploaded: result.filesUploaded,
        foldersCreated: result.foldersCreated
      };
    } else {
      return {
        success: false,
        message: 'Failed to upload tool-prompts folder to Google Drive'
      };
    }
    
  } catch (error) {
    console.error('Tool-prompts installation error:', error);
    
    return {
      success: false,
      message: `Installation failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

export async function checkToolPromptsInstallation(
  accessToken: string,
  proselenosRootFolderId: string
): Promise<boolean> {
  try {
    const authClient = getAuthClient(accessToken);
    const drive = getDriveClient(authClient);
    return await checkToolPromptsExists(drive, proselenosRootFolderId);
    
  } catch (error) {
    console.error('Error checking tool-prompts installation:', error);
    return false;
  }
}