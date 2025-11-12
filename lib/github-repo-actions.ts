// lib/github-repo-actions.ts

'use server';

import { ensureUserRepoExists, listFiles, uploadFiles } from '@/lib/github-storage';
import fs from 'fs';
import path from 'path';

/**
 * Recursively read all files from a directory
 */
function readDirectoryRecursive(dirPath: string, baseDir: string = dirPath): Array<{ relativePath: string; content: string }> {
  const files: Array<{ relativePath: string; content: string }> = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      // Recursively read subdirectory
      files.push(...readDirectoryRecursive(fullPath, baseDir));
    } else if (entry.isFile() && entry.name.endsWith('.txt')) {
      // Read file content
      const content = fs.readFileSync(fullPath, 'utf-8');
      const relativePath = path.relative(baseDir, fullPath);
      files.push({ relativePath, content });
    }
  }

  return files;
}

/**
 * Server action to ensure user's GitHub repo exists
 * Creates repo if needed, or confirms existing repo
 * Ensures config files exist (creates them if missing)
 * Ensures tool-prompts folder exists (copies from original-tool-prompts if missing)
 */
export async function ensureUserGitHubRepoAction(userId: string) {
  try {
    // Ensure repo exists
    const result = await ensureUserRepoExists(userId, 'proselenos', 'Proselenos user storage');

    // Check if config files exist in repo root
    let existingFiles: string[] = [];
    try {
      const files = await listFiles(userId, 'proselenos', '', '.json');
      existingFiles = files.map(f => f.name);
    } catch (error) {
      // If listing fails, assume files don't exist (could be empty repo)
      existingFiles = [];
    }

    // Determine which files are missing
    const configExists = existingFiles.includes('proselenos-config.json');
    const settingsExists = existingFiles.includes('proselenos-settings.json');

    // If any files are missing, create them
    if (!configExists || !settingsExists) {
      const filesToCreate = [];

      if (!configExists) {
        // Default config structure (matches Google Drive structure)
        const defaultConfig = {
          settings: {
            current_project: null,
            current_project_folder_id: null,
            proselenos_root_folder_id: ''
          },
          selectedApiProvider: '',
          selectedAiModel: '',
          author_name: 'Anonymous',
          isDarkMode: false
        };
        filesToCreate.push({
          path: 'proselenos-config.json',
          content: JSON.stringify(defaultConfig, null, 2)
        });
      }

      if (!settingsExists) {
        // Default settings structure (matches Google Drive structure)
        const defaultSettings = {
          last_updated: new Date().toISOString()
        };
        filesToCreate.push({
          path: 'proselenos-settings.json',
          content: JSON.stringify(defaultSettings, null, 2)
        });
      }

      // Upload missing files
      await uploadFiles(
        userId,
        'proselenos',
        filesToCreate,
        'Initialize Proselenos config files'
      );

      console.log(`Created missing JSON files: ${filesToCreate.map(f => f.path).join(', ')}`);
    }

    // Check if tool-prompts folder exists in repo
    let toolPromptsExists = false;
    try {
      const toolFiles = await listFiles(userId, 'proselenos', 'tool-prompts/', '.txt');
      toolPromptsExists = toolFiles.length > 0;
    } catch (error) {
      toolPromptsExists = false;
    }

    // If tool-prompts folder is missing, copy from original-tool-prompts
    if (!toolPromptsExists) {
      const originalToolPromptsPath = path.join(process.cwd(), 'original-tool-prompts');

      // Check if original-tool-prompts exists locally
      if (fs.existsSync(originalToolPromptsPath)) {
        // Read all files from original-tool-prompts recursively
        const toolFiles = readDirectoryRecursive(originalToolPromptsPath);

        if (toolFiles.length > 0) {
          // Convert to GitHub upload format with tool-prompts prefix
          const filesToUpload = toolFiles.map(file => ({
            path: `tool-prompts/${file.relativePath}`,
            content: file.content
          }));

          // Upload all tool-prompts files in a single commit
          await uploadFiles(
            userId,
            'proselenos',
            filesToUpload,
            'Initialize tool-prompts from original-tool-prompts'
          );

          console.log(`Uploaded ${filesToUpload.length} tool-prompt files to GitHub repo`);
        }
      } else {
        console.warn('original-tool-prompts directory not found locally');
      }
    }

    return {
      success: true,
      data: result
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
