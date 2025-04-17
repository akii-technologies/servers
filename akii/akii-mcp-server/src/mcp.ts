/**
 * MCP Protocol Handler
 * 
 * Processes Model Context Protocol requests and routes them to the appropriate handlers
 */

import { handleContextRequest } from './context/contextHandler';
import { handleCompletionRequest, CompletionRequest } from './models/completionHandler';
import { handleToolRequest } from './tools/toolHandler';

// MCP Request types
export type McpRequestType = 'context' | 'completion' | 'tool';

// MCP Request interface
export interface McpRequest {
  type: McpRequestType;
  payload: any;
  metadata?: Record<string, any>;
}

// MCP Response interface
export interface McpResponse {
  success: boolean;
  data?: any;
  error?: string;
  usage?: {
    contextTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  sources?: any[];
}

/**
 * Handle MCP requests based on type
 * 
 * @param request The MCP request object
 * @returns MCP response object
 */
export async function handleMcpRequest(request: McpRequest): Promise<McpResponse> {
  console.log(`Processing MCP request of type: ${request.type}`);
  
  try {
    // Validate the request
    if (!request.type) {
      throw new Error('Missing request type');
    }
    if (!request.payload) {
      throw new Error('Missing request payload');
    }
    
    // Route to appropriate handler based on request type
    switch (request.type) {
      case 'context':
        return await handleContextRequest(request.payload, request.metadata);
      case 'completion':
        return await handleCompletionRequest(request.payload as CompletionRequest, request.metadata);
      case 'tool':
        return await handleToolRequest(request.payload, request.metadata);
      default:
        throw new Error(`Unsupported request type: ${request.type}`);
    }
  } catch (error) {
    console.error('Error in MCP handler:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}