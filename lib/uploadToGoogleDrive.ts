// lib/uploadToGoogleDrive.ts
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

export async function uploadFolderToGoogleDrive(
  auth: any,
  localFolderPath: string,
  parentFolderId?: string,
  customFolderName?: string
) {
  const drive = google.drive({ version: 'v3', auth });
  const folderMap = new Map<string, string>();

  // Scan folder recursively
  function scan(dir: string, relativePath = ''): { folders: string[], files: string[] } {
    const result: { folders: string[], files: string[] } = { folders: [], files: [] };
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const relPath = relativePath ? path.join(relativePath, item) : item;
      
      if (fs.statSync(fullPath).isDirectory()) {
        result.folders.push(relPath);
        const sub = scan(fullPath, relPath);
        result.folders.push(...sub.folders);
        result.files.push(...sub.files);
      } else {
        result.files.push(relPath);
      }
    }
    return result;
  }

  const rootName = customFolderName || path.basename(localFolderPath);
  const { folders, files } = scan(localFolderPath);
  
  // Check if root folder already exists
  let rootFolderId: string;
  if (parentFolderId) {
    const existingFolderQuery = await drive.files.list({
      q: `name='${rootName}' and '${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id)',
    });

    if (existingFolderQuery.data.files && existingFolderQuery.data.files.length > 0) {
      // Use existing folder
      rootFolderId = existingFolderQuery.data.files[0].id!;
      console.log(`Using existing folder: ${rootName}`);
    } else {
      // Create root folder
      const rootFolder = await drive.files.create({
        requestBody: {
          name: rootName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentFolderId]
        },
        fields: 'id'
      });
      rootFolderId = rootFolder.data.id!;
      console.log(`Created new folder: ${rootName}`);
    }
  } else {
    // No parent folder specified - create in root
    const rootFolder = await drive.files.create({
      requestBody: {
        name: rootName,
        mimeType: 'application/vnd.google-apps.folder'
      },
      fields: 'id'
    });
    rootFolderId = rootFolder.data.id!;
  }
  
  folderMap.set('', rootFolderId);

  // Create all subfolders (sorted by depth)
  for (const folderPath of folders.sort((a, b) => a.split('/').length - b.split('/').length)) {
    const name = path.basename(folderPath);
    const parentPath = path.dirname(folderPath);
    const parentId = parentPath === '.' ? rootFolderId : folderMap.get(parentPath);
    
    // Check if subfolder already exists
    const existingSubfolderQuery = await drive.files.list({
      q: `name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id)',
    });

    let subFolderId: string;
    if (existingSubfolderQuery.data.files && existingSubfolderQuery.data.files.length > 0) {
      // Use existing subfolder
      subFolderId = existingSubfolderQuery.data.files[0].id!;
      console.log(`Using existing subfolder: ${name}`);
    } else {
      // Create new subfolder
      const folder = await drive.files.create({
        requestBody: {
          name,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentId!]
        },
        fields: 'id'
      });
      subFolderId = folder.data.id!;
      console.log(`Created new subfolder: ${name}`);
    }
    
    folderMap.set(folderPath, subFolderId);
  }

  // Upload all files in one batch
  const uploads = files.map(filePath => {
    const parentPath = path.dirname(filePath);
    const parentId = parentPath === '.' ? rootFolderId : folderMap.get(parentPath);
    const fullPath = path.join(localFolderPath, filePath);
    
    return drive.files.create({
      requestBody: {
        name: path.basename(filePath),
        parents: [parentId!]
      },
      media: {
        body: fs.createReadStream(fullPath)
      },
      fields: 'id'
    });
  });

  // Single batch upload
  await Promise.all(uploads);
  
  console.log(`✅ Uploaded ${files.length} files and created ${folders.length + 1} folders`);

  return { 
    success: true, 
    rootFolderId: rootFolderId,
    filesUploaded: files.length,
    foldersCreated: folders.length + 1
  };
}