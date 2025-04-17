/**
 * LightRAG Mock Implementation
 * 
 * This provides test-friendly mocks of the LightRAG module for testing.
 */

export interface Document {
  id: string;
  content: string;
  metadata?: Record<string, any>;
  embedding?: number[];
}

export interface EmbeddingResponse {
  embedding: number[];
  tokenCount: number;
}

export interface SearchOptions {
  maxResults?: number;
  minScore?: number;
  filter?: Record<string, any>;
}

export interface SearchResult {
  documents: Document[];
  scores: number[];
  tokenCount: number;
}

/**
 * Mock implementation of the LightRAG client
 */
export class LightRAGClient {
  async createEmbedding(text: string): Promise<EmbeddingResponse> {
    return {
      embedding: Array(128).fill(0).map(() => Math.random()),
      tokenCount: Math.ceil(text.length / 4)
    };
  }

  async searchDocuments(
    query: string,
    options?: SearchOptions
  ): Promise<SearchResult> {
    return {
      documents: [
        {
          id: 'mock-doc-1',
          content: 'This is a mock document content for testing',
          metadata: { source: 'test' }
        }
      ],
      scores: [0.95],
      tokenCount: Math.ceil(query.length / 4)
    };
  }

  async addDocuments(documents: Document[]): Promise<string[]> {
    return documents.map((_, i) => `mock-id-${i}`);
  }

  async getDocument(id: string): Promise<Document | null> {
    return {
      id,
      content: 'Mock document content',
      metadata: { source: 'test' }
    };
  }
}

/**
 * Create a new LightRAG client instance
 */
export function createLightRAGClient(): LightRAGClient {
  return new LightRAGClient();
}