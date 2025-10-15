// chatInternal.ts - Internal chat functions (not exposed as public API)
// Only callable from within the app, never accessible from outside

import { createApiService, type AIProvider, getCurrentProviderAndModel } from './aiService';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { createGoogleDriveFileAction, updateGoogleDriveFileAction, readGoogleDriveFileAction, listGoogleDriveFilesAction } from './google-drive-actions';
import OpenAI from 'openai';

// Type definitions
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  response: string;
  providerModel: string;
}

/**
 * Internal function to get provider/model info - NOT a public API endpoint
 */
export async function getProviderModelInfoInternal(): Promise<{ providerModel: string }> {
  const session: any = await getServerSession(authOptions);
  
  if (!session || !session.accessToken) {
    throw new Error('Authentication required');
  }

  try {
    const providerInfo: { provider: AIProvider; model: string } = await getCurrentProviderAndModel(session.accessToken as string);
    const providerModel: string = `${providerInfo.provider === 'openrouter' ? 'OpenRouter' : providerInfo.provider}: ${providerInfo.model.replace(/^[^/]+\//, '')}`;
    
    return { providerModel };
  } catch (error: unknown) {
    const errorMessage: string = error instanceof Error ? error.message : 'Unknown error occurred';
    throw new Error(`Failed to get provider info: ${errorMessage}`);
  }
}

/**
 * Internal function to get chat response - NOT a public API endpoint
 * @param messages - Array of chat messages
 * @param customModel - Optional custom model to use (for TabChat-specific model selection)
 */
export async function getChatResponseInternal(messages: ChatMessage[], customModel?: string): Promise<ChatResponse> {
  const session: any = await getServerSession(authOptions);
  
  if (!session || !session.accessToken) {
    throw new Error('Authentication required');
  }

  // Validate input with explicit type check
  const latestMessage: ChatMessage = messages[messages.length - 1];
  if (!latestMessage || latestMessage.role !== 'user') {
    throw new Error('Latest message must be from user');
  }

  try {
    let providerInfo: { provider: AIProvider; model: string };
    let providerModel: string;
    
    // If customModel is provided, use it directly (for TabChat)
    if (customModel) {
      providerInfo = { provider: 'openrouter', model: customModel };
      providerModel = `TabChat: ${customModel.replace(/^[^/]+\//, '')}`;
    } else {
      // Otherwise get from settings (for regular chat)
      providerInfo = await getCurrentProviderAndModel(session.accessToken as string);
      providerModel = `${providerInfo.provider === 'openrouter' ? 'OpenRouter' : providerInfo.provider}: ${providerInfo.model.replace(/^[^/]+\//, '')}`;
    }

    // Create AI service instance for direct API call
    const userId: string = session?.user?.id || 'anonymous';
    const aiService = await createApiService(providerInfo.provider, providerInfo.model, userId);
    
    if (!aiService || !aiService.client) {
      throw new Error('AI service not available');
    }

    // Build conversation messages for OpenAI format
    const openaiMessages: Array<{role: 'system' | 'user' | 'assistant', content: string}> = [
      {
        role: 'system',
        content: 'You are a helpful AI assistant. Respond naturally and conversationally.'
      }
    ];

    // Add conversation history
    messages.forEach((msg: ChatMessage) => {
      openaiMessages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      });
    });

    // Call OpenRouter API directly
    const response = await aiService.client.chat.completions.create({
      model: providerInfo.model,
      messages: openaiMessages,
      // temperature: 0.7,
      max_tokens: 8000,
      stream: false
    });

    const aiResponse: string = response.choices[0]?.message?.content || 'No response generated';
    
    const result: ChatResponse = {
      response: aiResponse.trim(),
      providerModel: providerModel
    };
    
    return result;
    
  } catch (error: unknown) {
    const errorMessage: string = error instanceof Error ? error.message : 'Unknown error occurred';
    throw new Error(`Chat response failed: ${errorMessage}`);
  }
}

/**
 * Internal function to save chat with custom filename - NOT a public API endpoint
 */
export async function saveChatToBrainstormInternal(
  messages: ChatMessage[], 
  providerModel: string,
  currentProjectId: string,
  rootFolderId: string,
  filename: string = 'brainstorm'
): Promise<{ success: boolean; message: string }> {
  const session: any = await getServerSession(authOptions);
  
  if (!session || !session.accessToken) {
    throw new Error('Authentication required');
  }

  if (!currentProjectId) {
    throw new Error('No project selected');
  }

  try {
    // Ensure filename has .txt extension
    let finalFilename = filename.trim();
    if (!finalFilename.endsWith('.txt')) {
      finalFilename += '.txt';
    }

    // Format chat content
    const now: Date = new Date();
    const timestamp: string = now.toLocaleString();
    
    const chatHeader: string = `\nChat Session: ${timestamp}\nProvider: ${providerModel}\n\n`;
    
    const chatBody: string = messages
      .map((msg: ChatMessage) => `${msg.role === 'user' ? 'ME' : 'AI'}:\n${msg.content}\n`)
      .join('\n');
    
    const newChatContent: string = chatHeader + chatBody + '\n\n';

    // Try to find and read existing file with the same name
    try {
      const filesList = await listGoogleDriveFilesAction(session.accessToken, rootFolderId, currentProjectId);
      
      if (filesList.success && filesList.data?.files) {
        const existingFile = filesList.data.files.find((file: any) => 
          file.name === finalFilename && !file.isFolder
        );
        
        if (existingFile) {
          const existingFileContent = await readGoogleDriveFileAction(session.accessToken, rootFolderId, existingFile.id);
          
          if (existingFileContent.success && existingFileContent.data?.content) {
            // Append to existing file
            const updatedContent: string = existingFileContent.data.content + newChatContent;
            const result = await updateGoogleDriveFileAction(
              session.accessToken,
              rootFolderId,
              existingFile.id,
              updatedContent
            );
            
            return result.success 
              ? { success: true, message: `Chat appended to ${finalFilename}` }
              : { success: false, message: result.error || `Failed to update ${finalFilename}` };
          }
        }
      }
    } catch {
      // File doesn't exist or error occurred, will create new one
    }

    // Create new file with custom filename
    const result = await createGoogleDriveFileAction(
      session.accessToken,
      rootFolderId,
      newChatContent,
      finalFilename,
      currentProjectId
    );
    
    return result.success 
      ? { success: true, message: `Chat saved to ${finalFilename}` }
      : { success: false, message: result.error || `Failed to create ${finalFilename}` };
    
  } catch (error: unknown) {
    const errorMessage: string = error instanceof Error ? error.message : 'Unknown error occurred';
    return { success: false, message: `Failed to save chat: ${errorMessage}` };
  }
}
