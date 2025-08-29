// types/tools.ts
// Type definitions for the Tool System

export interface ToolMetadata {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  fileName: string;
  filePath: string;
}

export type ToolCategory = 
  // | 'AI Writing Tools'  // Temporarily hidden
  | 'Core Editing Tools' 
  | 'Other Editing Tools'
  | 'User Tools'
  | 'Dictionaries';

export interface ToolPrompt {
  id: string;
  name: string;
  category: ToolCategory;
  content: string;
  lastModified?: string;
}

export interface ToolExecutionRequest {
  toolId: string;
  manuscript: string;
  additionalContext?: string;
  options?: ToolExecutionOptions;
}

export interface ToolExecutionOptions {
  temperature?: number;
  includeMetadata?: boolean;
  [key: string]: any;
}

export interface ToolExecutionResult {
  success: boolean;
  toolId: string;
  result?: string;
  error?: string;
  executionTime?: number;
  metadata?: {
    toolName: string;
    category: ToolCategory;
    timestamp: string;
    [key: string]: any;
  };
}

export interface ToolListResponse {
  success: boolean;
  tools?: ToolMetadata[];
  categories?: ToolCategory[];
  error?: string;
}

export interface ToolSyncStatus {
  hasToolPrompts: boolean;
  needsSync: boolean;
  lastSyncDate?: string;
  toolCount?: number;
}

export interface ToolPromptSyncResult {
  success: boolean;
  syncedCount?: number;
  skippedCount?: number;
  errors?: string[];
  message?: string;
}