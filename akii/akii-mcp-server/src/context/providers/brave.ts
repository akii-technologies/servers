/**
 * Brave Search Context Provider
 * 
 * Retrieves context from Brave Search API
 */

import { ContextProvider } from './index';

// Define the response types for Brave Search API
interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
  updated?: string;
  extra_snippets?: string[];
}

interface BraveSearchResponse {
  web?: {
    results?: BraveSearchResult[];
    total?: number;
  };
  news?: {
    results?: BraveSearchResult[];
  };
}

// Define the source result interface
interface ContextSource {
  id: string;
  content: string;
  metadata: {
    source: string;
    url: string;
    title: string;
    date?: string;
  };
}

/**
 * Brave Search Provider Implementation
 * 
 * Provides web search results as context
 */
export class BraveSearchProvider implements ContextProvider {
  private apiKey: string;
  
  constructor() {
    // Load from environment variables
    this.apiKey = process.env.BRAVE_SEARCH_API_KEY || '';
    
    if (!this.apiKey) {
      console.warn('Brave Search provider: Missing API key');
    }
  }
  
  /**
   * Get provider name
   */
  getName(): string {
    return 'brave';
  }
  
  /**
   * Retrieve context from Brave Search
   * 
   * @param query The user's query
   * @param options Additional options
   * @returns Context and sources
   */
  async getContext(query: string, options: any): Promise<{
    context: string;
    sources: ContextSource[];
    tokenCount: number;
  }> {
    try {
      console.log(`Brave Search: Searching for "${query}"`);
      
      const maxResults = options.maxResults || 5;
      
      // If we don't have an API key, return mock data
      if (!this.apiKey) {
        console.warn('Brave Search API key not found, returning mock data');
        return this.getMockResults(query, maxResults);
      }
      
      // Call the Brave Search API
      const url = new URL('https://api.search.brave.com/res/v1/web/search');
      url.searchParams.append('q', query);
      url.searchParams.append('count', maxResults.toString());
      url.searchParams.append('freshness', 'week'); // Prioritize recent results
      
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': this.apiKey
        }
      });
      
      if (!response.ok) {
        throw new Error(`Brave Search API error: ${response.status} ${response.statusText}`);
      }
      
      const data: BraveSearchResponse = await response.json();
      
      // Process the search results
      const sources: ContextSource[] = [];
      let contextString = '';
      
      // Process web results
      if (data.web?.results && data.web.results.length > 0) {
        contextString += 'From web search:\n\n';
        
        data.web.results.forEach((result, index) => {
          const resultId = `web-${index + 1}`;
          
          // Add to sources
          sources.push({
            id: resultId,
            content: result.description,
            metadata: {
              source: 'web',
              url: result.url,
              title: result.title
            }
          });
          
          // Add to context string
          contextString += `Source ${index + 1}: ${result.title}\n`;
          contextString += `URL: ${result.url}\n`;
          contextString += `${result.description}\n`;
          
          // Add extra snippets if available
          if (result.extra_snippets && result.extra_snippets.length > 0) {
            contextString += `Additional information: ${result.extra_snippets.join(' ')}\n`;
          }
          
          contextString += '\n';
        });
      }
      
      // Process news results if available
      if (data.news?.results && data.news.results.length > 0) {
        contextString += 'News results:\n\n';
        
        data.news.results.forEach((result, index) => {
          const resultId = `news-${index + 1}`;
          
          // Add to sources
          sources.push({
            id: resultId,
            content: result.description,
            metadata: {
              source: 'news',
              url: result.url,
              title: result.title,
              date: result.updated
            }
          });
          
          // Add to context string
          contextString += `Source ${index + 1}: ${result.title}\n`;
          contextString += `URL: ${result.url}\n`;
          if (result.updated) {
            contextString += `Date: ${result.updated}\n`;
          }
          contextString += `${result.description}\n\n`;
        });
      }
      
      // If no results were found
      if (sources.length === 0) {
        contextString = `No search results found for: "${query}"`;
      }
      
      // Estimate token count (4 characters per token is a rough estimate)
      const tokenCount = Math.ceil(contextString.length / 4);
      
      console.log(`Brave Search returned ${sources.length} results with approximately ${tokenCount} tokens`);
      
      return {
        context: contextString,
        sources,
        tokenCount
      };
    } catch (error) {
      console.error('Error in Brave Search provider:', error);
      
      // Fall back to mock data on error
      console.log('Falling back to mock data due to API error');
      return this.getMockResults(query);
    }
  }
  
  /**
   * Get mock results when the API is not available
   * 
   * @param query The search query
   * @param maxResults Maximum number of results to return
   * @returns Mock context and sources
   */
  private getMockResults(query: string, maxResults: number = 3): {
    context: string;
    sources: ContextSource[];
    tokenCount: number;
  } {
    const mockSources: ContextSource[] = [
      {
        id: 'web-1',
        content: `Search result about ${query}.`,
        metadata: {
          source: 'web',
          url: 'https://example.com/search-result-1',
          title: `Information about ${query}`
        }
      },
      {
        id: 'web-2',
        content: `Additional information related to ${query} from another source.`,
        metadata: {
          source: 'web',
          url: 'https://example.com/search-result-2',
          title: `More about ${query}`
        }
      }
    ].slice(0, maxResults);
    
    const mockContext = `
From web search:

Source 1: Information about ${query}
URL: https://example.com/search-result-1
Search result about ${query}.

Source 2: More about ${query}
URL: https://example.com/search-result-2
Additional information related to ${query} from another source.
    `.trim();
    
    return {
      context: mockContext,
      sources: mockSources,
      tokenCount: Math.ceil(mockContext.length / 4) // Rough token estimate
    };
  }
}