/**
 * Model Router
 * 
 * Handles routing of model calls to various providers based on instance configuration.
 * Supports Bedrock, Fireworks, OpenAI, and other providers through a unified interface.
 */

import { McpResponse } from '../mcp';
import { createClient } from '@supabase/supabase-js';
// Add this to ignore the missing module errors, as we're using dynamic imports
// @ts-ignore
import type AWS from 'aws-sdk';
// @ts-ignore
import type { OpenAI } from 'openai';

// Model provider types
export enum ModelProvider {
  BEDROCK = 'bedrock',
  FIREWORKS = 'fireworks',
  OPENAI = 'openai',
  OPENROUTER = 'openrouter'
}

// Model request interface
export interface ModelRequest {
  provider: ModelProvider;
  modelId: string;
  messages: any[];
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stop?: string[];
  aiInstanceId: string;
  options?: Record<string, any>;
}

// Usage tracking interface - this matches the McpResponse usage property
export interface TokenUsage {
  contextTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

// Provider response interfaces
interface OpenAIStyleUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface OpenAIStyleResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage: OpenAIStyleUsage;
}

// Default model configuration
const DEFAULT_MODEL_CONFIG = {
  maxTokens: 1000,
  temperature: 0.7,
  topP: 0.9
};

// Provider-specific clients
let bedrockClient: any = null;
let fireworksClient: any = null;
let openaiClient: any = null;
let openrouterClient: any = null;

/**
 * Route model call to the appropriate provider
 * 
 * @param request The model request
 * @returns Response from the model with standardized format
 */
export async function routeModelCall(request: ModelRequest): Promise<McpResponse> {
  const { provider, modelId, aiInstanceId } = request;
  
  try {
    console.log(`Routing model call to ${provider} for model ${modelId}`);
    
    // Merge default config with request config
    const modelConfig = {
      ...DEFAULT_MODEL_CONFIG,
      maxTokens: request.maxTokens || DEFAULT_MODEL_CONFIG.maxTokens,
      temperature: request.temperature || DEFAULT_MODEL_CONFIG.temperature,
      topP: request.topP || DEFAULT_MODEL_CONFIG.topP,
      stop: request.stop || []
    };
    
    // Check credentials for the specified provider
    const credentials = await getProviderCredentials(provider, aiInstanceId);
    
    if (!credentials && provider !== ModelProvider.OPENROUTER) {
      throw new Error(`No credentials found for provider ${provider}`);
    }
    
    // Route to the appropriate provider
    switch (provider) {
      case ModelProvider.BEDROCK:
        return await callBedrockModel(modelId, request.messages, modelConfig, credentials);
      case ModelProvider.FIREWORKS:
        return await callFireworksModel(modelId, request.messages, modelConfig, credentials);
      case ModelProvider.OPENAI:
        return await callOpenAIModel(modelId, request.messages, modelConfig, credentials);
      case ModelProvider.OPENROUTER:
        return await callOpenRouterModel(modelId, request.messages, modelConfig, credentials);
      default:
        throw new Error(`Unsupported model provider: ${provider}`);
    }
  } catch (error) {
    console.error(`Error routing model call:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error in model router'
    };
  }
}

/**
 * Get provider credentials from Supabase
 * 
 * @param provider The model provider
 * @param aiInstanceId The AI instance ID
 * @returns Provider credentials or null if not found
 */
async function getProviderCredentials(provider: ModelProvider, aiInstanceId: string): Promise<any> {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase credentials');
      return null;
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get organization ID for the AI instance
    const { data: aiInstance, error: instanceError } = await supabase
      .from('ai_instances')
      .select('organization_id')
      .eq('id', aiInstanceId)
      .single();
    
    if (instanceError || !aiInstance) {
      console.error('Error getting AI instance:', instanceError);
      return null;
    }
    
    // Get provider credentials for the organization
    const { data: credentials, error: credentialsError } = await supabase
      .from('model_provider_credentials')
      .select('credentials')
      .eq('organization_id', aiInstance.organization_id)
      .eq('provider', provider)
      .eq('active', true)
      .single();
    
    if (credentialsError || !credentials) {
      console.error('Error getting provider credentials:', credentialsError);
      return null;
    }
    
    return credentials.credentials;
  } catch (error) {
    console.error('Error getting provider credentials:', error);
    return null;
  }
}

/**
 * Call AWS Bedrock model
 */
async function callBedrockModel(modelId: string, messages: any[], config: any, credentials: any): Promise<McpResponse> {
  try {
    // Lazy-load the AWS SDK to avoid loading it unless needed
    if (!bedrockClient) {
      try {
        const AWS = await import('aws-sdk');
        AWS.config.update({
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          region: credentials.region || 'us-west-2'
        });
        bedrockClient = new AWS.BedrockRuntime();
      } catch (error) {
        console.error('Error loading AWS SDK:', error);
        throw new Error('Failed to initialize AWS Bedrock client');
      }
    }
    
    // Format the request based on the model
    let requestBody;
    let responseMapping;
    
    if (modelId.includes('claude')) {
      // Anthropic Claude format
      requestBody = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        top_p: config.topP,
        stop_sequences: config.stop,
        messages: messages
      };
      responseMapping = (response: any) => ({
        content: response.content[0].text,
        usage: {
          contextTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens
        }
      });
    } else if (modelId.includes('titan')) {
      // Amazon Titan format
      requestBody = {
        inputText: messages[messages.length - 1].content,
        textGenerationConfig: {
          maxTokenCount: config.maxTokens,
          temperature: config.temperature,
          topP: config.topP,
          stopSequences: config.stop
        }
      };
      responseMapping = (response: any) => ({
        content: response.results[0].outputText,
        usage: {
          contextTokens: 0, // Not provided by Titan
          completionTokens: 0, // Not provided by Titan
          totalTokens: 0 // Not provided by Titan
        }
      });
    } else {
      throw new Error(`Unsupported Bedrock model: ${modelId}`);
    }
    
    // Call Bedrock
    const params = {
      modelId: modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(requestBody)
    };
    
    const bedrockResponse = await bedrockClient.invokeModel(params).promise();
    const responseBody = JSON.parse(bedrockResponse.body.toString());
    const mappedResponse = responseMapping(responseBody);
    
    return {
      success: true,
      data: {
        content: mappedResponse.content
      },
      usage: mappedResponse.usage
    };
  } catch (error) {
    console.error('Error calling Bedrock model:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error calling Bedrock model'
    };
  }
}

/**
 * Call Fireworks model using OpenAI-compatible API
 */
async function callFireworksModel(modelId: string, messages: any[], config: any, credentials: any): Promise<McpResponse> {
  try {
    // Use node-fetch to make the API request
    const fetch = (await import('node-fetch')).default;
    
    const apiKey = credentials.apiKey;
    const baseUrl = 'https://api.fireworks.ai/inference/v1';
    
    const requestBody = {
      model: modelId,
      messages: messages,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      top_p: config.topP,
      stop: config.stop
    };
    
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Fireworks API error (${response.status}): ${errorText}`);
    }
    
    const responseData = await response.json() as OpenAIStyleResponse;
    
    // Convert OpenAI-style usage to our format
    const usage: TokenUsage = {
      contextTokens: responseData.usage?.prompt_tokens || 0,
      completionTokens: responseData.usage?.completion_tokens || 0,
      totalTokens: responseData.usage?.total_tokens || 0
    };
    
    return {
      success: true,
      data: {
        content: responseData.choices[0].message.content
      },
      usage
    };
  } catch (error) {
    console.error('Error calling Fireworks model:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error calling Fireworks model'
    };
  }
}

/**
 * Call OpenAI model
 */
async function callOpenAIModel(modelId: string, messages: any[], config: any, credentials: any): Promise<McpResponse> {
  try {
    // Lazy-load the OpenAI SDK to avoid loading it unless needed
    if (!openaiClient) {
      try {
        // Dynamic import of OpenAI SDK
        const { OpenAI } = await import('openai');
        openaiClient = new OpenAI({
          apiKey: credentials.apiKey
        });
      } catch (error) {
        console.error('Error loading OpenAI SDK:', error);
        throw new Error('Failed to initialize OpenAI client');
      }
    }
    
    const response = await openaiClient.chat.completions.create({
      model: modelId,
      messages: messages,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      top_p: config.topP,
      stop: config.stop
    });
    
    // Convert OpenAI usage to our format
    const usage: TokenUsage = {
      contextTokens: response.usage?.prompt_tokens || 0,
      completionTokens: response.usage?.completion_tokens || 0,
      totalTokens: response.usage?.total_tokens || 0
    };
    
    return {
      success: true,
      data: {
        content: response.choices[0].message.content || ''
      },
      usage
    };
  } catch (error) {
    console.error('Error calling OpenAI model:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error calling OpenAI model'
    };
  }
}

/**
 * Call OpenRouter model
 */
async function callOpenRouterModel(modelId: string, messages: any[], config: any, credentials: any): Promise<McpResponse> {
  try {
    // Use node-fetch to make the API request
    const fetch = (await import('node-fetch')).default;
    
    const apiKey = credentials?.apiKey || process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('No OpenRouter API key found');
    }
    
    const baseUrl = 'https://openrouter.ai/api/v1';
    
    const requestBody = {
      model: modelId,
      messages: messages,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      top_p: config.topP,
      stop: config.stop
    };
    
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://akii.ai',
        'X-Title': 'Akii AI Platform'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
    }
    
    const responseData = await response.json() as OpenAIStyleResponse;
    
    // Convert OpenAI-style usage to our format
    const usage: TokenUsage = {
      contextTokens: responseData.usage?.prompt_tokens || 0,
      completionTokens: responseData.usage?.completion_tokens || 0,
      totalTokens: responseData.usage?.total_tokens || 0
    };
    
    return {
      success: true,
      data: {
        content: responseData.choices[0].message.content
      },
      usage
    };
  } catch (error) {
    console.error('Error calling OpenRouter model:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error calling OpenRouter model'
    };
  }
}

/**
 * Get instance-specific model configuration
 * 
 * @param aiInstanceId The AI instance ID
 * @returns Model configuration for the instance
 */
export async function getInstanceModelConfig(aiInstanceId: string): Promise<{
  provider: ModelProvider;
  modelId: string;
  config: Record<string, any>;
} | null> {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase credentials');
      return null;
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get model configuration for the instance
    const { data: modelConfig, error: configError } = await supabase
      .from('ai_instance_model_configs')
      .select('provider, model_id, config')
      .eq('ai_instance_id', aiInstanceId)
      .single();
    
    if (configError || !modelConfig) {
      console.error('Error getting model configuration:', configError);
      return null;
    }
    
    return {
      provider: modelConfig.provider as ModelProvider,
      modelId: modelConfig.model_id,
      config: modelConfig.config || {}
    };
  } catch (error) {
    console.error('Error getting instance model config:', error);
    return null;
  }
} 