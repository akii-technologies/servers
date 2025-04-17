/**
 * LightRAG - Lightweight Retrieval Augmented Generation for Supabase
 * 
 * A simple RAG implementation for Supabase with pgvector.
 */

import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Core LightRAG module for Supabase
 * 
 * A lightweight Retrieval Augmented Generation implementation for Supabase
 */

// Core type definitions
export interface Document {
  id?: string;
  content: string;
  metadata?: Record<string, any>;
  score?: number;
  embedding?: number[];
}

export interface ContextResult {
  context: string;
  sources: Document[];
  tokenCount: number;
}

export interface RetrievalResult {
  documents: Document[];
  totalFound: number;
}

export interface EmbeddingResult {
  embedding: number[];
  tokenCount: number;
}

export interface RetrievalOptions {
  aiInstanceId: string;
  maxChunks: number;
  similarityThreshold: number;
  filter?: Record<string, any>;
}

export interface ContextBuilderOptions {
  maxContextLength?: number;
  formatAsJson?: boolean;
  includeMetadata?: boolean;
  separator?: string;
  deduplicate?: boolean;
}

export interface LightRAGOptions {
  supabaseUrl?: string;
  supabaseKey?: string;
}

export interface EmbeddingOptions {
  provider: string;
  modelId: string;
  trackUsage?: boolean;
  aiInstanceId?: string;
  config?: {
    apiKey?: string;
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
  };
}

// Import components
import ContextBuilder from './context-builder';
import SupabaseRetriever from './retriever';
import createEmbeddingProvider from './embedder';

/**
 * Main LightRAG class that orchestrates document retrieval and context building
 */
export class LightRAG {
  private retriever: SupabaseRetriever;
  private contextBuilder: ContextBuilder;
  
  constructor(options?: LightRAGOptions) {
    this.retriever = new SupabaseRetriever(
      options?.supabaseUrl || '',
      options?.supabaseKey || ''
    );
    this.contextBuilder = new ContextBuilder();
  }
  
  /**
   * Generate embedding for a query with token tracking
   */
  async generateEmbedding(query: string, options: EmbeddingOptions): Promise<EmbeddingResult> {
    const provider = createEmbeddingProvider(
      options.provider, 
      options.modelId, 
      {
        apiKey: options.config?.apiKey,
        region: options.config?.region,
        accessKeyId: options.config?.accessKeyId,
        secretAccessKey: options.config?.secretAccessKey,
        trackUsage: options.trackUsage !== undefined ? options.trackUsage : true
      }
    );
    
    return provider.generateEmbedding(query, options.aiInstanceId);
  }
  
  /**
   * Retrieve documents based on query embedding
   */
  async retrieveDocuments(embedding: number[], options: RetrievalOptions): Promise<RetrievalResult> {
    return this.retriever.retrieveDocuments(embedding, options);
  }
  
  /**
   * Build context from retrieved documents
   */
  buildContext(documents: Document[], options?: ContextBuilderOptions): ContextResult {
    return this.contextBuilder.buildContext(documents, options);
  }
  
  /**
   * Generate context in one step
   */
  async generateContext(embedding: number[], options: RetrievalOptions, contextOptions?: ContextBuilderOptions): Promise<ContextResult> {
    const retrievalResult = await this.retrieveDocuments(embedding, options);
    return this.buildContext(retrievalResult.documents, contextOptions);
  }
  
  /**
   * End-to-end RAG pipeline: query to context
   * This function handles the entire RAG pipeline from query to context generation
   */
  async queryToContext(
    query: string, 
    embeddingOptions: EmbeddingOptions, 
    retrievalOptions: RetrievalOptions, 
    contextOptions?: ContextBuilderOptions
  ): Promise<ContextResult> {
    // Generate embedding
    const embeddingResult = await this.generateEmbedding(query, embeddingOptions);
    
    // Retrieve documents
    const retrievalResult = await this.retrieveDocuments(embeddingResult.embedding, retrievalOptions);
    
    // Build context
    return this.buildContext(retrievalResult.documents, contextOptions);
  }
}

// Export components
export {
  ContextBuilder,
  SupabaseRetriever,
  createEmbeddingProvider
};

export default LightRAG; 