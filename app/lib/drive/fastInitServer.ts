// app/lib/drive/fastInitServer.ts
'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAuthClient, getDriveClient, ensureStoryGrindFolder } from '@/lib/googleDrive';

const FOLDER_MIME = 'application/vnd.google-apps.folder';

export type Config = {
  settings: {
    current_project: string | null;
    current_project_folder_id: string | null;
    storygrind_root_folder_id: string;
    tool_prompts_folder_id: string | null;
  };
  selectedApiProvider: string;
  selectedAiModel: string;
  author_name: string;
};

export type DriveFile = {
  id: string;
  name: string;
  mimeType?: string;
};

export type InitPayloadForClient = {
  config: Config | null;
  hasSettingsFile: boolean;
  projects: DriveFile[];
  toolCategories: DriveFile[];
  toolsByCategory: Record<string, DriveFile[]>;
  durationMs: number;
};

export async function fastInitForUser(accessToken: string): Promise<InitPayloadForClient> {
  const startTime = Date.now();
  
  try {
    const authClient = getAuthClient(accessToken);
    const drive = getDriveClient(authClient);
    
    // Ensure root folder exists
    const rootFolder = await ensureStoryGrindFolder(drive);
    const rootId = rootFolder.id;
    
    const opts = { 
      cache: 'no-store' as const,
      allDrives: true 
    };

    // Helper to build Google Drive API queries
    const qAnd = (conditions: string[]) => conditions.join(' and ');
    
    // Helper to find single file
    const findOne = async (parentId: string, name: string, options = opts) => {
      const response = await drive.files.list({
        q: qAnd([`'${parentId}' in parents`, `name='${name}'`, `trashed=false`]),
        fields: 'files(id, name, mimeType)',
        ...options
      });
      return response.data.files?.[0] || null;
    };

    // Helper to list all files/folders
    const listAll = async (query: string, options = opts): Promise<DriveFile[]> => {
      const response = await drive.files.list({
        q: query,
        fields: 'files(id, name, mimeType)',
        ...options
      });
      return (response.data.files || [])
        .filter((file): file is { id: string; name: string; mimeType?: string } => 
          Boolean(file.id && file.name)
        )
        .map(file => ({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType
        }));
    };

    // Helper to get JSON content
    const getJson = async (fileId: string) => {
      const response = await drive.files.get({
        fileId,
        alt: 'media'
      });
      return typeof response.data === 'object' ? response.data : JSON.parse(response.data as string);
    };

    // B) Fetch config file, settings file (metadata only), and root folders in parallel
    const [configFile, settingsFile, rootFolders] = await Promise.all([
      findOne(rootId, 'storygrind-config.json', opts),
      findOne(rootId, 'storygrind-settings.json', opts), // metadata only
      listAll(qAnd([`'${rootId}' in parents`, `mimeType='${FOLDER_MIME}'`, `trashed=false`]), opts),
    ]);

    // Only download config JSON (non-secret). Do NOT fetch settings content here.
    const configJson = configFile?.id ? await getJson(configFile.id).catch(() => null) : null;

    const config: Config = (configJson as Config) || {
      settings: {
        current_project: null,
        current_project_folder_id: null,
        storygrind_root_folder_id: rootId,
        tool_prompts_folder_id: null,
      },
      selectedApiProvider: '',
      selectedAiModel: '',
      author_name: 'Anonymous',
    };

    // Find tool-prompts folder
    const toolPromptsFolder = rootFolders.find(f => f.name === 'tool-prompts');
    const toolPromptsId = toolPromptsFolder?.id || null;

    // Find projects folder
    const projectsFolder = rootFolders.find(f => f.name === 'storygrind_projects');
    
    // Load projects and tool categories in parallel
    const [projects, toolCategories] = await Promise.all([
      projectsFolder 
        ? listAll(qAnd([`'${projectsFolder.id}' in parents`, `mimeType='${FOLDER_MIME}'`, `trashed=false`]), opts)
        : Promise.resolve([]),
      toolPromptsId
        ? listAll(qAnd([`'${toolPromptsId}' in parents`, `mimeType='${FOLDER_MIME}'`, `trashed=false`]), opts)
        : Promise.resolve([])
    ]);

    // Load tools for each category in parallel
    const toolsByCategory: Record<string, DriveFile[]> = {};
    if (toolCategories.length > 0) {
      const categoryToolPromises = toolCategories
        .filter(category => category.name) // Only process categories with valid names
        .map(async (category) => {
          const tools = await listAll(
            qAnd([`'${category.id}' in parents`, `trashed=false`]),
            opts
          );
          return { categoryName: category.name, tools };
        });

      const categoryResults = await Promise.all(categoryToolPromises);
      categoryResults.forEach(({ categoryName, tools }) => {
        if (categoryName) { // Additional safety check
          toolsByCategory[categoryName] = tools;
        }
      });
    }

    const durationMs = Date.now() - startTime;

    return {
      config: {
        ...config,
        settings: {
          ...config.settings,
          storygrind_root_folder_id: rootId,
          tool_prompts_folder_id: toolPromptsId,
        },
      },
      hasSettingsFile: Boolean(settingsFile), // boolean only
      projects,
      toolCategories,
      toolsByCategory,
      durationMs,
    };

  } catch (error) {
    console.error('Fast init error:', error);
    const durationMs = Date.now() - startTime;
    
    // Return minimal fallback data
    return {
      config: null,
      hasSettingsFile: false,
      projects: [],
      toolCategories: [],
      toolsByCategory: {},
      durationMs,
    };
  }
}