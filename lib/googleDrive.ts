// lib/googleDrive.ts

'use server';

import { google, drive_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { Readable } from 'stream';

/**
 * Creates a fully configured OAuth2 client.
 */
export async function getAuthClient(accessToken: string): Promise<OAuth2Client> { // <-- ADDED async/Promise
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
  });

  return oauth2Client;
}

/**
 * Creates a Google Drive API client.
 * This function now includes the memory leak fix.
 */
export async function getDriveClient(authClient: OAuth2Client): Promise<drive_v3.Drive> { // <-- ADDED async/Promise
  const drive = google.drive({
    version: 'v3',
    auth: authClient,
  });

  return drive;
}

/**
 * Ensures the 'proselenos_projects' folder exists in Google Drive, creating it if necessary.
 * @param drive - An authenticated Google Drive API client.
 * @returns The file metadata for the 'proselenos_projects' folder.
 */
export async function ensureProselenosProjectsFolder(drive: drive_v3.Drive): Promise<drive_v3.Schema$File> {
  const FOLDER_MIME = 'application/vnd.google-apps.folder';
  const FOLDER_NAME = 'proselenos_projects';

  // test google scopes and 403 error:
  // throw Object.assign(new Error('Request had insufficient authentication scopes. [FORCED 403]'), { code: 403, status: 403 });

  try {
    // Search for the folder
    const res = await drive.files.list({
      q: `mimeType='${FOLDER_MIME}' and name='${FOLDER_NAME}' and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    const files = res.data.files ?? [];
    if (files.length > 0) {
      // Folder exists, return it
      return files[0]!;
    } else {
      // Folder does not exist, create it
      const fileMetadata = {
        name: FOLDER_NAME,
        mimeType: FOLDER_MIME,
      };
      const createdFolder = await drive.files.create({
        requestBody: fileMetadata,
        fields: 'id, name',
      });
      return createdFolder.data;
    }
  } catch (error) {
    console.error('Error ensuring proselenos_projects folder exists:', error);
    throw new Error('Could not find or create the proselenos_projects folder in Google Drive.');
  }
}


// 2. Create project folder
export async function createProjectFolder(drive: any, projectName: string, parentFolderId: string) {
  const fileMetadata = {
    name: projectName,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [parentFolderId]
  };

  const folder = await drive.files.create({
    resource: fileMetadata,
    fields: 'id, name'
  });

  return folder.data;
}

// 3. Upload/Update manuscript.txt
/**
 * Uploads manuscript content to a file in Google Drive.
 * Updates the file if it exists, otherwise creates a new one.
 * @param drive The authenticated Google Drive API client.
 * @param content The text content of the manuscript.
 * @param projectFolderId The ID of the parent folder in Google Drive.
 * @param fileName The name for the file (defaults to 'manuscript.txt').
 * @returns The metadata of the created or updated file.
 */
export async function uploadManuscript(
  drive: drive_v3.Drive,
  content: string,
  projectFolderId: string,
  fileName = 'manuscript.txt'
): Promise<drive_v3.Schema$File> {
  try {
    // 1. Check if the file already exists
    const query = `'${fileName}' in name and '${projectFolderId}' in parents and trashed = false`;
    const listResponse = await drive.files.list({
      q: query,
      fields: 'files(id)',
      pageSize: 1,
    });

    const existingFile = listResponse.data.files?.[0];

    // Prepare the content for upload as a stream.
    // A new stream is needed for each API call as they are consumed on use.
    const createContentStream = () => {
        const stream = new Readable();
        stream.push(content);
        stream.push(null); // Signal end of stream
        return stream;
    };

    if (existingFile?.id) {
      // 2. If it exists, UPDATE the file content
      console.log(`Updating existing file: ${fileName} (ID: ${existingFile.id})`);
      const response = await drive.files.update({
        fileId: existingFile.id,
        media: {
          mimeType: 'text/plain',
          body: createContentStream(),
        },
        fields: 'id, name, modifiedTime',
      });
      return response.data;

    } else {
      // 3. If it does not exist, CREATE a new file
      console.log(`Creating new file: ${fileName}`);
      const fileMetadata: drive_v3.Schema$File = {
        name: fileName,
        parents: [projectFolderId],
      };
      const response = await drive.files.create({
        requestBody: fileMetadata, // Use 'requestBody' instead of 'resource'
        media: {
          mimeType: 'text/plain',
          body: createContentStream(),
        },
        fields: 'id, name, modifiedTime',
      });
      return response.data;
    }
  } catch (err) {
    console.error('Error during manuscript upload:', err);
    throw new Error('Failed to upload manuscript to Google Drive.');
  }
}

// Direct file creation - no existence check needed for unique filenames (like tool reports with timestamps)
/**
 * Creates a new file in a specific Google Drive folder with the given content.
 * @param drive The authenticated Google Drive API client.
 * @param content The text content of the file.
 * @param projectFolderId The ID of the parent folder in Google Drive.
 * @param fileName The name for the new file.
 * @returns The metadata of the created file.
 */
export async function createNewFile(drive: drive_v3.Drive, content: string, projectFolderId: string, fileName:string): Promise<drive_v3.Schema$File> {
  // In a server environment, it's more memory-efficient to stream the upload body
  // rather than passing the entire string directly.
  const contentStream = new Readable();
  contentStream.push(content);
  contentStream.push(null); // This signals the end of the stream.

  const fileMetadata: drive_v3.Schema$File = {
    name: fileName,
    parents: [projectFolderId],
    // You could also specify a different mimeType here if creating a Google Doc, etc.
    // mimeType: 'application/vnd.google-apps.document',
  };

  const media = {
    mimeType: 'text/plain',
    body: contentStream,
  };

  try {
    const response = await drive.files.create({
      // 'requestBody' is the modern and correctly typed parameter for file metadata.
      // The older 'resource' parameter is deprecated.
      requestBody: fileMetadata,
      media: media,
      fields: 'id, name, modifiedTime', // Specify which fields to return
    });

    // console.log('File created:', response.data);
    return response.data;

  } catch (err) {
    // It's good practice to catch and log errors on the server.
    console.error('Error creating Google Drive file:', err);
    throw new Error('Failed to create file in Google Drive.');
  }
}

// 4. Create report file
export async function createReport(drive: any, reportContent: string, projectFolderId: string, reportName: string) {
  const fileMetadata = {
    name: reportName,
    parents: [projectFolderId]
  };

  const media = {
    mimeType: 'text/plain',
    body: reportContent
  };

  const response = await drive.files.create({
    resource: fileMetadata,
    media: media,
    fields: 'id, name, createdTime'
  });

  return response.data;
}

// 5. Read file content
export async function readTextFile(drive: any, fileId: string) {
  const response = await drive.files.get({
    fileId: fileId,
    alt: 'media'
  });

  return response.data; // Returns the text content
}

// 6. List all projects
export async function listProjects(drive: any, parentFolderId: string) {
  const response = await drive.files.list({
    q: `'${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name, modifiedTime)',
    orderBy: 'modifiedTime desc'
  });

  return response.data.files;
}

// 7. List files in project
export async function listProjectFiles(drive: any, projectFolderId: string) {
  const response = await drive.files.list({
    q: `'${projectFolderId}' in parents and mimeType!='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name, mimeType, modifiedTime, size)',
    orderBy: 'name'
  });

  return response.data.files;
}

// List both files and folders in a directory
export async function listFilesAndFolders(drive: any, folderId: string) {
  const response = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: 'files(id, name, mimeType, modifiedTime, size)',
    orderBy: 'modifiedTime desc' // Sort by newest first
  });

  // Sort folders first, then files, but maintain newest-first within each group
  const files = response.data.files || [];
  return files.sort((a: any, b: any) => {
    const aIsFolder = a.mimeType === 'application/vnd.google-apps.folder';
    const bIsFolder = b.mimeType === 'application/vnd.google-apps.folder';
    
    // If both are same type (both folders or both files), sort by modified time (newest first)
    if (aIsFolder === bIsFolder) {
      const aTime = new Date(a.modifiedTime || 0).getTime();
      const bTime = new Date(b.modifiedTime || 0).getTime();
      return bTime - aTime; // newest first
    }
    
    // Otherwise, folders first
    if (aIsFolder && !bIsFolder) return -1;
    if (!aIsFolder && bIsFolder) return 1;
    return 0;
  });
}

// Get folder info by ID
export async function getFolderInfo(drive: any, folderId: string) {
  const response = await drive.files.get({
    fileId: folderId,
    fields: 'id, name, parents'
  });

  return response.data;
}

// 8. Download file
export async function downloadFile(drive: any, fileId: string) {
  const response = await drive.files.get({
    fileId: fileId,
    alt: 'media'
  }, {
    responseType: 'stream'
  });

  return response.data;
}

// 9. Delete file or folder
export async function deleteFile(drive: any, fileId: string) {
  await drive.files.delete({
    fileId: fileId
  });
}

// Google Docs Functions

// Create a Google Doc in proselenos_projects folder
export async function createGoogleDoc(drive: any, docs: any, title: string, parentFolderId: string, initialContent = 'Welcome to your new document!\n\nStart writing your story here...') {
  // First create empty Google Doc
  const fileMetadata = {
    name: title,
    mimeType: 'application/vnd.google-apps.document',
    parents: [parentFolderId]
  };

  const doc = await drive.files.create({
    resource: fileMetadata,
    fields: 'id, name, createdTime'
  });

  // Add initial content using Docs API
  if (initialContent && doc.data.id) {
    try {
      await docs.documents.batchUpdate({
        documentId: doc.data.id,
        resource: {
          requests: [
            {
              insertText: {
                location: { index: 1 },
                text: initialContent
              }
            }
          ]
        }
      });
    } catch (error) {
      console.error('Error adding initial content:', error);
      // Don't fail the whole operation if content addition fails
    }
  }
  
  return doc.data;
}

// Read Google Doc content as plain text (using Drive export)
export async function readGoogleDoc(drive: any, documentId: string) {
  try {
    // Use Drive API to export the document as plain text
    const response = await drive.files.export({
      fileId: documentId,
      mimeType: 'text/plain'
    });

    return response.data;
  } catch (error) {
    console.error('Error reading Google Doc:', error);
    throw error;
  }
}

// Extract just the text content from Google Doc
function extractPlainText(document: any) {
  let plainText = '';
  
  if (document.body && document.body.content) {
    for (const element of document.body.content) {
      if (element.paragraph) {
        for (const textElement of element.paragraph.elements || []) {
          if (textElement.textRun) {
            plainText += textElement.textRun.content;
          }
        }
      }
    }
  }
  
  return plainText.trim();
}

// List Google Docs in a folder (filter by mimeType)
export async function listGoogleDocsInFolder(drive: any, folderId: string) {
  const response = await drive.files.list({
    q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.document' and trashed=false`,
    fields: 'files(id, name, mimeType, modifiedTime)',
    orderBy: 'modifiedTime desc'
  });

  return response.data.files;
}

// Configuration Management
export interface proselenosConfig {
  settings: {
    current_project: string | null;
    current_project_folder_id: string | null;
    proselenos_root_folder_id: string;
  };
  selectedApiProvider: string;
  selectedAiModel: string;
  author_name: string;
}

// Get or create the proselenos-config.json file
export async function getproselenosConfig(drive: any, rootFolderId: string): Promise<proselenosConfig> {
  const configFileName = 'proselenos-config.json';
  
  // Look for existing config file
  const query = `name='${configFileName}' and '${rootFolderId}' in parents and trashed=false`;
  const response = await drive.files.list({
    q: query,
    fields: 'files(id, name)'
  });

  if (response.data.files.length > 0) {
    // Read existing config - use direct API call for JSON files
    try {
      const configResponse = await drive.files.get({
        fileId: response.data.files[0].id,
        alt: 'media'
      });
      
      // Handle different response formats
      let configContent = configResponse.data;
      if (typeof configContent === 'object' && configContent !== null) {
        // If it's already an object, use it directly
        return configContent as proselenosConfig;
      } else if (typeof configContent === 'string') {
        // If it's a string, parse it
        return JSON.parse(configContent);
      } else {
        throw new Error('Unexpected config file format');
      }
    } catch (error) {
      console.error('Error reading config file:', error);
      // If config is corrupted, create a new default one
    }
  }

  // Create default config
  const defaultConfig: proselenosConfig = {
    settings: {
      current_project: null,
      current_project_folder_id: null,
      proselenos_root_folder_id: rootFolderId
    },
    selectedApiProvider: "",
    selectedAiModel: "",
    author_name: "Anonymous"
  };

  await saveproselenosConfig(drive, rootFolderId, defaultConfig);
  return defaultConfig;
}

// Save the proselenos-config.json file
export async function saveproselenosConfig(drive: any, rootFolderId: string, config: proselenosConfig): Promise<void> {
  const configFileName = 'proselenos-config.json';
  const configContent = JSON.stringify(config, null, 2);
  
  // Look for existing config file
  const query = `name='${configFileName}' and '${rootFolderId}' in parents and trashed=false`;
  const response = await drive.files.list({
    q: query,
    fields: 'files(id)'
  });

  const media = {
    mimeType: 'text/plain',
    body: configContent
  };

  if (response.data.files.length > 0) {
    // Update existing
    await drive.files.update({
      fileId: response.data.files[0].id,
      media: media
    });
  } else {
    // Create new
    const fileMetadata = {
      name: configFileName,
      parents: [rootFolderId]
    };

    await drive.files.create({
      resource: fileMetadata,
      media: media
    });
  }
}

// Update config when user selects a project
export async function updateCurrentProject(drive: any, rootFolderId: string, projectName: string, projectFolderId: string): Promise<void> {
  const config = await getproselenosConfig(drive, rootFolderId);
  config.settings.current_project = projectName;
  config.settings.current_project_folder_id = projectFolderId;
  await saveproselenosConfig(drive, rootFolderId, config);
}

// Update config when user changes AI provider and model settings
export async function updateProviderAndModel(drive: any, rootFolderId: string, provider: string, model: string): Promise<void> {
  const config = await getproselenosConfig(drive, rootFolderId);
  config.selectedApiProvider = provider;
  config.selectedAiModel = model;
  await saveproselenosConfig(drive, rootFolderId, config);
}

export async function updateSelectedModel(drive: any, rootFolderId: string, model: string): Promise<void> {
  const config = await getproselenosConfig(drive, rootFolderId);
  config.selectedAiModel = model;
  await saveproselenosConfig(drive, rootFolderId, config);
}

// Check if tool-prompts folder exists in Google Drive
export async function checkToolPromptsExists(drive: any, rootFolderId: string): Promise<boolean> {
  try {
    const response = await drive.files.list({
      q: `name='tool-prompts' and '${rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id)',
    });
    return Boolean(response.data.files && response.data.files.length > 0);
  } catch (error) {
    console.error('Error checking tool-prompts folder existence:', error);
    return false;
  }
}

// Clear current project (when project is deleted or invalid)
export async function clearCurrentProject(drive: any, rootFolderId: string): Promise<void> {
  const config = await getproselenosConfig(drive, rootFolderId);
  config.settings.current_project = null;
  config.settings.current_project_folder_id = null;
  await saveproselenosConfig(drive, rootFolderId, config);
}

// -----------------------------------------------------------------------------
// withDrive helper: builds a short-lived Drive client for a single action and
// ensures cleanup via an AbortController. This function does not modify any
// existing logic; it simply provides an alternative way to run Drive operations
// using an access token (and optional refresh/expiry) without creating long-lived
// objects. It is safe to add and will not affect current exports.
// -----------------------------------------------------------------------------
export async function withDrive<T>(
  tokens: { access_token: string; refresh_token?: string; expiry_date?: number },
  action: (drive: drive_v3.Drive, ac: AbortController) => Promise<T>
): Promise<T> {
  // Create a fresh OAuth2 client for this action
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  oauth2Client.setCredentials(tokens);
  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  const ac = new AbortController();
  try {
    return await action(drive, ac);
  } finally {
    // Abort any pending requests created during this action
    ac.abort();
  }
}

// Validate that current project still exists on Drive
export async function validateCurrentProject(drive: any, rootFolderId: string): Promise<boolean> {
  const config = await getproselenosConfig(drive, rootFolderId);
  
  if (!config.settings.current_project_folder_id) {
    return false;
  }

  try {
    await drive.files.get({
      fileId: config.settings.current_project_folder_id,
      fields: 'id, name, trashed'
    });
    return true;
  } catch (error) {
    // Project doesn't exist or is trashed
    await clearCurrentProject(drive, rootFolderId);
    return false;
  }
}

// Project Metadata Functions

// Metadata field mapping to filenames
const METADATA_FILES = {
  title: '_title.txt',
  author: '_author.txt',
  publisher: '_publisher.txt',
  buyUrl: '_buy_url.txt',
  copyright: '_copyright.txt',
  dedication: '_dedication.txt',
  aboutAuthor: '_about_author.txt',
  pov: '_pov.txt'
} as const;

export interface ProjectMetadata {
  title: string;
  author: string;
  publisher: string;
  buyUrl: string;
  copyright: string;
  dedication: string;
  aboutAuthor: string;
  pov: string;
}

// Ensure metadata folder exists in project
export async function ensureMetadataFolder(drive: any, projectFolderId: string) {
  const folderName = 'metadata';
  const query = `name='${folderName}' and '${projectFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  
  const response = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    spaces: 'drive'
  });

  if (response.data.files.length > 0) {
    return { id: response.data.files[0].id, name: folderName };
  }

  // Create if doesn't exist
  const fileMetadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [projectFolderId]
  };

  const folder = await drive.files.create({
    resource: fileMetadata,
    fields: 'id'
  });

  return { id: folder.data.id, name: folderName };
}

// Load all metadata files for a project
export async function loadProjectMetadata(drive: any, projectFolderId: string): Promise<ProjectMetadata> {
  const defaultMetadata: ProjectMetadata = {
    title: '',
    author: '',
    publisher: '',
    buyUrl: '',
    copyright: '',
    dedication: '',
    aboutAuthor: '',
    pov: ''
  };

  try {
    // First ensure metadata folder exists
    const metadataFolder = await ensureMetadataFolder(drive, projectFolderId);
    
    // Get all metadata files in one API call
    const response = await drive.files.list({
      q: `'${metadataFolder.id}' in parents and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive'
    });

    const files = response.data.files || [];
    const metadata = { ...defaultMetadata };

    // Read all files in parallel
    const readPromises = files.map(async (file: any) => {
      try {
        const content = await readTextFile(drive, file.id);
        
        // Map filename to metadata field
        const field = Object.keys(METADATA_FILES).find(
          key => METADATA_FILES[key as keyof typeof METADATA_FILES] === file.name
        ) as keyof ProjectMetadata;
        
        if (field) {
          metadata[field] = content || '';
        }
      } catch (error) {
        console.error(`Error reading metadata file ${file.name}:`, error);
      }
    });

    await Promise.all(readPromises);
    return metadata;
    
  } catch (error) {
    console.error('Error loading project metadata:', error);
    return defaultMetadata;
  }
}

// Save all metadata files for a project
export async function saveProjectMetadata(drive: any, projectFolderId: string, metadata: ProjectMetadata): Promise<void> {
  try {
    // Ensure metadata folder exists
    const metadataFolder = await ensureMetadataFolder(drive, projectFolderId);
    
    // Save all metadata files in parallel
    const savePromises = Object.entries(metadata).map(async ([field, content]) => {
      const fileName = METADATA_FILES[field as keyof typeof METADATA_FILES];
      if (!fileName) return;

      try {
        // Check if file exists
        const query = `name='${fileName}' and '${metadataFolder.id}' in parents and trashed=false`;
        const existing = await drive.files.list({
          q: query,
          fields: 'files(id)'
        });

        const media = {
          mimeType: 'text/plain',
          body: content || ''
        };

        if (existing.data.files.length > 0) {
          // Update existing file
          await drive.files.update({
            fileId: existing.data.files[0].id,
            media: media
          });
        } else {
          // Create new file
          const fileMetadata = {
            name: fileName,
            parents: [metadataFolder.id]
          };

          await drive.files.create({
            resource: fileMetadata,
            media: media
          });
        }
      } catch (error) {
        console.error(`Error saving metadata file ${fileName}:`, error);
      }
    });

    await Promise.all(savePromises);
    
  } catch (error) {
    console.error('Error saving project metadata:', error);
    throw error;
  }
}
