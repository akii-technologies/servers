/**
 * Context Handler
 * 
 * Handles context retrieval requests from various sources including LightRAG
 */

import { McpResponse } from '../mcp';
import { 
  ContextProvider, 
  createProviderRegistry
} from './providers/index';
import { formatPrompt, formatMessagesPrompt, PromptFormat, PromptOptions, FormattedPrompt } from './formatters/promptFormatter';

// Register context providers
const contextProviders: Record<string, ContextProvider> = createProviderRegistry();

// Re-export the ContextProvider interface
export { ContextProvider } from './providers/index';

/**
 * Handle context retrieval requests
 * 
 * @param payload The context request payload
 * @param metadata Additional metadata
 * @returns MCP response with context data
 */
export async function handleContextRequest(
  payload: any,
  metadata?: Record<string, any>
): Promise<McpResponse> {
  try {
    // Validate payload
    if (!payload.query) {
      throw new Error('Query is required');
    }
    
    const {
      query,
      aiInstanceId,
      maxTokens = 4000,
      providers = ['lightrag'],
      options = {},
      formatOptions = {}
    } = payload;
    
    // Get enabled providers configuration from instance settings
    // For now, use the providers specified in the request
    const enabledProviders = providers.filter(
      (provider: string) => contextProviders[provider]
    );
    
    if (enabledProviders.length === 0) {
      throw new Error('No valid context providers specified');
    }
    
    console.log(`Retrieving context for query: "${query}" using providers: ${enabledProviders.join(', ')}`);
    
    // Fetch context from each provider in parallel
    const contextResults = await Promise.all(
      enabledProviders.map(async (providerName: string) => {
        const provider = contextProviders[providerName];
        try {
          const providerOptions = {
            ...options,
            aiInstanceId,
            maxTokens: Math.floor(maxTokens / enabledProviders.length) // Distribute token budget
          };
          
          return await provider.getContext(query, providerOptions);
        } catch (error) {
          console.error(`Error from ${providerName} provider:`, error);
          return {
            context: '',
            sources: [],
            tokenCount: 0,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      })
    );
    
    // Combine contexts, respecting token limits
    let combinedContext = '';
    let combinedSources: any[] = [];
    let totalTokens = 0;
    
    contextResults.forEach((result, index) => {
      if (result.context && result.tokenCount > 0) {
        combinedContext += (combinedContext ? '\n\n' : '') + result.context;
        combinedSources = [...combinedSources, ...result.sources];
        totalTokens += result.tokenCount;
      }
    });
    
    // Format context if requested
    let formattedPromptResult: FormattedPrompt | { formatted: string; tokenCount: number } = {
      formatted: combinedContext,
      tokenCount: 0
    };
    
    if (formatOptions.format) {
      try {
        const promptOptions: PromptOptions = {
          systemPrompt: formatOptions.systemPrompt,
          format: formatOptions.format as PromptFormat
        };
        
        if (formatOptions.useMessagesFormat && formatOptions.format) {
          const messagesJson = formatMessagesPrompt(
            query,
            combinedContext,
            formatOptions.systemPrompt
          );
          formattedPromptResult = {
            formatted: messagesJson,
            tokenCount: Math.ceil((combinedContext.length + query.length + (formatOptions.systemPrompt?.length || 0)) / 4)
          };
        } else {
          formattedPromptResult = formatPrompt(
            query,
            combinedContext,
            promptOptions
          );
        }
      } catch (error) {
        console.error('Error formatting context:', error);
        // Fall back to unformatted context
      }
    }
    
    return {
      success: true,
      data: {
        context: combinedContext,
        formattedPrompt: formattedPromptResult.formatted,
        sources: combinedSources,
        tokenCount: totalTokens,
        totalTokens: totalTokens + formattedPromptResult.tokenCount,
        providers: enabledProviders
      }
    };
    
  } catch (error) {
    console.error('Error handling context request:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      data: null
    };
  }
}