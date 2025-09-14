// lib/docx-conversion-actions.ts

'use server';

// Session is now passed as accessToken parameter
import {
  getAuthClient,
  getDriveClient,
  readTextFile,
  uploadManuscript,
  listFilesAndFolders
} from '@/lib/googleDrive';
// Import types and withDrive to provide adapter wrappers without changing existing logic
import type { drive_v3 } from 'googleapis';
import { withDrive } from '@/lib/googleDrive';
import * as mammoth from 'mammoth';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { Readable } from 'stream';

type ActionResult<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

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

// Helper function to create a readable stream from buffer
function bufferToStream(buffer: Buffer): Readable {
  const readable = new Readable();
  readable.push(buffer);
  readable.push(null);
  return readable;
}

// List DOCX files in a project folder
// export async function listDocxFilesAction(accessToken: string, projectFolderId: string): Promise<ActionResult> {
//   try {
//     const clients = await getAuthenticatedClients(accessToken);
//     if ('error' in clients) {
//       return { success: false, error: clients.error };
//     }

//     const { drive } = clients;
    
//     if (!projectFolderId) {
//       return { success: false, error: 'Project folder ID is required' };
//     }

//     // Get all files in the project folder
//     const allFiles = await listFilesAndFolders(drive, projectFolderId);
    
//     // Filter for DOCX files
//     const docxFiles = allFiles.filter((file: any) => 
//       file.name.toLowerCase().endsWith('.docx') &&
//       file.mimeType !== 'application/vnd.google-apps.folder'
//     );
    
//     return { 
//       success: true, 
//       data: { files: docxFiles },
//       message: `Found ${docxFiles.length} DOCX files` 
//     };
//   } catch (error: any) {
//     return { success: false, error: error.message || 'Failed to list DOCX files' };
//   }
// }
export async function listDocxFilesAction(
  accessToken: string,
  projectFolderId: string
): Promise<ActionResult> {
  try {
    return await withDriveFromAccessToken(accessToken, async (drive /*, ac */) => {
      // Validation check
      if (!projectFolderId) {
        throw new Error('Project folder ID is required');
      }

      // Grab all files and filter for DOCX
      const allFiles = await listFilesAndFolders(drive, projectFolderId);
      const docxFiles = allFiles.filter((file: any) =>
        file.name.toLowerCase().endsWith('.docx') &&
        file.mimeType !== 'application/vnd.google-apps.folder'
      );

      // Return the same ActionResult shape as before
      return {
        success: true,
        data: { files: docxFiles },
        message: `Found ${docxFiles.length} DOCX files`
      };
    });
  } catch (error: any) {
    // Any thrown error (including from validation) ends up here
    return { success: false, error: error.message || 'Failed to list DOCX files' };
  }
}


// List TXT files in a project folder
export async function listTxtFilesAction(accessToken: string, projectFolderId: string): Promise<ActionResult> {
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
    
    // Filter for TXT files
    const txtFiles = allFiles.filter((file: any) => 
      (file.name.toLowerCase().endsWith('.txt') || 
       file.mimeType === 'text/plain' ||
       file.mimeType === 'application/vnd.google-apps.document') &&
      file.mimeType !== 'application/vnd.google-apps.folder'
    );
    
    return { 
      success: true, 
      data: { files: txtFiles },
      message: `Found ${txtFiles.length} text files` 
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to list TXT files' };
  }
}

// Convert DOCX file to TXT
export async function convertDocxToTxtAction(
  accessToken: string,
  docxFileId: string,
  outputFileName: string,
  projectFolderId: string
): Promise<ActionResult> {
  try {
    const clients = await getAuthenticatedClients(accessToken);
    if ('error' in clients) {
      return { success: false, error: clients.error };
    }
    const { drive } = clients;
    
    if (!docxFileId || !outputFileName || !projectFolderId) {
      return { success: false, error: 'Missing required parameters' };
    }
    // Ensure output filename has .txt extension
    let finalOutputName = outputFileName.trim();
    if (!finalOutputName.toLowerCase().endsWith('.txt')) {
      finalOutputName += '.txt';
    }
    try {
      // Download the DOCX file from Google Drive
      const response = await drive.files.get({
        fileId: docxFileId,
        alt: 'media'
      }, {
        responseType: 'arraybuffer'
      });
      if (!response.data) {
        throw new Error('Failed to download DOCX file');
      }
      // Convert ArrayBuffer to Buffer for mammoth
      const buffer = Buffer.from(response.data as ArrayBuffer);
      
      // DOCX to HTML conversion code
      const mammoth = require('mammoth');
      const jsdom = require('jsdom');
      const { JSDOM } = jsdom;
      
      // Load the docx file
      const result = await mammoth.convertToHtml({ buffer });
      const htmlContent = result.value;
      
      // Parse the HTML
      const dom = new JSDOM(htmlContent);
      const document = dom.window.document;
      
      // Get all block elements
      const blocks = document.querySelectorAll("p, h1, h2, h3, h4, h5, h6") as NodeListOf<HTMLElement>;
      
      // Process blocks to extract chapters
      let chapters: any[] = [];
      let currentChapter: any = null;
      let ignoreFrontMatter = true;
      let ignoreRest = false;
      
      // Stop headings
      const STOP_TITLES = ["about the author", "website", "acknowledgments", "appendix"];
      
      // Convert NodeList to Array for iteration
      Array.from(blocks).forEach((block: HTMLElement) => {
        if (ignoreRest) return;
        
        const tagName = block.tagName.toLowerCase();
        const textRaw = block.textContent?.trim() || '';
        const textLower = textRaw.toLowerCase();
        
        // Skip everything until first <h1>
        if (ignoreFrontMatter) {
          if (tagName === "h1") {
            ignoreFrontMatter = false;
          } else {
            return;
          }
        }
        
        // If this heading is a "stop" heading, ignore the rest
        if (tagName.startsWith("h") && STOP_TITLES.some(title => textLower.startsWith(title))) {
          ignoreRest = true;
          return;
        }
        
        // If we see a new <h1>, that means a new chapter
        if (tagName === "h1") {
          currentChapter = {
            title: textRaw,
            textBlocks: []
          };
          chapters.push(currentChapter);
        }
        else {
          // If there's no current chapter yet, create one
          if (!currentChapter) {
            currentChapter = { title: "Untitled Chapter", textBlocks: [] };
            chapters.push(currentChapter);
          }
          // Add the block text if not empty
          if (textRaw) {
            currentChapter.textBlocks.push(textRaw);
          }
        }
      });
      
      // Build the manuscript text with proper spacing
      let manuscriptText = "";
      
      chapters.forEach((ch, idx) => {
        // Two newlines before each chapter title
        if (idx === 0) {
          manuscriptText += "\n\n";
        } else {
          manuscriptText += "\n\n\n";
        }
        
        // Add chapter title with numbering if not already present
        const formattedTitle = ch.title.match(/^Chapter\s+\d+/i) ? ch.title : `Chapter ${idx + 1}: ${ch.title}`;
        manuscriptText += formattedTitle;
        
        // One newline after chapter title
        manuscriptText += "\n\n";
        
        // Add paragraphs with one blank line between them
        manuscriptText += ch.textBlocks.join("\n\n");
      });
      
      // Ensure the file ends with exactly 2 blank lines (3 newlines total)
      manuscriptText = manuscriptText + '\n\n\n';
      
      const chapterCount = chapters.length;
      
      // Save the converted text to Google Drive (no metadata header)
      const file = await uploadManuscript(
        drive,
        manuscriptText,
        projectFolderId,
        finalOutputName
      );
      
      return { 
        success: true, 
        data: {
          fileId: file.id,
          fileName: file.name || finalOutputName,
          chapterCount,
          characterCount: manuscriptText.length
        },
        message: `Successfully converted DOCX to TXT. Found ${chapterCount} chapters.` 
      };
    } catch (conversionError: any) {
      console.error('DOCX conversion error:', conversionError);
      return { 
        success: false, 
        error: `Conversion failed: ${conversionError.message || 'Unknown error'}` 
      };
    }
  } catch (error: any) {
    console.error('Error in convertDocxToTxtAction:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to convert DOCX file' 
    };
  }
}

// Convert TXT file to DOCX
export async function convertTxtToDocxAction(
  accessToken: string,
  txtFileId: string,
  outputFileName: string,
  projectFolderId: string
): Promise<ActionResult> {
  try {
    const clients = await getAuthenticatedClients(accessToken);
    if ('error' in clients) {
      return { success: false, error: clients.error };
    }

    const { drive } = clients;
    
    if (!txtFileId || !outputFileName || !projectFolderId) {
      return { success: false, error: 'Missing required parameters' };
    }

    // Ensure output filename has .docx extension
    let finalOutputName = outputFileName.trim();
    if (!finalOutputName.toLowerCase().endsWith('.docx')) {
      finalOutputName += '.docx';
    }

    try {
      // Read the text file content from Google Drive
      let textContent: string;
      
      // Check if it's a Google Doc or regular text file
      const fileInfo = await drive.files.get({
        fileId: txtFileId,
        fields: 'mimeType'
      });

      if (fileInfo.data.mimeType === 'application/vnd.google-apps.document') {
        // It's a Google Doc - export as plain text
        const response = await drive.files.export({
          fileId: txtFileId,
          mimeType: 'text/plain'
        });
        textContent = response.data as string;
      } else {
        // It's a regular text file
        const response = await drive.files.get({
          fileId: txtFileId,
          alt: 'media'
        });
        textContent = response.data as string;
      }

      if (!textContent || textContent.trim().length === 0) {
        throw new Error('No text content found in the file');
      }

      // Clean up the text content
      textContent = textContent
        .replace(/\r\n/g, '\n')  // Normalize line endings
        .replace(/\r/g, '\n')    // Convert remaining \r to \n
        .trim();

      // Count chapters and paragraphs
      const chapterMatches = textContent.match(/(^|\n)\s*Chapter\s*\d+/g);
      const chapterCount = chapterMatches ? chapterMatches.length : 0;
      
      // Split into paragraphs (non-empty lines or double line breaks)
      const paragraphs = textContent
        .split(/\n\s*\n/)
        .map(p => p.trim())
        .filter(p => p.length > 0);
      
      const paragraphCount = paragraphs.length;

      // Create a proper DOCX document using the docx library
      const documentParagraphs: Paragraph[] = [];

      paragraphs.forEach((paragraph) => {
        // Check if this looks like a chapter heading
        const isChapterHeading = /^\s*Chapter\s*\d+/i.test(paragraph);
        
        if (isChapterHeading) {
          // Create a heading paragraph
          documentParagraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: paragraph,
                  bold: true,
                  size: 32, // 16pt (size is in half-points)
                })
              ],
              heading: HeadingLevel.HEADING_1,
              spacing: {
                before: 480, // 24pt before
                after: 240,  // 12pt after
              }
            })
          );
        } else {
          // Create a regular paragraph
          documentParagraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: paragraph,
                  size: 24, // 12pt (size is in half-points)
                })
              ],
              spacing: {
                after: 240, // 12pt after
              },
              indent: {
                firstLine: 720, // 0.5 inch first line indent (720 twips = 0.5 inch)
              }
            })
          );
        }
      });

      // Create the DOCX document
      const doc = new Document({
        sections: [{
          properties: {
            page: {
              margin: {
                top: 1440,    // 1 inch (1440 twips = 1 inch)
                right: 1440,  // 1 inch
                bottom: 1440, // 1 inch
                left: 1440,   // 1 inch
              },
            },
          },
          children: documentParagraphs,
        }],
      });

      // Generate the DOCX file as a buffer
      const docxBuffer = await Packer.toBuffer(doc);

      // Convert buffer to stream for Google Drive upload
      const docxStream = bufferToStream(docxBuffer);

      // Upload the DOCX file to Google Drive using stream
      const file = await drive.files.create({
        requestBody: {
          name: finalOutputName,
          parents: [projectFolderId],
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        },
        media: {
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          body: docxStream
        },
        fields: 'id, name'
      });
      
      return { 
        success: true, 
        data: {
          fileId: file.data.id,
          fileName: file.data.name || finalOutputName,
          chapterCount,
          paragraphCount,
          characterCount: textContent.length
        },
        message: `Successfully converted TXT to DOCX. Formatted ${paragraphCount} paragraphs with ${chapterCount} chapters.` 
      };

    } catch (conversionError: any) {
      console.error('TXT to DOCX conversion error:', conversionError);
      return { 
        success: false, 
        error: `Conversion failed: ${conversionError.message || 'Unknown error'}` 
      };
    }

  } catch (error: any) {
    console.error('Error in convertTxtToDocxAction:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to convert TXT file' 
    };
  }
}

// -----------------------------------------------------------------------------
// withDrive adapter (non-breaking): use your existing accessToken strings
// -----------------------------------------------------------------------------
export async function withDriveFromAccessToken<T>(
  accessToken: string,
  action: (drive: drive_v3.Drive, ac: AbortController) => Promise<T>
): Promise<T> {
  // We only pass the access token; refresh_token is optional and not needed here
  return withDrive({ access_token: accessToken }, action);
}

// notes:
// `getAuthenticatedClients` and `withDrive` solve similar 
// problems—obtaining an authenticated Drive client—but they 
// behave quite differently.
// 
// * **`getAuthenticatedClients(accessToken)`**
// 
//   * Returns an object `{ authClient, drive }` or `{ error: … }`.
//   * You have to check for an `error` property yourself.
//   * You get both the `authClient` (Google OAuth2 client) and 
//     the `drive` client, which you then use in your code.
//   * It leaves connection cleanup and error handling entirely up 
//     to the caller, and the Drive client can be reused across calls.
// 
// * **`withDrive(tokens, callback)`** (and your adapter `withDriveFromAccessToken`)
// 
//   * You pass in an access token (and optional refresh/expiry). 
//     The helper builds a fresh OAuth2 client and Drive client, 
//     runs your **callback** with that Drive client and an `AbortController`, 
//     then cleans up.
//   * It doesn’t return a `{ drive, authClient }` object. Instead, it 
//     returns whatever your callback returns (or throws if your callback throws). 
//     There is no `error` property; you handle errors via normal try/catch.
//   * Because it instantiates a new client for one action and aborts 
//     outstanding requests in a `finally` block, it helps avoid lingering 
//     connections or leaks in long‑running apps. It’s designed for 
//     single, self‑contained operations, not for holding onto a Drive client 
//     across multiple calls.
// 
// So, while both functions give you access to Drive, `getAuthenticatedClients` 
// is a simple getter that you call and destructure, 
// whereas `withDrive` is a wrapper that executes a function with a drive 
// client and then tears it down. 
// The latter offers automatic cleanup and doesn’t expose 
// an `authClient` or `drive` outside of its callback.
