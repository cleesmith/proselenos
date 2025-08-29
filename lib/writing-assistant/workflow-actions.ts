'use server';

import { WorkflowStepId, WorkflowFile } from '@/app/writing-assistant/types';
import { 
  createGoogleDriveFileAction,
  listGoogleDriveFilesAction,
  readGoogleDriveFileAction,
  updateGoogleDriveFileAction
} from '@/lib/google-drive-actions';
import { executeWorkflowAI } from './execution-engine';
import { getWorkflowPrompt } from './prompts';

export async function detectExistingWorkflowFilesAction(accessToken: string, rootFolderId: string, projectFolderId: string) {
  try {
    const result = await listGoogleDriveFilesAction(accessToken, rootFolderId, projectFolderId);
    
    if (!result.success || !result.data?.files) {
      return {
        success: false,
        error: 'Failed to list project files'
      };
    }

    const files = result.data.files;
    
    const workflowFiles = {
      brainstorm: files.find((f: any) => f.name === 'brainstorm.txt'),
      outline: files.find((f: any) => f.name === 'outline.txt'),  
      world: files.find((f: any) => f.name === 'world.txt'),
      chapters: files.filter((f: any) => f.name === 'manuscript.txt' || (f.name?.startsWith('chapter_') && f.name.endsWith('.txt')))
    };

    return {
      success: true,
      data: workflowFiles
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to detect workflow files'
    };
  }
}

export async function executeWorkflowStepAction(
  accessToken: string,
  rootFolderId: string,
  stepId: WorkflowStepId,
  userInput: string,
  projectFolderId: string,
  provider: string,
  model: string,
  existingFiles: any
) {
  try {
    // Get step-specific prompt and context
    const prompt = getWorkflowPrompt(stepId);
    const context = await buildStepContext(accessToken, rootFolderId, stepId, existingFiles);
    
    // Debug logging for context validation
    console.log(`[${stepId}] Context length: ${context.length} characters`);
    if (context.length < 10) {
      console.warn(`[${stepId}] Warning: Very short context (${context.length} chars): "${context}"`);
    }
    
    // Validate context has meaningful content before AI execution
    const trimmedContext = context.trim();
    if (!trimmedContext || trimmedContext === 'No previous content available.' || trimmedContext.startsWith('ERROR:')) {
      return {
        success: false,
        error: trimmedContext.startsWith('ERROR:') ? trimmedContext.substring(7) : `No valid context available for ${stepId} step. Please ensure prerequisite files exist.`
      };
    }
    
    // Execute AI generation
    const result = await executeWorkflowAI(
      prompt,
      userInput,
      context,
      provider,
      model
    );

    if (!result.success) {
      return {
        success: false,
        error: result.error
      };
    }

    // Validate we actually have AI content before trying to save
    if (!result.content || result.content.trim() === '') {
      return {
        success: false,
        error: `AI generated no content for ${stepId} step. Check prompts and context.`
      };
    }

    // Save generated content to file
    const fileName = getStepFileName(stepId);
    let saveResult;
    
    if (stepId === 'chapters') {
      // For chapters, append to existing manuscript.txt or create new one
      saveResult = await appendToManuscript(
        accessToken,
        rootFolderId,
        result.content || '',
        fileName,
        projectFolderId,
        existingFiles
      );
    } else if (stepId === 'brainstorm') {
      // For brainstorm, append AI response to existing brainstorm.txt
      const brainstormFile = existingFiles.brainstorm;
      
      if (brainstormFile?.id) {
        // Read existing content and append AI response with divider
        const existingContent = context; // Already contains the existing brainstorm content
        const enhancedContent = `${existingContent}\n\n--- AI Enhanced Content ---\n\n${result.content || ''}`;
        
        saveResult = await updateGoogleDriveFileAction(
          accessToken,
          rootFolderId,
          brainstormFile.id,
          enhancedContent
        );
      } else {
        // Fallback - create new file if somehow the brainstorm file doesn't exist
        saveResult = await createGoogleDriveFileAction(
          accessToken,
          rootFolderId,
          result.content,
          fileName,
          projectFolderId
        );
      }
    } else {
      // For other steps, check if file exists first
      const existingFile = existingFiles[stepId]; // outline, world, etc.
      if (existingFile?.id) {
        // Update existing file
        saveResult = await updateGoogleDriveFileAction(
          accessToken,
          rootFolderId,
          existingFile.id,
          result.content
        );
      } else {
        // Create new file
        saveResult = await createGoogleDriveFileAction(
          accessToken,
          rootFolderId,
          result.content,
          fileName,
          projectFolderId
        );
      }
    }

    if (!saveResult.success) {
      const errorDetail = saveResult.error || 'Unknown error occurred';
      return {
        success: false,
        error: `Failed to save generated content: ${errorDetail}`
      };
    }

    return {
      success: true,
      fileName,
      fileId: saveResult.data?.fileId,
      file: {
        id: saveResult.data?.fileId,
        name: fileName,
        content: result.content,
        createdAt: new Date().toISOString()
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Workflow step execution failed'
    };
  }
}

export async function getWorkflowFileContentAction(accessToken: string, rootFolderId: string, fileId: string) {
  try {
    const result = await readGoogleDriveFileAction(accessToken, rootFolderId, fileId);
    return {
      success: true,
      content: result.data?.content
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to read file content'
    };
  }
}

// Helper functions
async function buildStepContext(accessToken: string, rootFolderId: string, stepId: WorkflowStepId, existingFiles: any): Promise<string> {
  let context = '';
  
  switch (stepId) {
    case 'brainstorm':
      // For brainstorm, read existing brainstorm.txt file content (user's ideas)
      if (existingFiles.brainstorm) {
        const brainstormContent = await readGoogleDriveFileAction(accessToken, rootFolderId, existingFiles.brainstorm.id);
        if (brainstormContent.success) {
          context = brainstormContent.data?.content || '';
        }
      }
      break;
      
    case 'outline':
      if (existingFiles.brainstorm) {
        const brainstormContent = await readGoogleDriveFileAction(accessToken, rootFolderId, existingFiles.brainstorm.id);
        if (brainstormContent.success) {
          context = `BRAINSTORM CONTENT:\n${brainstormContent.data?.content}`;
        }
      }
      break;
      
    case 'world':
      let hasBrainstorm = false;
      let hasOutline = false;
      
      if (existingFiles.brainstorm) {
        const brainstormContent = await readGoogleDriveFileAction(accessToken, rootFolderId, existingFiles.brainstorm.id);
        if (brainstormContent.success && brainstormContent.data?.content?.trim()) {
          context += `BRAINSTORM CONTENT:\n${brainstormContent.data.content}\n\n`;
          hasBrainstorm = true;
        }
      }
      if (existingFiles.outline) {
        const outlineContent = await readGoogleDriveFileAction(accessToken, rootFolderId, existingFiles.outline.id);
        if (outlineContent.success && outlineContent.data?.content?.trim()) {
          context += `OUTLINE CONTENT:\n${outlineContent.data.content}`;
          hasOutline = true;
        }
      }
      
      // Validate that we have required context files for world building
      if (!hasBrainstorm && !hasOutline) {
        context = 'ERROR: World Builder requires either brainstorm.txt or outline.txt to exist with content. Please complete the brainstorm or outline steps first.';
      } else if (!hasBrainstorm) {
        context += '\n\nNOTE: No brainstorm content found. Building world based on outline only.';
      } else if (!hasOutline) {
        context += '\n\nNOTE: No outline content found. Building world based on brainstorm only.';
      }
      break;
      
    case 'chapters':
      // Determine which specific chapter to write by comparing outline to existing manuscript
      const chapterToWrite = await determineNextChapter(accessToken, rootFolderId, existingFiles);
      
      if (!chapterToWrite) {
        context = 'ERROR: Could not determine which chapter to write. Please check outline.txt exists.';
        break;
      }
      
      // Build context with outline, world, and specific chapter instruction
      let outlineContent = '';
      let worldContent = '';
      let manuscriptContent = '';
      
      if (existingFiles.outline) {
        const outline = await readGoogleDriveFileAction(accessToken, rootFolderId, existingFiles.outline.id);
        if (outline.success) {
          outlineContent = outline.data?.content || '';
        }
      }
      
      if (existingFiles.world) {
        const world = await readGoogleDriveFileAction(accessToken, rootFolderId, existingFiles.world.id);
        if (world.success) {
          worldContent = world.data?.content || '';
        }
      }
      
      // Get existing manuscript if it exists
      if (existingFiles.chapters && existingFiles.chapters.length > 0) {
        const manuscript = await readGoogleDriveFileAction(accessToken, rootFolderId, existingFiles.chapters[0].id);
        if (manuscript.success) {
          manuscriptContent = manuscript.data?.content || '';
        }
      }
      
      context  = `\n=== MANUSCRIPT ===\n${manuscriptContent}\n=== END MANUSCRIPT ===\n`;
      context += `\n=== OUTLINE ===\n${outlineContent}\n=== END OUTLINE ===\n`;
      context += `\n=== WORLD ===\n${worldContent}\n=== END WORLD ===\n`;
      context += `\nSPECIFIC TASK: Write ${chapterToWrite.title}\n`;
      context += `This should be a complete chapter of 2,000-4,000 words.\n`;
      context += `Focus only on the events and scenes described for this chapter in the outline.\n`;
      context += `BEGIN WITH: ${chapterToWrite.title}`;
      break;
  }
  
  return context;
}

// Determine which chapter to write next by comparing outline to existing manuscript
async function determineNextChapter(accessToken: string, rootFolderId: string, existingFiles: any): Promise<{ title: string; number: number } | null> {
  try {
    // Get outline content
    if (!existingFiles.outline) {
      console.log('No outline file found');
      return null;
    }
    
    const outlineResult = await readGoogleDriveFileAction(accessToken, rootFolderId, existingFiles.outline.id);
    if (!outlineResult.success) {
      console.log('Failed to read outline file');
      return null;
    }
    
    const outlineContent = outlineResult.data?.content || '';
    
    // Get existing manuscript content (if it exists)
    let manuscriptContent = '';
    if (existingFiles.chapters && existingFiles.chapters.length > 0) {
      const manuscriptResult = await readGoogleDriveFileAction(accessToken, rootFolderId, existingFiles.chapters[0].id);
      if (manuscriptResult.success) {
        manuscriptContent = manuscriptResult.data?.content || '';
      }
    }
    
    // Extract chapters from manuscript and put numbers in a Set for quick lookup
    const manuscriptChapterNumbers = new Set<number>();
    const chapterRegex = /Chapter\s+(\d+):/g;
    let match;
    
    while ((match = chapterRegex.exec(manuscriptContent)) !== null) {
      manuscriptChapterNumbers.add(parseInt(match[1], 10));
    }
    
    console.log(`Found ${manuscriptChapterNumbers.size} chapters in manuscript`);
    
    // Find all chapters in the outline
    const outlineChapters = [];
    const outlineChapterRegex = /^Chapter\s+(\d+):\s+(.+)$/gm;
    let outlineMatch;
    
    while ((outlineMatch = outlineChapterRegex.exec(outlineContent)) !== null) {
      console.log(`Found in outline: Chapter ${outlineMatch[1]}: ${outlineMatch[2]}`);
      
      outlineChapters.push({
        number: parseInt(outlineMatch[1], 10),
        title: outlineMatch[2],
        full: `Chapter ${outlineMatch[1]}: ${outlineMatch[2]}`
      });
    }
    
    // Sort outline chapters by chapter number
    outlineChapters.sort((a, b) => a.number - b.number);
    
    console.log(`Found ${outlineChapters.length} chapters in outline`);
    
    // Find the first chapter in the outline that's not in the manuscript
    for (const chapter of outlineChapters) {
      if (!manuscriptChapterNumbers.has(chapter.number)) {
        console.log(`Chapter ${chapter.number} is in outline but not in manuscript`);
        return {
          title: chapter.full,
          number: chapter.number
        };
      }
    }
    
    // No missing chapters found
    console.log('No missing chapters found');
    return null;
    
  } catch (error) {
    console.error('Error determining next chapter:', error);
    return null;
  }
}

// Append new chapter to existing manuscript.txt file
async function appendToManuscript(
  accessToken: string,
  rootFolderId: string,
  chapterText: string, 
  fileName: string, 
  projectFolderId: string, 
  existingFiles: any
) {
  try {
    let manuscriptContent = '';
    let fileId = null;
    
    // Check if manuscript.txt already exists
    if (existingFiles.chapters && existingFiles.chapters.length > 0) {
      // Read existing manuscript
      const manuscriptFile = existingFiles.chapters[0];
      fileId = manuscriptFile.id;
      
      const result = await readGoogleDriveFileAction(accessToken, rootFolderId, fileId);
      if (result.success) {
        manuscriptContent = result.data?.content || '';
      }
    }
    
    // Prepare the content to append
    let updatedContent;
    if (manuscriptContent.trim() === '') {
      // Empty manuscript - add chapter with initial formatting
      updatedContent = '\n\n' + chapterText;
    } else {
      // Existing content - append with proper spacing
      manuscriptContent = manuscriptContent.replace(/\s+$/, '') + '\n';
      updatedContent = manuscriptContent + '\n\n' + chapterText;
    }
    
    if (fileId) {
      // Update existing file using the proper update action
      return await updateGoogleDriveFileAction(
        accessToken,
        rootFolderId,
        fileId,
        updatedContent
      );
    } else {
      // Create new manuscript file
      return await createGoogleDriveFileAction(
        accessToken,
        rootFolderId,
        updatedContent,
        fileName,
        projectFolderId
      );
    }
    
  } catch (error) {
    console.error('Error appending to manuscript:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to append to manuscript'
    };
  }
}


function getStepFileName(stepId: WorkflowStepId): string {
  const fileNames = {
    brainstorm: 'brainstorm.txt',
    outline: 'outline.txt',
    world: 'world.txt',
    chapters: 'manuscript.txt' // For chapter writer, create main manuscript
  };
  
  return fileNames[stepId];
}