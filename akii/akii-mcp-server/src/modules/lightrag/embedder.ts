/**
 * Embedder module for LightRAG
 * 
 * Handles the generation of embeddings from different providers.
 */

import { EmbeddingResult } from './index';
import { createClient } from '@supabase/supabase-js';

// Interface for embedding provider implementations
export interface EmbeddingProvider {
  generateEmbedding(text: string, aiInstanceId?: string): Promise<EmbeddingResult>;
}

/**
 * Track embedding token usage in Supabase
 * 
 * @param aiInstanceId The AI instance ID
 * @param provider The model provider
 * @param modelId The model ID
 * @param tokenCount Token usage data
 */
async function trackEmbeddingUsage(
  aiInstanceId: string,
  provider: string,
  modelId: string,
  tokenCount: number
): Promise<void> {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase credentials for token usage tracking');
      return;
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Insert usage record
    const { error } = await supabase.from('usage_logs').insert({
      ai_instance_id: aiInstanceId,
      provider: provider,
      model: modelId,
      operation_type: 'embedding',
      input_tokens: tokenCount,
      output_tokens: 0, // Embeddings only have input tokens
      total_tokens: tokenCount,
      created_at: new Date().toISOString()
    });
    
    if (error) {
      console.error('Error tracking embedding token usage:', error);
    } else {
      console.log(`Tracked ${tokenCount} embedding tokens for ${provider}/${modelId}`);
    }
  } catch (error) {
    console.error('Error tracking embedding token usage:', error);
  }
}

/**
 * Bedrock embedding provider using Amazon's Titan model
 */
export class BedrockEmbedder implements EmbeddingProvider {
  private modelId: string;
  private region: string;
  private accessKeyId: string;
  private secretAccessKey: string;
  private trackUsage: boolean;
  
  constructor(
    modelId: string = 'amazon.titan-embed-text-v1', 
    region: string = 'us-east-1',
    config?: { 
      accessKeyId?: string; 
      secretAccessKey?: string;
      trackUsage?: boolean;
    }
  ) {
    this.modelId = modelId;
    this.region = region;
    this.accessKeyId = config?.accessKeyId || process.env.AWS_ACCESS_KEY_ID || '';
    this.secretAccessKey = config?.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || '';
    this.trackUsage = config?.trackUsage !== undefined ? config.trackUsage : true;
    
    if (!this.accessKeyId || !this.secretAccessKey) {
      console.warn('AWS credentials not provided, Bedrock embeddings will fail');
    }
  }
  
  async generateEmbedding(text: string, aiInstanceId?: string): Promise<EmbeddingResult> {
    try {
      // Validate credentials
      if (!this.accessKeyId || !this.secretAccessKey) {
        throw new Error('AWS credentials are required for Bedrock embedding generation');
      }
      
      console.log(`Generating embedding with Bedrock using model: ${this.modelId}`);
      
      // For Node.js environments (we would use AWS SDK v3)
      // This would work in a full implementation with the AWS SDK
      /*
      import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
      
      const bedrockClient = new BedrockRuntimeClient({
        region: this.region,
        credentials: {
          accessKeyId: this.accessKeyId,
          secretAccessKey: this.secretAccessKey,
        },
      });
      
      const input = {
        body: JSON.stringify({
          inputText: text
        }),
        modelId: this.modelId,
        contentType: 'application/json',
        accept: 'application/json',
      };
      
      const command = new InvokeModelCommand(input);
      const response = await bedrockClient.send(command);
      
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      const embedding = responseBody.embedding;
      */
      
      // For now, since we can't directly import AWS SDK without modifying the build configuration,
      // we'll use a fallback approach of making the API call directly or using a mock
      
      // Estimate token count - Titan usually counts 1 token per ~4 characters of English text
      const estimatedTokenCount = Math.ceil(text.length / 4);
      
      // In a real implementation, fetch the embedding from Bedrock
      // For now, mock with a controlled random embedding
      console.warn('Using mock Bedrock embedding - implement actual AWS SDK integration in production');
      const seed = text.length; // Use text length as seed for deterministic output
      const mockEmbedding = new Array(1536).fill(0).map((_, i) => 
        Math.sin(i * 0.01 + seed * 0.1) * 0.5 // Deterministic values between -0.5 and 0.5
      );
      
      // Track token usage if enabled and aiInstanceId is provided
      if (this.trackUsage && aiInstanceId) {
        await trackEmbeddingUsage(
          aiInstanceId,
          'bedrock',
          this.modelId,
          estimatedTokenCount
        );
      }
      
      return {
        embedding: mockEmbedding,
        tokenCount: estimatedTokenCount
      };
    } catch (error) {
      console.error('Bedrock embedding error:', error);
      throw new Error(`Failed to generate embedding with Bedrock: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Fireworks embedding provider
 */
export class FireworksEmbedder implements EmbeddingProvider {
  private modelId: string;
  private apiKey: string;
  private trackUsage: boolean;
  
  constructor(
    modelId: string = 'deepseek-v3', 
    apiKey?: string, 
    config?: { trackUsage?: boolean }
  ) {
    this.modelId = modelId;
    // Use provided API key or try to get from environment
    this.apiKey = apiKey || process.env.FIREWORKS_API_KEY || '';
    this.trackUsage = config?.trackUsage !== undefined ? config.trackUsage : true;
    
    if (!this.apiKey) {
      console.warn('No Fireworks API key provided, embeddings will fail');
    }
  }
  
  async generateEmbedding(text: string, aiInstanceId?: string): Promise<EmbeddingResult> {
    try {
      if (!this.apiKey) {
        throw new Error('Fireworks API key is required for embedding generation');
      }
      
      // Determine the model endpoint based on the modelId
      let embeddingModel = this.modelId;
      
      // Map model IDs to actual model paths
      if (this.modelId === 'deepseek-v3') {
        embeddingModel = 'accounts/fireworks/models/deepseek-v3-embedding';
      } else if (this.modelId === 'deepseek-v2-lite') {
        embeddingModel = 'accounts/fireworks/models/deepseek-v2-lite-embedding';
      }
      
      // Calculate approximate token count for tracking
      const estimatedTokenCount = Math.ceil(text.length / 4);
      
      console.log(`Generating embedding with Fireworks using model: ${embeddingModel}`);
      
      // Make the API request to Fireworks
      const response = await fetch('https://api.fireworks.ai/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: embeddingModel,
          input: text
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Fireworks API error: ${response.status} - ${JSON.stringify(errorData)}`);
      }
      
      const data = await response.json();
      
      // Extract embedding and token usage from response
      const embedding = data.data?.[0]?.embedding;
      const tokenCount = data.usage?.total_tokens || estimatedTokenCount;
      
      if (!embedding || !Array.isArray(embedding)) {
        throw new Error('Invalid embedding response from Fireworks API');
      }
      
      console.log(`Successfully generated embedding with ${tokenCount} tokens`);
      
      // Track token usage if enabled and aiInstanceId is provided
      if (this.trackUsage && aiInstanceId) {
        await trackEmbeddingUsage(
          aiInstanceId,
          'fireworks',
          this.modelId,
          tokenCount
        );
      }
      
      return {
        embedding,
        tokenCount: tokenCount
      };
    } catch (error) {
      console.error('Fireworks embedding error:', error);
      throw new Error(`Failed to generate embedding with Fireworks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Creates an appropriate embedding provider based on configuration
 * 
 * @param provider The provider name ('bedrock', 'fireworks')
 * @param modelId Optional model ID for the specific provider
 * @param config Additional provider-specific configuration
 * @returns An initialized embedding provider
 */
export function createEmbeddingProvider(
  provider: string, 
  modelId?: string,
  config?: {
    apiKey?: string;
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    trackUsage?: boolean;
  }
): EmbeddingProvider {
  // Default provider is Fireworks if not specified
  const providerName = provider?.toLowerCase() || 'fireworks';
  
  console.log(`Creating embedding provider: ${providerName}${modelId ? ` with model ${modelId}` : ''}`);
  
  switch (providerName) {
    case 'bedrock':
      return new BedrockEmbedder(
        modelId,
        config?.region || 'us-east-1',
        {
          accessKeyId: config?.accessKeyId,
          secretAccessKey: config?.secretAccessKey,
          trackUsage: config?.trackUsage
        }
      );
    
    case 'fireworks':
      return new FireworksEmbedder(
        modelId || 'deepseek-v3',
        config?.apiKey,
        { trackUsage: config?.trackUsage }
      );
    
    default:
      // Default to Fireworks if provider not recognized
      console.warn(`Unknown embedding provider '${provider}', defaulting to Fireworks`);
      return new FireworksEmbedder(
        modelId || 'deepseek-v3', 
        config?.apiKey,
        { trackUsage: config?.trackUsage }
      );
  }
}

export default createEmbeddingProvider; 