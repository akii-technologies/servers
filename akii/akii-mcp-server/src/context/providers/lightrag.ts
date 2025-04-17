/**
 * LightRAG Context Provider
 * 
 * Integrates with the LightRAG module to provide document-based context
 */

import { createClient } from '@supabase/supabase-js';
import { ContextProvider } from './index';

// Import LightRAG from local module copy
import LightRAG, { 
  EmbeddingResult, 
  createEmbeddingProvider,
  RetrievalOptions,
  ContextBuilderOptions,
  EmbeddingOptions
} from '../../modules/lightrag';

// Import BraveSearchProvider for fallback search
import { BraveSearchProvider } from './brave';
import { ModelProvider, routeModelCall } from '../../models/modelRouter';

/**
 * LightRAG Context Provider Implementation
 * 
 * Retrieves context from documents using LightRAG's vector search capabilities
 */
export class LightRAGContextProvider implements ContextProvider {
  private supabaseUrl: string;
  private supabaseKey: string;
  private braveSearchProvider: BraveSearchProvider;
  
  constructor() {
    // Load from environment variables
    this.supabaseUrl = process.env.SUPABASE_URL || '';
    this.supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!this.supabaseUrl || !this.supabaseKey) {
      console.warn('LightRAG provider: Missing Supabase credentials');
    }
    
    // Initialize the Brave search provider for fallback
    this.braveSearchProvider = new BraveSearchProvider();
  }
  
  /**
   * Get provider name
   */
  getName(): string {
    return 'lightrag';
  }
  
  /**
   * Summarize web search results using an LLM
   * 
   * @param searchContext The search context to summarize
   * @param aiInstanceId The AI instance ID for token tracking
   * @returns Summarized content and token usage
   */
  private async summarizeWebResults(searchContext: string, aiInstanceId: string): Promise<{
    summary: string;
    tokenUsage: {
      contextTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  }> {
    try {
      console.log('Summarizing web search results...');
      
      // Use Fireworks Claude Instant for summarization as a reasonable default
      const modelId = 'accounts/fireworks/models/claude-3-haiku-20240307';
      
      const messages = [
        {
          role: 'system',
          content: 'You are a helpful assistant that summarizes search results into concise, informative content.'
        },
        {
          role: 'user',
          content: `Please summarize the following search results into a comprehensive response. Extract the most relevant information and present it in a clear, objective manner. Include key facts and details from multiple sources when available.

Search Results:
${searchContext}

Create a summary that:
1. Captures the main points and key information
2. Synthesizes information from multiple sources when possible
3. Maintains factual accuracy
4. Is formatted with clear paragraphs and bullet points where appropriate
5. Is between 200-500 words`
        }
      ];
      
      // Call the model router to get a summary
      const response = await routeModelCall({
        provider: ModelProvider.FIREWORKS,
        modelId,
        messages,
        maxTokens: 1000,
        temperature: 0.3,
        aiInstanceId
      });
      
      if (!response.success || !response.data?.content) {
        throw new Error('Failed to summarize web results: ' + (response.error || 'Unknown error'));
      }
      
      // Track usage
      const tokenUsage = {
        contextTokens: response.usage?.contextTokens || 0,
        completionTokens: response.usage?.completionTokens || 0,
        totalTokens: response.usage?.totalTokens || 0
      };
      
      // Add a citation note
      const summary = `${response.data.content}\n\n(This information is from web search results and may not be fully accurate. Refer to the original sources for verification.)`;
      
      console.log(`Web search results summarized with ${tokenUsage.totalTokens} tokens`);
      
      return {
        summary,
        tokenUsage
      };
    } catch (error) {
      console.error('Error summarizing web results:', error);
      return {
        summary: 'Unable to summarize web search results due to an error.',
        tokenUsage: {
          contextTokens: 0,
          completionTokens: 0,
          totalTokens: 0
        }
      };
    }
  }
  
  /**
   * Track summarization token usage in Supabase
   * 
   * @param aiInstanceId The AI instance ID
   * @param tokenUsage Token usage data
   */
  private async trackSummarizationUsage(
    aiInstanceId: string, 
    tokenUsage: { contextTokens: number; completionTokens: number; totalTokens: number; }
  ): Promise<void> {
    try {
      // Initialize Supabase client
      const supabase = createClient(this.supabaseUrl, this.supabaseKey);
      
      // Insert usage record
      const { error } = await supabase.from('usage_logs').insert({
        ai_instance_id: aiInstanceId,
        provider: 'fireworks',
        model: 'claude-3-haiku-20240307',
        operation_type: 'summarization',
        input_tokens: tokenUsage.contextTokens,
        output_tokens: tokenUsage.completionTokens,
        total_tokens: tokenUsage.totalTokens,
        created_at: new Date().toISOString()
      });
      
      if (error) {
        console.error('Error tracking summarization token usage:', error);
      } else {
        console.log(`Tracked ${tokenUsage.totalTokens} summarization tokens`);
      }
    } catch (error) {
      console.error('Error tracking summarization token usage:', error);
    }
  }
  
  /**
   * Retrieve context using LightRAG
   * 
   * @param query The user's query
   * @param options Additional options including aiInstanceId
   * @returns Context and sources
   */
  async getContext(query: string, options: any): Promise<{
    context: string;
    sources: any[];
    tokenCount: number;
  }> {
    try {
      // Validate required options
      if (!options.aiInstanceId) {
        throw new Error('aiInstanceId is required');
      }
      
      console.log(`LightRAG: Retrieving context for AI instance ${options.aiInstanceId} with query "${query}"`);
      
      // Initialize Supabase client
      const supabase = createClient(this.supabaseUrl, this.supabaseKey);
      
      // Get RAG configuration for this AI instance
      const { data: ragConfig, error: configError } = await supabase
        .from('rag_configurations')
        .select('*')
        .eq('ai_instance_id', options.aiInstanceId)
        .single();
      
      if (configError) {
        console.warn(`No RAG configuration found for AI instance ${options.aiInstanceId}, using defaults`);
      }
      
      // Set default or use configured values
      const embeddingProvider = ragConfig?.embedding_provider || options.embeddingProvider || 'fireworks';
      const embeddingModel = ragConfig?.embedding_model_id || options.embeddingModel || 'deepseek-v3';
      const maxChunks = ragConfig?.max_chunks || options.maxChunks || 5;
      const similarityThreshold = ragConfig?.similarity_threshold || options.similarityThreshold || 0.7;
      const maxTokens = options.maxTokens || 4000;
      const enableDeduplication = ragConfig?.enable_deduplication ?? true;
      const trackTokenUsage = ragConfig?.track_token_usage ?? true;
      const enableFallbackSearch = ragConfig?.enable_fallback_search ?? true;
      
      // Create LightRAG instance
      const lightrag = new LightRAG({
        supabaseUrl: this.supabaseUrl,
        supabaseKey: this.supabaseKey
      });
      
      // Generate embedding for query using configured provider
      console.log(`Generating embedding using ${embeddingProvider} / ${embeddingModel}`);
      
      let embedding: number[] = [];
      try {
        // Create embedding provider
        const provider = createEmbeddingProvider(
          embeddingProvider,
          embeddingModel,
          { trackUsage: true }
        );
        
        // Generate embedding
        const embeddingResult = await provider.generateEmbedding(query, options.aiInstanceId);
        embedding = embeddingResult.embedding;
      } catch (error) {
        console.error('Error generating embedding:', error);
        throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      // Set up retrieval options
      const retrievalOptions: RetrievalOptions = {
        aiInstanceId: options.aiInstanceId,
        maxChunks: maxChunks,
        similarityThreshold: similarityThreshold,
        filter: options.filter || {}
      };
      
      // Set up context builder options
      const contextOptions: ContextBuilderOptions = {
        maxContextLength: maxTokens,
        formatAsJson: false,
        includeMetadata: true,
        deduplicate: enableDeduplication
      };
      
      // Generate context using LightRAG
      console.log(`Retrieving documents and building context`);
      const contextResult = await lightrag.generateContext(
        embedding, 
        retrievalOptions,
        contextOptions
      );
      
      // Log the results
      console.log(`Retrieved ${contextResult.sources.length} relevant documents with a total of ${contextResult.tokenCount} tokens`);
      
      // If we have results, return them
      if (contextResult.sources.length > 0) {
        return {
          context: contextResult.context,
          sources: contextResult.sources,
          tokenCount: contextResult.tokenCount
        };
      }
      
      // No results found in vector search, try fallback search if enabled
      if (enableFallbackSearch) {
        console.log('No vector search results found, falling back to web search');
        
        try {
          // Call Brave Search provider
          const braveSearchResult = await this.braveSearchProvider.getContext(query, { 
            aiInstanceId: options.aiInstanceId,
            maxResults: 5 
          });
          
          // If we got search results, summarize them
          if (braveSearchResult.context) {
            console.log('Web search found results, summarizing...');
            
            // Get summary of search results
            const { summary, tokenUsage } = await this.summarizeWebResults(
              braveSearchResult.context,
              options.aiInstanceId
            );
            
            // Track usage for the summarization
            if (trackTokenUsage) {
              await this.trackSummarizationUsage(options.aiInstanceId, tokenUsage);
            }
            
            // Return the summarized context with sources
            return {
              context: summary,
              sources: braveSearchResult.sources,
              tokenCount: tokenUsage.totalTokens
            };
          }
        } catch (searchError) {
          console.error('Error in fallback search:', searchError);
        }
      }
      
      // If everything failed, return the empty context
      return {
        context: contextResult.context,
        sources: contextResult.sources,
        tokenCount: contextResult.tokenCount
      };
    } catch (error) {
      console.error('Error in LightRAG context provider:', error);
      
      // Return a graceful error message in production
      const errorMessage = `
Unable to retrieve contextual information from documents at this time. The RAG system encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}
      `.trim();
      
      return {
        context: errorMessage,
        sources: [],
        tokenCount: Math.ceil(errorMessage.length / 4)
      };
    }
  }
}