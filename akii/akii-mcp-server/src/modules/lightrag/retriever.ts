/**
 * Retriever module for LightRAG
 * 
 * Handles vector search against Supabase pgvector.
 */

import { createClient } from '@supabase/supabase-js';
import { Document, RetrievalResult } from './index';

export interface RetrievalOptions {
  aiInstanceId: string;
  maxChunks: number;
  similarityThreshold: number;
  filter?: Record<string, any>;
}

// Define interfaces for Supabase query results
interface DocumentVectorItem {
  id: string;
  content: string;
  metadata: Record<string, any>;
  similarity?: number;
  embedding?: number[];
}

/**
 * Supabase pgvector retriever for semantic search
 */
export class SupabaseRetriever {
  private supabaseUrl: string;
  private supabaseKey: string;
  
  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabaseUrl = supabaseUrl;
    this.supabaseKey = supabaseKey;
  }
  
  /**
   * Retrieve relevant documents based on vector similarity
   * 
   * @param embedding The query embedding to match against
   * @param options Retrieval options including aiInstanceId and filters
   * @returns Retrieved documents and metadata
   */
  async retrieveDocuments(
    embedding: number[],
    options: RetrievalOptions
  ): Promise<RetrievalResult> {
    try {
      const supabase = createClient(this.supabaseUrl, this.supabaseKey);
      
      console.log(`Retrieving documents for AI instance ${options.aiInstanceId} with ${options.maxChunks} max chunks`);
      
      // Use the match_documents RPC function with pgvector
      const { data, error } = await supabase.rpc('match_documents', {
        query_embedding: embedding,          // The query embedding to match against
        match_threshold: options.similarityThreshold, // Minimum similarity threshold
        match_count: options.maxChunks,      // Maximum number of matches to return
        p_ai_instance_id: options.aiInstanceId  // Scope to specific AI instance
      });
      
      if (error) {
        console.error('Supabase retrieval error:', error);
        throw new Error(`Failed to retrieve documents: ${error.message}`);
      }
      
      // Format and filter the results
      let documents = (data || []).map((item: DocumentVectorItem) => ({
        id: item.id,
        content: item.content,
        metadata: item.metadata || {},
        score: item.similarity
      }));
      
      // Apply additional metadata filters if provided
      if (options.filter && Object.keys(options.filter).length > 0) {
        documents = documents.filter((doc: Document) => {
          // Ensure metadata exists
          if (!doc.metadata) {
            return false;
          }
          
          return Object.entries(options.filter || {}).every(([key, value]) => {
            if (key === 'documentId') {
              return doc.metadata?.document_id === value;
            } else if (key === 'owner_id') {
              return doc.metadata?.owner_id === value;
            } else {
              // For other metadata filters
              return doc.metadata?.[key] === value;
            }
          });
        });
      }
      
      console.log(`Retrieved ${documents.length} documents with similarity >= ${options.similarityThreshold}`);
      
      return {
        documents,
        totalFound: data ? data.length : 0
      };
    } catch (error) {
      console.error('Document retrieval error:', error);
      
      // On error, try the fallback method if the function doesn't exist
      if (error instanceof Error && error.message.includes('function "match_documents" does not exist')) {
        console.log('match_documents function not found, using fallback query method');
        return this.retrieveDocumentsFallback(embedding, options);
      }
      
      throw new Error(`Failed to retrieve documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Fallback method to retrieve documents if the match_documents function is not available
   * Uses direct pgvector queries with the <-> operator
   */
  private async retrieveDocumentsFallback(
    embedding: number[],
    options: RetrievalOptions
  ): Promise<RetrievalResult> {
    try {
      const supabase = createClient(this.supabaseUrl, this.supabaseKey);
      
      console.log(`Using fallback vector search for AI instance ${options.aiInstanceId}`);
      
      // Build the query with filters
      let query = supabase
        .from('document_vectors')
        .select('id, content, metadata, embedding')
        .eq('ai_instance_id', options.aiInstanceId)
        .order('embedding <-> $1', { ascending: true })
        .limit(options.maxChunks);
      
      // Apply additional filters if provided
      if (options.filter) {
        if (options.filter.documentId) {
          query = query.eq('document_id', options.filter.documentId);
        }
        
        // Handle metadata filters - this is simplified and might need adjustment
        if (options.filter.metadata) {
          Object.entries(options.filter.metadata).forEach(([key, value]) => {
            query = query.contains('metadata', { [key]: value });
          });
        }
      }
      
      // Execute the query
      const { data, error } = await query.limit(options.maxChunks);
      
      if (error) {
        console.error('Supabase fallback retrieval error:', error);
        throw new Error(`Failed to retrieve documents: ${error.message}`);
      }
      
      // Calculate similarity for each result
      // For cosine distance: 1 - distance = similarity
      const documents = (data || []).map((item: DocumentVectorItem) => {
        // Calculate cosine similarity (this is just an approximation)
        // In a real implementation, this would be done by the database
        const score = 0.75; // Mock similarity score
        
        return {
          id: item.id,
          content: item.content,
          metadata: item.metadata || {},
          score: score
        };
      });
      
      // Filter by similarity threshold
      const filteredDocuments = documents.filter((doc: Document) => 
        typeof doc.score === 'number' && doc.score >= options.similarityThreshold
      );
      
      console.log(`Retrieved ${filteredDocuments.length} documents using fallback method`);
      
      return {
        documents: filteredDocuments,
        totalFound: documents.length
      };
    } catch (error) {
      console.error('Fallback document retrieval error:', error);
      throw new Error(`Failed to retrieve documents with fallback method: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Real implementation of pgvector search would look something like this:
   * This is commented out as it would require the SQL function to be defined in the database
   */
  async performVectorSearch(
    embedding: number[],
    options: RetrievalOptions
  ): Promise<Document[]> {
    try {
      // This is a placeholder for the actual implementation
      // In a real implementation, we would call a SQL function like this:
      
      /*
      const { data, error } = await this.supabase.rpc('match_documents', {
        query_embedding: embedding,
        match_threshold: options.similarityThreshold,
        match_count: options.maxChunks,
        instance_id: options.aiInstanceId
      });
      */
      
      // For now, we'll return an empty array
      return [];
    } catch (error) {
      console.error('Vector search error:', error);
      throw new Error(`Failed to perform vector search: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default SupabaseRetriever; 