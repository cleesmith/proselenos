// lib/epub-conversion-actions.ts
'use server';

import {
  getAuthClient,
  getDriveClient,
  uploadManuscript,
  listFilesAndFolders
} from '@/lib/googleDrive';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import xpath from 'xpath';

type ActionResult<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

interface ChapterData {
  title: string;
  textBlocks: string[];
}

interface EpubProcessingResult {
  chapters: ChapterData[];
  success: boolean;
}

async function getAuthenticatedClients(accessToken: string) {
  if (!accessToken) {
    return { error: 'Not authenticated' };
  }

  const authClient = await getAuthClient(accessToken);
  const drive = await getDriveClient(authClient);
  
  return {
    authClient,
    drive
  };
}

// Convert EPUB file to plain text and save to project folder
export async function convertEpubToTextAction(
  accessToken: string,
  epubFileId: string,
  outputFileName: string,
  projectFolderId: string
): Promise<ActionResult<{ fileId: string; fileName: string; chapterCount: number; wordCount: number }>> {
  try {
    const clients = await getAuthenticatedClients(accessToken);
    if ('error' in clients) {
      return { success: false, error: clients.error };
    }

    const { drive } = clients;
    
    if (!epubFileId || !outputFileName || !projectFolderId) {
      return { success: false, error: 'Missing required parameters' };
    }

    // Ensure output filename has .txt extension
    let finalOutputName = outputFileName.trim();
    if (!finalOutputName.toLowerCase().endsWith('.txt')) {
      finalOutputName += '.txt';
    }

    try {
      // Get the EPUB file metadata to retrieve the original filename
      const metadata = await drive.files.get({
        fileId: epubFileId,
        fields: 'name,size'
      });
      const epubFileName = (metadata.data && 'name' in metadata.data) ? metadata.data.name as string : epubFileId;
      
      // Check file size first to prevent memory issues
      const fileSize = metadata.data && 'size' in metadata.data ? parseInt(metadata.data.size as string) : 0;
      const fileSizeInMB = fileSize / (1024 * 1024);
      
      if (fileSizeInMB > 10) {
        return {
          success: false,
          error: `File too large (${fileSizeInMB.toFixed(1)}MB). Please use files smaller than 10MB.`
        };
      }

      // Download the EPUB file from Google Drive
      const response = await drive.files.get({
        fileId: epubFileId,
        alt: 'media'
      }, {
        responseType: 'arraybuffer'
      });

      if (!response.data) {
        throw new Error('Failed to download EPUB file');
      }

      // Convert ArrayBuffer to Buffer for processing
      const buffer = Buffer.from(response.data as ArrayBuffer);
      
      // Process the EPUB file
      const result = await processEpub(buffer);

      if (result.chapters.length === 0) {
        return {
          success: false,
          error: 'No chapters found in EPUB file'
        };
      }

      // Generate text content
      let allText = '';
      result.chapters.forEach((ch) => {
        if (ch.title) {
          allText += ch.title + '\n\n';
        }
        allText += ch.textBlocks.join('\n\n') + '\n\n';
      });

      // Create output filename with timestamp
      const timestamp = new Date().toISOString().replace(/[-:.]/g, '').substring(0, 15);
      const baseFileName = epubFileName.replace('.epub', '');
      const timestampedOutputName = `${baseFileName}_${timestamp}.txt`;

      // Save to Google Drive
      const file = await uploadManuscript(
        drive,
        allText,
        projectFolderId,
        timestampedOutputName
      );
      
      return { 
        success: true, 
        data: {
          fileId: file.id,
          fileName: file.name || timestampedOutputName,
          chapterCount: result.chapters.length,
          wordCount: countWords(allText)
        },
        message: `Successfully converted EPUB to text with ${result.chapters.length} chapters (${countWords(allText)} words).` 
      };

    } catch (conversionError: any) {
      console.error('EPUB conversion error:', conversionError);
      return { 
        success: false, 
        error: `Conversion failed: ${conversionError.message || 'Unknown error'}` 
      };
    }

  } catch (error: any) {
    console.error('Error in convertEpubToTextAction:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to convert EPUB file' 
    };
  }
}

// Process an EPUB file
async function processEpub(fileData: Buffer): Promise<EpubProcessingResult> {
  try {
    const zip = await JSZip.loadAsync(fileData);
    
    // 1. locate the OPF file via META-INF/container.xml
    const containerFile = zip.file("META-INF/container.xml");
    if (!containerFile) throw new Error("META-INF/container.xml not found.");
    
    const containerXml = await containerFile.async("text");
    const containerDoc = new DOMParser().parseFromString(containerXml, "application/xml");
    
    const rootfileElement = containerDoc.getElementsByTagName("rootfile")[0];
    if (!rootfileElement) throw new Error("OPF file reference not found.");
    
    const opfPath = rootfileElement.getAttribute("full-path");
    if (!opfPath) throw new Error("OPF file path is missing.");
    
    // Get the base path (e.g. if opfPath is "OEBPS/content.opf", base = "OEBPS/")
    const basePath = opfPath.includes("/") ? opfPath.substring(0, opfPath.lastIndexOf("/") + 1) : "";

    // 2. read the OPF file
    const opfFile = zip.file(opfPath);
    if (!opfFile) throw new Error("OPF file not found: " + opfPath);
    
    const opfXml = await opfFile.async("text");
    const opfDoc = new DOMParser().parseFromString(opfXml, "application/xml");

    // 3. build a manifest (id → href)
    const manifest: Record<string, string> = {};
    const items = opfDoc.getElementsByTagName("item");
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const id = item.getAttribute("id");
      const href = item.getAttribute("href");
      if (id && href) {
        manifest[id] = href;
      }
    }

    // 4. get the spine (reading order)
    const spineItems: string[] = [];
    const itemrefs = opfDoc.getElementsByTagName("itemref");
    for (let i = 0; i < itemrefs.length; i++) {
      const itemref = itemrefs[i];
      const idref = itemref.getAttribute("idref");
      if (idref && manifest[idref]) {
        spineItems.push(manifest[idref]);
      }
    }

    // 5. process each chapter file from the spine
    const chapters: ChapterData[] = [];
    
    // Define a list of unwanted titles
    const unwantedTitles = ["TITLE PAGE", "COPYRIGHT"];

    for (const itemHref of spineItems) {
      const chapterPath = basePath + itemHref;
      const chapterFile = zip.file(chapterPath);
      
      if (!chapterFile) {
        continue;
      }
      
      const chapterContent = await chapterFile.async("text");
      
      // Parse the chapter content into a DOM
      const doc = new DOMParser().parseFromString(chapterContent, "text/html");
      
      // Extract and store the title from the first <h1>
      let title = "";
      const h1Elements = doc.getElementsByTagName("h1");
      if (h1Elements.length > 0) {
        title = h1Elements[0].textContent?.trim() || "";
        
        // Filter out unwanted titles
        if (unwantedTitles.includes(title.toUpperCase())) {
          continue;
        }
      }
      
      // Extract the body text
      let bodyText = "";
      const bodyElements = doc.getElementsByTagName("body");
      if (bodyElements.length > 0) {
        bodyText = bodyElements[0].textContent?.trim() || "";
      }
      
      // Split into paragraphs
      const textBlocks = bodyText.split(/\n\s*\n/).filter(block => block.trim() !== "");
      
      // Special handling for CONTENTS page
      if (title.toUpperCase() === "CONTENTS") {
        for (let i = 0; i < textBlocks.length; i++) {
          // If a line is non-empty and does not start with whitespace, add an indent
          if (textBlocks[i].trim() && !/^\s/.test(textBlocks[i])) {
            textBlocks[i] = "        " + textBlocks[i];
          }
        }
      }
      
      // If no title and content is too short, skip this chapter
      if (!title && textBlocks.join("").length < 100) {
        continue;
      }
      
      chapters.push({
        title: title,
        textBlocks: textBlocks
      });
    }

    return {
      chapters: chapters,
      success: true
    };
  } catch (error) {
    console.error('Error processing EPUB:', error);
    throw error;
  }
}

// Count words in text
function countWords(text: string): number {
  return text.split(/\s+/).filter(word => word.length > 0).length;
}

// List EPUB files in a project folder
export async function listEpubFilesAction(accessToken: string, projectFolderId: string): Promise<ActionResult> {
  try {
    const clients = await getAuthenticatedClients(accessToken);
    if ('error' in clients) {
      return { success: false, error: clients.error };
    }

    const { drive } = clients;
    
    if (!projectFolderId) {
      return { success: false, error: 'Project folder ID is required' };
    }

    // Get all files in the project folder
    const allFiles = await listFilesAndFolders(drive, projectFolderId);
    
    // Filter for EPUB files
    const epubFiles = allFiles.filter((file: any) => 
      file.name.toLowerCase().endsWith('.epub') &&
      file.mimeType !== 'application/vnd.google-apps.folder'
    );
    
    return { 
      success: true, 
      data: { files: epubFiles },
      message: `Found ${epubFiles.length} EPUB files` 
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to list EPUB files' };
  }
}