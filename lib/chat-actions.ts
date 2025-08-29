// lib/chat-actions.ts - Server actions for chat functionality
'use server';

import { 
  getProviderModelInfoInternal, 
  getChatResponseInternal, 
  saveChatToBrainstormInternal,
  type ChatMessage,
  type ChatResponse 
} from './chatInternal';

/**
 * Server action to get provider/model info
 */
export async function getChatProviderModelAction(): Promise<{ providerModel: string }> {
  return await getProviderModelInfoInternal();
}

/**
 * Server action to get chat response
 */
export async function getChatResponseAction(messages: ChatMessage[]): Promise<ChatResponse> {
  return await getChatResponseInternal(messages);
}

/**
 * Server action to save chat to brainstorm.txt
 */
export async function saveChatToBrainstormAction(
  messages: ChatMessage[], 
  providerModel: string,
  currentProjectId: string,
  rootFolderId: string
): Promise<{ success: boolean; message: string }> {
  return await saveChatToBrainstormInternal(messages, providerModel, currentProjectId, rootFolderId);
}