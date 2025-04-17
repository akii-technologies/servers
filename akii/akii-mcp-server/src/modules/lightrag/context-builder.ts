/**
 * Context Builder for LightRAG
 * 
 * Transforms retrieved documents into a coherent context format for LLMs.
 */

import { Document, ContextResult } from './index';

export interface ContextBuilderOptions {
  maxContextLength?: number;
  formatAsJson?: boolean;
  includeMetadata?: boolean;
  separator?: string;
  deduplicate?: boolean;
}

/**
 * Builds context from retrieved documents for LLM input
 */
export class ContextBuilder {
  private defaultOptions: ContextBuilderOptions = {
    maxContextLength: 4000,
    formatAsJson: false,
    includeMetadata: true,
    separator: '\n\n',
    deduplicate: true
  };
  
  /**
   * Build context string from retrieved documents
   */
  buildContext(documents: Document[], options?: ContextBuilderOptions): ContextResult {
    const mergedOptions = { ...this.defaultOptions, ...options };
    let context = '';
    let sourceDocuments: Document[] = [];
    let totalTokenCount = 0;
    
    // Deduplicate documents if needed
    const processedDocuments = mergedOptions.deduplicate 
      ? this.deduplicateDocuments(documents)
      : documents;
    
    // Sort by score descending (assuming higher score means more relevant)
    const sortedDocuments = [...processedDocuments].sort((a, b) => {
      return (b.score || 0) - (a.score || 0);
    });
    
    if (mergedOptions.formatAsJson) {
      // Format as JSON array for structured input
      const contextArray = sortedDocuments.map(doc => {
        totalTokenCount += this.estimateTokens(doc.content);
        sourceDocuments.push(doc);
        
        return {
          content: doc.content,
          ...(mergedOptions.includeMetadata ? { metadata: doc.metadata } : {})
        };
      });
      
      context = JSON.stringify(contextArray, null, 2);
    } else {
      // Format as text with separators
      for (const doc of sortedDocuments) {
        const docTokens = this.estimateTokens(doc.content);
        
        // Add document content with separator
        if (context) {
          context += mergedOptions.separator;
        }
        
        // Add metadata if needed
        if (mergedOptions.includeMetadata) {
          const metadataStr = Object.entries(doc.metadata || {})
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ');
          
          if (metadataStr) {
            context += `[${metadataStr}]\n`;
          }
        }
        
        context += doc.content;
        totalTokenCount += docTokens;
        sourceDocuments.push(doc);
      }
    }
    
    return {
      context,
      sources: sourceDocuments,
      tokenCount: totalTokenCount
    };
  }
  
  /**
   * Remove duplicate documents based on content
   */
  private deduplicateDocuments(documents: Document[]): Document[] {
    const seenContents = new Set<string>();
    const uniqueDocs: Document[] = [];
    
    for (const doc of documents) {
      // Use a hash or the first N characters as a fingerprint
      const contentFingerprint = doc.content.substring(0, 100);
      
      if (!seenContents.has(contentFingerprint)) {
        seenContents.add(contentFingerprint);
        uniqueDocs.push(doc);
      }
    }
    
    return uniqueDocs;
  }
  
  /**
   * Estimate token count for a text string
   * This is a simple estimation - in production you'd use a proper tokenizer
   */
  private estimateTokens(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }
}

export default ContextBuilder; 