/**
 * Completion Handler
 * 
 * Processes completion requests through the model router and handles usage tracking.
 */

import { McpResponse } from '../mcp';
import { ModelProvider, ModelRequest, routeModelCall, getInstanceModelConfig } from './modelRouter';
import { createClient } from '@supabase/supabase-js';

// Request interface for completion handler
export interface CompletionRequest {
  aiInstanceId: string;
  messages: {
    role: string;
    content: string;
  }[];
  provider?: ModelProvider;
  modelId?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stop?: string[];
  options?: Record<string, any>;
}

// Response interface for token usage tracking
interface TokenUsage {
  contextTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

/**
 * Handle completion request
 * 
 * @param payload The completion request payload
 * @param metadata Additional metadata
 * @returns MCP response with completion result
 */
export async function handleCompletionRequest(
  payload: CompletionRequest,
  metadata?: Record<string, any>
): Promise<McpResponse> {
  try {
    const { aiInstanceId, messages } = payload;
    
    if (!aiInstanceId) {
      throw new Error('AI instance ID is required');
    }
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new Error('Messages array is required and must not be empty');
    }
    
    // Get provider and model configuration
    let provider = payload.provider;
    let modelId = payload.modelId;
    let modelConfig: Record<string, any> = {};
    
    // If provider or modelId is not specified, get from instance configuration
    if (!provider || !modelId) {
      const instanceConfig = await getInstanceModelConfig(aiInstanceId);
      
      if (!instanceConfig) {
        throw new Error('No model configuration found for AI instance');
      }
      
      provider = instanceConfig.provider;
      modelId = instanceConfig.modelId;
      modelConfig = instanceConfig.config;
    }
    
    // Create model request
    const modelRequest: ModelRequest = {
      provider,
      modelId,
      messages,
      aiInstanceId,
      maxTokens: payload.maxTokens || modelConfig.maxTokens,
      temperature: payload.temperature || modelConfig.temperature,
      topP: payload.topP || modelConfig.topP,
      stop: payload.stop || modelConfig.stop,
      options: payload.options
    };
    
    console.log(`Processing completion request for AI instance ${aiInstanceId} using ${provider}/${modelId}`);
    
    // Route the model call
    const result = await routeModelCall(modelRequest);
    
    // If successful, track token usage
    if (result.success && result.usage) {
      await trackTokenUsage(aiInstanceId, provider, modelId, result.usage);
    }
    
    return result;
  } catch (error) {
    console.error('Error processing completion request:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error processing completion request'
    };
  }
}

/**
 * Track token usage in Supabase
 * 
 * @param aiInstanceId The AI instance ID
 * @param provider The model provider
 * @param modelId The model ID
 * @param usage Token usage data
 */
async function trackTokenUsage(
  aiInstanceId: string,
  provider: ModelProvider,
  modelId: string,
  usage: TokenUsage
): Promise<void> {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase credentials for token usage tracking');
      return;
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Convert to standard format
    const standardUsage = {
      input_tokens: usage.contextTokens || 0,
      output_tokens: usage.completionTokens || 0,
      total_tokens: usage.totalTokens || 0
    };
    
    // Insert usage record
    const { error } = await supabase.from('usage_logs').insert({
      ai_instance_id: aiInstanceId,
      provider: provider,
      model: modelId,
      operation_type: 'completion',
      input_tokens: standardUsage.input_tokens,
      output_tokens: standardUsage.output_tokens,
      total_tokens: standardUsage.total_tokens,
      created_at: new Date().toISOString()
    });
    
    if (error) {
      console.error('Error tracking token usage:', error);
    }
  } catch (error) {
    console.error('Error tracking token usage:', error);
  }
} 