// lib/docx-conversion-actions.ts
//
// This module contains server actions for converting Microsoft Word documents
// (.docx) into plain text and uploading the resulting text to a user’s
// Google Drive. The conversion uses the `mammoth` library, which extracts
// raw text and ignores formatting and embedded images. Uploading to Drive
// leverages the Google API client and a service account defined by
// `GOOGLE_APPLICATION_CREDENTIALS`. If the consuming application wishes to
// perform the conversion on the client (to avoid sending large .docx files
// over the network), it can call `uploadTextToDrive` directly with the
// extracted text.

"use server";

import { google } from 'googleapis';
import { Readable } from 'stream';
import mammoth from 'mammoth';

/**
 * Returns an authenticated Google Drive client using the service account
 * credentials specified in the `GOOGLE_APPLICATION_CREDENTIALS` environment
 * variable. The scope is limited to creating files on the user’s Drive
 * (`https://www.googleapis.com/auth/drive.file`).
 */
async function getServiceAccountClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });
  return auth.getClient();
}

/**
 * Helper to build a Drive client. If an access token is provided, use it to
 * create an OAuth2 client. Otherwise, fall back to the service account.
 */
async function getDriveClient(accessToken?: string) {
  if (accessToken) {
    const oAuth2Client = new google.auth.OAuth2();
    oAuth2Client.setCredentials({ access_token: accessToken });
    return google.drive({ version: 'v3', auth: oAuth2Client });
  }
  const authClient = await getServiceAccountClient();
  return google.drive({ version: 'v3', auth: authClient as any });
}

/**
 * Converts a DOCX file supplied as an ArrayBuffer into a plain-text string.
 * This helper uses the `mammoth` library to extract raw text, discarding
 * formatting and images. It can be useful in server-side contexts where
 * client-side conversion is not available or desired.
 *
 * @param buffer An ArrayBuffer containing the contents of a `.docx` file.
 * @returns The extracted text as a string.
 */
export async function convertDocxBufferToTxt(buffer: ArrayBuffer): Promise<string> {
  const { value } = await mammoth.extractRawText({ arrayBuffer: buffer });
  return value;
}

/**
 * Uploads a plain-text document to a specified folder in the user's Google Drive.
 * The caller must provide the destination file name (including the `.txt`
 * extension) and the Drive folder ID. The content is uploaded via a
 * Readable stream to accommodate arbitrarily large text inputs.
 *
 * @param text The text content to save.
 * @param fileName The desired filename for the uploaded text file (e.g. `document.txt`).
 * @param folderId The Google Drive folder ID where the file should be uploaded.
 * @param accessToken Optional OAuth access token. If provided, uses user's Drive; otherwise uses service account.
 * @returns An object containing the Drive file ID and the name assigned to the file.
 */
export async function uploadTextToDrive(
  text: string,
  fileName: string,
  folderId: string,
  accessToken?: string
): Promise<{ fileId: string; fileName: string }> {
  const drive = await getDriveClient(accessToken);

  // Convert the string into a stream. The Drive API expects a stream when
  // uploading file content.
  const bufferStream = new Readable();
  bufferStream.push(text);
  bufferStream.push(null);

  const fileMetadata = {
    name: fileName,
    parents: [folderId],
    mimeType: 'text/plain',
  };

  const media = {
    mimeType: 'text/plain',
    body: bufferStream,
  };

  const response = await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: 'id, name',
  });

  return {
    fileId: response.data.id!,
    fileName: response.data.name!,
  };
}

/**
 * Lists all .docx files within the specified Google Drive folder. This helper
 * queries the Drive API for files whose MIME type corresponds to a Word
 * document and returns their IDs and names. Results are not paginated; if
 * you expect more than 100 files, consider adding pagination logic.
 *
 * @param folderId The ID of the Google Drive folder to search within.
 */
export async function listDocxFilesAction(
  accessToken: string,
  folderId: string
): Promise<{ success: boolean; data?: { files: { id: string; name: string }[] }; error?: string }> {
  try {
    const drive = await getDriveClient(accessToken);
    const res = await drive.files.list({
      q: `'${folderId}' in parents and mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' and trashed = false`,
      fields: 'files(id, name)',
      pageSize: 100,
    });
    return {
      success: true,
      data: { files: (res.data.files ?? []) as { id: string; name: string }[] }
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to list DOCX files'
    };
  }
}

/**
 * Lists all plain-text (.txt) files within the specified Google Drive folder.
 *
 * @param folderId The ID of the Google Drive folder to search within.
 */
export async function listTxtFilesAction(
  accessToken: string,
  folderId: string
): Promise<{ success: boolean; data?: { files: { id: string; name: string }[] }; error?: string }> {
  try {
    const drive = await getDriveClient(accessToken);
    const res = await drive.files.list({
      q: `'${folderId}' in parents and mimeType = 'text/plain' and trashed = false`,
      fields: 'files(id, name)',
      pageSize: 100,
    });
    return {
      success: true,
      data: { files: (res.data.files ?? []) as { id: string; name: string }[] }
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to list TXT files'
    };
  }
}

/**
 * Converts a DOCX file stored in Google Drive to a plain-text file in the same
 * folder. The DOCX file is downloaded, converted to text using Mammoth, and
 * then uploaded back to Drive as a `.txt` file. The newly created file's ID
 * and name are returned along with conversion statistics.
 *
 * @param accessToken The user's OAuth access token
 * @param fileId The ID of the DOCX file to convert.
 * @param outputFileName The desired name for the output .txt file (including .txt extension)
 * @param folderId The ID of the folder where the new .txt file should be placed.
 */
export async function convertDocxToTxtAction(
  accessToken: string,
  fileId: string,
  outputFileName: string,
  folderId: string
): Promise<{
  success: boolean;
  data?: {
    fileId: string;
    fileName: string;
    chapterCount: number;
    characterCount: number
  };
  error?: string
}> {
  try {
    const drive = await getDriveClient(accessToken);

    // Download the DOCX file content
    const docxRes = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );
    const buffer: ArrayBuffer = docxRes.data as unknown as ArrayBuffer;
    const text = await convertDocxBufferToTxt(buffer);

    // Count chapters (looking for common chapter patterns)
    const chapterMatches = text.match(/^(Chapter|CHAPTER|\d+\.)\s+/gm);
    const chapterCount = chapterMatches ? chapterMatches.length : 0;

    // Upload the extracted text back to Drive using the user's access token
    const authClient = new google.auth.OAuth2();
    authClient.setCredentials({ access_token: accessToken });
    const userDrive = google.drive({ version: 'v3', auth: authClient });

    const bufferStream = new Readable();
    bufferStream.push(text);
    bufferStream.push(null);

    const fileMetadata = {
      name: outputFileName,
      parents: [folderId],
      mimeType: 'text/plain',
    };

    const media = {
      mimeType: 'text/plain',
      body: bufferStream,
    };

    const response = await userDrive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, name',
    });

    return {
      success: true,
      data: {
        fileId: response.data.id!,
        fileName: response.data.name!,
        chapterCount,
        characterCount: text.length
      }
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to convert DOCX to TXT'
    };
  }
}

/**
 * Converts a plain-text file stored in Google Drive to a DOCX file. This
 * implementation simply re-uploads the text content with a `.docx`
 * extension and the appropriate MIME type. Note that the resulting file
 * will contain plain text and will not be a fully structured Word document,
 * but it ensures compatibility for downstream workflows that expect a DOCX
 * file. If your application requires proper Word formatting, consider
 * integrating a dedicated DOCX generation library.
 *
 * @param accessToken The user's OAuth access token
 * @param fileId The ID of the text file to convert.
 * @param outputFileName The desired name for the output .docx file (including .docx extension)
 * @param folderId The ID of the folder where the new DOCX file should be placed.
 */
export async function convertTxtToDocxAction(
  accessToken: string,
  fileId: string,
  outputFileName: string,
  folderId: string
): Promise<{
  success: boolean;
  data?: {
    fileId: string;
    fileName: string;
    paragraphCount: number;
    chapterCount: number;
    characterCount: number
  };
  error?: string
}> {
  try {
    const driveClient = await getDriveClient(accessToken);

    // Download the text file
    const txtRes = await driveClient.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );
    const text = Buffer.from(txtRes.data as unknown as ArrayBuffer).toString();

    // Count statistics
    const paragraphs = text.split(/\n\n+/);
    const paragraphCount = paragraphs.filter(p => p.trim().length > 0).length;
    const chapterMatches = text.match(/^(Chapter|CHAPTER|\d+\.)\s+/gm);
    const chapterCount = chapterMatches ? chapterMatches.length : 0;

    // Create a stream from the text content
    const bufferStream = new Readable();
    bufferStream.push(text);
    bufferStream.push(null);

    // Upload as a DOCX file (note: this is plain text content)
    const response = await driveClient.files.create({
      requestBody: {
        name: outputFileName,
        parents: [folderId],
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
      media: {
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        body: bufferStream,
      },
      fields: 'id, name',
    });

    return {
      success: true,
      data: {
        fileId: response.data.id!,
        fileName: response.data.name!,
        paragraphCount,
        chapterCount,
        characterCount: text.length
      }
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to convert TXT to DOCX'
    };
  }
}