// app/lib/drive/fastInitServer.ts

'use server';

import { getAuthClient, getDriveClient, ensureProselenosProjectsFolder } from '@/lib/googleDrive';
import { drive_v3 } from 'googleapis'; // Import the Drive type for clarity

// REFACTOR STEP 1: Move the helper functions OUTSIDE of fastInitForUser.
// This is the core of the memory leak fix. These are now pure, stateless functions
// that do not create closures over the `drive` client.

// Helper to build Google Drive API queries (already stateless, no change needed)
const qAnd = (conditions: string[]) => conditions.join(' and ');

// Helper to find a single file. We now pass `drive` as an argument.
async function findOne(drive: drive_v3.Drive, parentId: string, name: string, options: any) {
  const response = await drive.files.list({
    q: qAnd([`'${parentId}' in parents`, `name='${name}'`, `trashed=false`]),
    fields: 'files(id, name, mimeType)',
    ...options
  });
  return response.data.files?.[0] || null;
};

// Helper to find a single file by appProperty
async function findOneByAppProperty(drive: drive_v3.Drive, parentId: string, key: string, value: string, options: any) {
  const response = await drive.files.list({
    q: qAnd([`appProperties has { key='${key}' and value='${value}' }`, `'${parentId}' in parents`, `trashed=false`]),
    fields: 'files(id, name, mimeType, appProperties)',
    ...options
  });
  const file = response.data.files?.[0] || null;
  if (file) {
    // console.log(`findOneByAppProperty: found ${key}=${value}`, { id: file.id, name: file.name, appProperties: (file as any).appProperties });
  } else {
    console.log(`findOneByAppProperty: not found ${key}=${value}`);
  }
  return file;
};

// Helper to list all files/folders. We now pass `drive` as an argument.
async function listAll(drive: drive_v3.Drive, query: string, options: any): Promise<DriveFile[]> {
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

// Helper to get JSON content. We now pass `drive` as an argument.
async function getJson(drive: drive_v3.Drive, fileId: string) {
  const response = await drive.files.get({
    fileId,
    alt: 'media'
  });
  return typeof response.data === 'object' ? response.data : JSON.parse(response.data as string);
};

// Type definitions (no changes needed)

const FOLDER_MIME = 'application/vnd.google-apps.folder';

export type Config = {
  settings: {
    current_project: string | null;
    current_project_folder_id: string | null;
    proselenos_root_folder_id: string;
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

// REFACTOR STEP 2: Update the main function to call the new helper functions.

export async function fastInitForUser(accessToken: string): Promise<InitPayloadForClient> {
  const memStart = process.memoryUsage().heapUsed / 1024 / 1024;
  const startTime = Date.now();
  
  try {
    const authClient = await getAuthClient(accessToken);
    const drive = await getDriveClient(authClient);

    const rootFolder = await ensureProselenosProjectsFolder(drive);
    const rootId = rootFolder.id;
    if (!rootId) {
      throw new Error('Could not determine the root folder ID for proselenos_projects.');
    }
    
    const opts = { 
      cache: 'no-store' as const,
      allDrives: true 
    };

    // B) Fetch config file, settings file (metadata only), and 
    //    root folders in parallel
    // We now pass `drive` explicitly to each helper function.
    const [configFile, settingsFile, rootFolders] = await Promise.all([
      findOneByAppProperty(drive, rootId, 'type', 'proselenos-config', opts),
      findOneByAppProperty(drive, rootId, 'type', 'proselenos-settings', opts), // metadata only
      listAll(drive, qAnd([`'${rootId}' in parents`, `mimeType='${FOLDER_MIME}'`, `trashed=false`]), opts),
    ]);

    // Only download config JSON (non-secret). Do NOT fetch settings content here.
    const configJson = configFile?.id ? await getJson(drive, configFile.id).catch(() => null) : null;

    const config: Config = (configJson as Config) || {
      settings: {
        current_project: null,
        current_project_folder_id: null,
        proselenos_root_folder_id: rootId,
        tool_prompts_folder_id: null,
      },
      selectedApiProvider: '',
      selectedAiModel: '',
      author_name: 'Anonymous',
    };

    const toolPromptsFolder = rootFolders.find(f => f.name === 'tool-prompts');
    const toolPromptsId = toolPromptsFolder?.id || null;

    // Load projects and tool categories in parallel
    const [projects, toolCategories] = await Promise.all([
      listAll(drive, qAnd([`'${rootId}' in parents`, `mimeType='${FOLDER_MIME}'`, `trashed=false`]), opts),
      toolPromptsId
        ? listAll(drive, qAnd([`'${toolPromptsId}' in parents`, `mimeType='${FOLDER_MIME}'`, `trashed=false`]), opts)
        : Promise.resolve([])
    ]);

    // Load tools for each category in parallel
    const toolsByCategory: Record<string, DriveFile[]> = {};
    if (toolCategories.length > 0) {
      const categoryToolPromises = toolCategories
        .filter(category => category.name)
        .map(async (category) => {
          // The `async` arrow function here is no longer a problem because it's calling
          // the external `listAll` function, not a closure from its parent scope.
          const tools = await listAll(
            drive, // Pass drive explicitly
            qAnd([`'${category.id}' in parents`, `trashed=false`]),
            opts
          );
          return { categoryName: category.name, tools };
        });

      const categoryResults = await Promise.all(categoryToolPromises);
      categoryResults.forEach(({ categoryName, tools }) => {
        if (categoryName) {
          toolsByCategory[categoryName] = tools;
        }
      });
    }

    const durationMs = Date.now() - startTime;
    const memEnd = process.memoryUsage().heapUsed / 1024 / 1024;
    console.log(`fastInit Memory: ${memStart.toFixed(1)}MB -> ${memEnd.toFixed(1)}MB (+${(memEnd - memStart).toFixed(1)}MB)`);

    return {
      config: {
        ...config,
        settings: {
          ...config.settings,
          proselenos_root_folder_id: rootId,
          tool_prompts_folder_id: toolPromptsId,
        },
      },
      hasSettingsFile: Boolean(settingsFile),
      projects,
      toolCategories,
      toolsByCategory,
      durationMs,
    };

  } catch (error) {
    console.error('Fast init error:', error);
    const durationMs = Date.now() - startTime;
    
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
