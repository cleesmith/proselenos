// lib/docx-comments-actions.ts
'use server';

import {
  getAuthClient,
  getDriveClient,
  uploadManuscript,
  listFilesAndFolders
} from '@/lib/googleDrive';
import * as mammoth from 'mammoth';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import xpath from 'xpath';

type ActionResult<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

interface CommentData {
  id: string;
  author: string;
  date: string;
  text: string;
  referencedText: string;
}

interface ExtractionResult {
  comments: CommentData[];
  documentContent: string;
}

async function getAuthenticatedClients(accessToken: string) {
  if (!accessToken) {
    return { error: 'Not authenticated' };
  }

  const authClient = getAuthClient(accessToken);
  const drive = getDriveClient(authClient);
  
  return {
    authClient,
    drive
  };
}

// Extract comments from a DOCX file and save as paired text
export async function extractDocxCommentsAction(
  accessToken: string,
  docxFileId: string,
  outputFileName: string,
  projectFolderId: string
): Promise<ActionResult<{ fileId: string; fileName: string; commentCount: number; hasComments: boolean }>> {
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
      // Get the DOCX file metadata to retrieve the original filename
      const metadata = await drive.files.get({
        fileId: docxFileId,
        fields: 'name'
      });
      const docxFileName = (metadata.data && 'name' in metadata.data) ? metadata.data.name as string : docxFileId;

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

      // Convert ArrayBuffer to Buffer for processing
      const buffer = Buffer.from(response.data as ArrayBuffer);
      
      // Extract comments from the DOCX file
      const extractionResult = await extractComments(buffer);

      if (extractionResult.comments.length === 0) {
        // Create minimal output with just document content
        const timestamp = new Date().toISOString().replace(/[-:.]/g, '').substring(0, 15);
        const noCommentsFileName = `${outputFileName.replace('.txt', '')}_no_comments_${timestamp}.txt`;
        
        const content = `No comments found in the document.

=== DOCUMENT CONTENT ===

${cleanupText(extractionResult.documentContent)}`;

        const file = await uploadManuscript(
          drive,
          content,
          projectFolderId,
          noCommentsFileName
        );
        
        return { 
          success: true, 
          data: {
            fileId: file.id,
            fileName: file.name || noCommentsFileName,
            commentCount: 0,
            hasComments: false
          },
          message: 'No comments found in document. Document content saved.' 
        };
      }

      // Generate formatted output with comments
      const formattedOutput = generateFormattedOutput(extractionResult, docxFileName);
      
      // Save to Google Drive
      const file = await uploadManuscript(
        drive,
        formattedOutput.content,
        projectFolderId,
        finalOutputName
      );
      
      return { 
        success: true, 
        data: {
          fileId: file.id,
          fileName: file.name || finalOutputName,
          commentCount: extractionResult.comments.length,
          hasComments: true
        },
        message: `Successfully extracted ${extractionResult.comments.length} comments and paired them with referenced text.` 
      };

    } catch (extractionError: any) {
      console.error('DOCX comments extraction error:', extractionError);
      return { 
        success: false, 
        error: `Extraction failed: ${extractionError.message || 'Unknown error'}` 
      };
    }

  } catch (error: any) {
    console.error('Error in extractDocxCommentsAction:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to extract DOCX comments' 
    };
  }
}

// Extract comments from DOCX buffer using multiple methods
async function extractComments(buffer: Buffer): Promise<ExtractionResult> {
  try {
    // Method 1: Extract raw XML for detailed comment analysis
    const zip = new JSZip();
    const doc = await zip.loadAsync(buffer);
    
    // Extract comments.xml and document.xml
    const commentsFile = doc.file('word/comments.xml');
    const documentFile = doc.file('word/document.xml');
    
    let commentsFromXml: CommentData[] = [];
    let commentRefs: Record<string, string> = {};
    
    if (commentsFile && documentFile) {
      const commentsXml = await commentsFile.async('string');
      const documentXml = await documentFile.async('string');
      
      // Extract comments from XML
      commentsFromXml = extractCommentsFromXml(commentsXml);
      
      // Extract comment references from document XML
      commentRefs = extractCommentReferences(documentXml);
      
      // Merge referenced text with comments
      commentsFromXml = commentsFromXml.map(comment => ({
        ...comment,
        referencedText: commentRefs[comment.id] || ''
      }));
    }
    
    // Method 2: Use mammoth to get document content and HTML conversion
    const result = await mammoth.convertToHtml({ buffer });
    const documentContent = await mammoth.extractRawText({ buffer });
    const html = result.value;
    
    // Extract comments from HTML as backup
    const commentsFromHtml = extractCommentsFromHtml(html);
    
    // Combine all comment sources, prioritizing XML comments
    const allComments = commentsFromXml.length > 0 ? commentsFromXml : commentsFromHtml;
    
    return {
      comments: allComments,
      documentContent: documentContent.value
    };

  } catch (error) {
    console.error('Error extracting comments:', error);
    throw error;
  }
}

// Extract comments from comments.xml
function extractCommentsFromXml(commentsXml: string): CommentData[] {
  const parser = new DOMParser();
  const commentsDoc = parser.parseFromString(commentsXml, 'text/xml');
  
  // Set up namespaces for XPath
  const select = xpath.useNamespaces({
    'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
  });
  
  // Find all comment nodes
  const commentNodes = select('//w:comment', commentsDoc as any) as any[];
  const comments: CommentData[] = [];
  
  for (const node of commentNodes) {
    const id = node.getAttribute('w:id') || '';
    const author = node.getAttribute('w:author') || 'Unknown';
    const date = node.getAttribute('w:date') || '';
    
    // Extract the comment text
    const textNodes = select('.//w:t', node) as any[];
    let commentText = '';
    
    for (const textNode of textNodes) {
      commentText += textNode.textContent || '';
    }
    
    comments.push({
      id,
      author,
      date,
      text: commentText.trim(),
      referencedText: ''
    });
  }
  
  return comments;
}

// Extract comment references from document XML
function extractCommentReferences(documentXml: string): Record<string, string> {
  const parser = new DOMParser();
  const docXmlDoc = parser.parseFromString(documentXml, 'text/xml');
  
  // Set up namespaces for XPath
  const select = xpath.useNamespaces({
    'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
  });
  
  const commentRefs: Record<string, string> = {};
  
  // Look for paragraphs with comment ranges
  const paragraphs = select('//w:p', docXmlDoc as any) as any[];
  
  for (const paragraph of paragraphs) {
    // Get the text content of the paragraph
    const textContent = extractParagraphText(paragraph, select);
    
    // Look for comment range starts
    const commentRangeStarts = select('.//w:commentRangeStart', paragraph) as any[];
    
    for (const startNode of commentRangeStarts) {
      const commentId = startNode.getAttribute('w:id');
      
      if (commentId && textContent) {
        commentRefs[commentId] = textContent;
      }
    }
    
    // Look for simple comment references
    const commentRefNodes = select('.//w:commentReference', paragraph) as any[];
    for (const refNode of commentRefNodes) {
      const commentId = refNode.getAttribute('w:id');
      
      if (commentId && !commentRefs[commentId] && textContent) {
        commentRefs[commentId] = textContent;
      }
    }
  }
  
  return commentRefs;
}

// Extract text from a paragraph element
function extractParagraphText(paragraph: any, select: any): string {
  const textNodes = select('.//w:t', paragraph) as any[];
  let text = '';
  
  for (const node of textNodes) {
    text += node.textContent || '';
  }
  
  return text.trim();
}

// Extract comments from HTML content (backup method)
function extractCommentsFromHtml(html: string): CommentData[] {
  const commentRegex = /<!--([\s\S]*?)-->/g;
  const comments: CommentData[] = [];
  
  let match: RegExpExecArray | null;
  let index = 0;
  
  while ((match = commentRegex.exec(html)) !== null) {
    const commentText = match[1].trim();
    
    // Look 200 chars around the comment to extract nearby context
    const start = Math.max(0, match.index - 200);
    const end = Math.min(html.length, match.index + match[0].length + 200);
    const context = html.substring(start, end);
    
    // Remove HTML tags to get plain text
    const contextText = context.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    
    comments.push({
      id: `html-${index++}`,
      author: 'Unknown',
      date: '',
      text: commentText,
      referencedText: contextText
    });
  }
  
  return comments;
}

// Clean up text by replacing special characters
function cleanupText(text: string): string {
  if (!text) return '';
  
  // Replace non-breaking spaces with regular spaces
  let cleaned = text.replace(/\u00A0/g, ' ');
  
  // Replace multiple spaces with a single space
  cleaned = cleaned.replace(/\s+/g, ' ');
  
  // Trim leading/trailing whitespace
  cleaned = cleaned.trim();
  
  return cleaned;
}

// Generate formatted output with comments paired with referenced text
function generateFormattedOutput(extractionResult: ExtractionResult, originalDocxFileName: string): { content: string } {
  const timestamp = new Date().toISOString();
  const { comments, documentContent } = extractionResult;
  
  let formattedOutput = `=== DOCX COMMENTS EXTRACTION ===
Original File: ${originalDocxFileName}
Extracted: ${timestamp}
Comments Found: ${comments.length}
=====================================

`;

  if (comments.length > 0) {
    comments.forEach((comment, index) => {
      if (comment.referencedText && comment.referencedText.trim()) {
        const cleanedText = cleanupText(comment.referencedText);
        formattedOutput += `original text:\n${cleanedText}\n\n`;
      }
      
      if (comment.text && comment.text.trim()) {
        const cleanedComment = cleanupText(comment.text);
        formattedOutput += `comment:\n${cleanedComment}\n`;
        
        // Add author and date if available
        if (comment.author && comment.author !== 'Unknown') {
          formattedOutput += `author: ${comment.author}\n`;
        }
        if (comment.date) {
          formattedOutput += `date: ${comment.date}\n`;
        }
      }
      
      formattedOutput += `\n---\n\n`;
    });
  } else {
    formattedOutput += "No comments found in the document.\n\n";
    formattedOutput += "=== DOCUMENT CONTENT ===\n\n";
    formattedOutput += cleanupText(documentContent);
  }
  
  return { content: formattedOutput };
}

// List DOCX files in a project folder (reuse from docx-conversion-actions.ts)
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