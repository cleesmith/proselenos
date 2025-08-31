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
 */
export async function getChatResponseInternal(messages: ChatMessage[]): Promise<ChatResponse> {
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
    // Get provider and model info
    const providerInfo: { provider: AIProvider; model: string } = await getCurrentProviderAndModel(session.accessToken as string);
    const providerModel: string = `${providerInfo.provider === 'openrouter' ? 'OpenRouter' : providerInfo.provider}: ${providerInfo.model.replace(/^[^/]+\//, '')}`;

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
      temperature: 0.7,
      max_tokens: 2000,
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
 * Internal function to save chat to brainstorm.txt - NOT a public API endpoint
 */
export async function saveChatToBrainstormInternal(
  messages: ChatMessage[], 
  providerModel: string,
  currentProjectId: string,
  rootFolderId: string
): Promise<{ success: boolean; message: string }> {
  const session: any = await getServerSession(authOptions);
  
  if (!session || !session.accessToken) {
    throw new Error('Authentication required');
  }

  if (!currentProjectId) {
    throw new Error('No project selected');
  }

  try {
    // Format chat content
    const now: Date = new Date();
    const timestamp: string = now.toLocaleString();
    
    const chatHeader: string = `========================================\nChat Session: ${timestamp}\nProvider: ${providerModel}\n========================================\n\n`;
    
    const chatBody: string = messages
      .map((msg: ChatMessage) => `${msg.role === 'user' ? 'ME' : 'AI'}:\n${msg.content}\n`)
      .join('\n');
    
    const newChatContent: string = chatHeader + chatBody + '\n\n';

    // Try to find and read existing brainstorm.txt
    try {
      const filesList = await listGoogleDriveFilesAction(session.accessToken, rootFolderId, currentProjectId);
      
      if (filesList.success && filesList.data?.files) {
        const brainstormFile = filesList.data.files.find((file: any) => 
          file.name === 'brainstorm.txt' && !file.isFolder
        );
        
        if (brainstormFile) {
          const existingFile = await readGoogleDriveFileAction(session.accessToken, rootFolderId, brainstormFile.id);
          
          if (existingFile.success && existingFile.data?.content) {
            // Append to existing file
            const updatedContent: string = existingFile.data.content + newChatContent;
            const result = await updateGoogleDriveFileAction(
              session.accessToken,
              rootFolderId,
              brainstormFile.id,
              updatedContent
            );
            
            return result.success 
              ? { success: true, message: 'Chat appended to brainstorm.txt' }
              : { success: false, message: result.error || 'Failed to update brainstorm.txt' };
          }
        }
      }
    } catch {
      // File doesn't exist or error occurred, will create new one
    }

    // Create new brainstorm.txt file
    const result = await createGoogleDriveFileAction(
      session.accessToken,
      rootFolderId,
      newChatContent,
      'brainstorm.txt',
      currentProjectId
    );
    
    return result.success 
      ? { success: true, message: 'Chat saved to brainstorm.txt' }
      : { success: false, message: result.error || 'Failed to create brainstorm.txt' };
    
  } catch (error: unknown) {
    const errorMessage: string = error instanceof Error ? error.message : 'Unknown error occurred';
    return { success: false, message: `Failed to save chat: ${errorMessage}` };
  }
}