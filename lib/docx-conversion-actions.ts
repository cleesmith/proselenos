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
export async function listDocxFilesAction(accessToken: string, projectFolderId: string): Promise<ActionResult> {
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
    
    // Filter for DOCX files
    const docxFiles = allFiles.filter((file: any) => 
      file.name.toLowerCase().endsWith('.docx') &&
      file.mimeType !== 'application/vnd.google-apps.folder'
    );
    
    return { 
      success: true, 
      data: { files: docxFiles },
      message: `Found ${docxFiles.length} DOCX files` 
    };
  } catch (error: any) {
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
    
    // Filter for TXT files and Google Docs
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
      
      // Use mammoth to convert DOCX to plain text
      const result = await mammoth.extractRawText({ buffer });
      let textContent = result.value;

      if (!textContent || textContent.trim().length === 0) {
        throw new Error('No text content found in DOCX file');
      }

      // Clean up the text content
      textContent = textContent
        .replace(/\r\n/g, '\n')  // Normalize line endings
        .replace(/\r/g, '\n')    // Convert remaining \r to \n
        .replace(/\n{3,}/g, '\n\n') // Replace multiple newlines with double newlines
        .trim();

      // Count chapters (assuming chapters start with "Chapter" or similar)
      const chapterMatches = textContent.match(/(^|\n)\s*(Chapter|CHAPTER|Ch\.|CH\.)\s*\d+/gi);
      const chapterCount = chapterMatches ? chapterMatches.length : 0;

      // Add metadata header
      const metadata = `=== DOCX CONVERSION METADATA ===
Original File: ${docxFileId}
Converted: ${new Date().toISOString()}
Chapters Found: ${chapterCount}
Character Count: ${textContent.length}
===================================

`;

      const finalContent = metadata + textContent;

      // Save the converted text to Google Drive
      const file = await uploadManuscript(
        drive,
        finalContent,
        projectFolderId,
        finalOutputName
      );
      
      return { 
        success: true, 
        data: {
          fileId: file.id,
          fileName: file.name || finalOutputName,
          chapterCount,
          characterCount: textContent.length
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
      const chapterMatches = textContent.match(/(^|\n)\s*(Chapter|CHAPTER|Ch\.|CH\.)\s*\d+/gi);
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
        const isChapterHeading = /^\s*(Chapter|CHAPTER|Ch\.|CH\.)\s*\d+/i.test(paragraph);
        
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