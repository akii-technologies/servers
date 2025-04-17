/**
 * Provider Compatibility Test Configuration
 * 
 * Shared configuration and utilities for provider compatibility tests
 */

// Standard test prompts with varying complexity and length
export const TEST_PROMPTS = {
  SHORT: "What is retrieval augmented generation?",
  MEDIUM: "Explain the differences between embeddings created by Titan models and those created by DeepSeek models. How do they compare in terms of performance for retrieval tasks?",
  LONG: "I need a detailed analysis of how different embedding models (like DeepSeek, Titan, and Ada) perform in the context of RAG systems. Consider factors like token efficiency, semantic accuracy, and retrieval precision. Also explain how these might impact different provider combinations when using Bedrock for embeddings but Fireworks for completions, or vice versa.",
};

// Provider configurations for testing
export const PROVIDER_CONFIGS = {
  FIREWORKS: {
    embedding: {
      provider: 'fireworks',
      models: [
        { id: 'deepseek-v3', name: 'DeepSeek v3' },
        { id: 'deepseek-v2', name: 'DeepSeek v2 Lite' }
      ]
    },
    completion: {
      provider: 'fireworks',
      models: [
        { id: 'accounts/fireworks/models/firefunction-v1', name: 'FireFunction v1' },
        { id: 'accounts/fireworks/models/mixtral-8x7b-instruct', name: 'Mixtral 8x7B' }
      ]
    }
  },
  BEDROCK: {
    embedding: {
      provider: 'bedrock',
      region: 'us-east-1',
      models: [
        { id: 'amazon.titan-embed-text-v1', name: 'Titan Embeddings v1' }
      ]
    },
    completion: {
      provider: 'bedrock',
      region: 'us-east-1',
      models: [
        { id: 'anthropic.claude-instant-v1', name: 'Claude Instant v1' },
        { id: 'anthropic.claude-v2', name: 'Claude v2' }
      ]
    }
  }
};

// Error scenarios to test
export const ERROR_SCENARIOS = {
  RATE_LIMIT: {
    status: 429,
    message: 'Rate limit exceeded. Please try again later.'
  },
  SERVER_ERROR: {
    status: 500,
    message: 'Internal server error occurred.'
  },
  AUTHORIZATION_ERROR: {
    status: 401,
    message: 'Invalid API key or credentials.'
  },
  TIMEOUT_ERROR: {
    status: 504,
    message: 'Request timed out.'
  }
};

// Token limit configurations for different providers
export const TOKEN_LIMITS = {
  FIREWORKS: {
    mixtral: 32768,
    firefunction: 16384
  },
  BEDROCK: {
    claude: 100000,
    claude_instant: 100000,
    claude_v2: 100000,
    titan: 8000
  }
};

// Fallback search configurations
export const FALLBACK_CONFIGS = {
  BRAVE_SEARCH: {
    enabled: true,
    maxResults: 3,
    summarize: true
  },
  WEB_DISABLED: {
    enabled: false
  }
};

// Define document interface
interface SampleDocument {
  id: string;
  content: string;
  metadata: {
    source: string;
    created: string;
  };
}

// Helper function to generate a sample document corpus
export function generateSampleDocuments(count = 5): SampleDocument[] {
  const documents: SampleDocument[] = [];
  
  for (let i = 0; i < count; i++) {
    documents.push({
      id: `doc-${i}`,
      content: `This is document ${i} about Retrieval Augmented Generation (RAG).
        RAG is a technique that enhances large language models by providing them with
        relevant information retrieved from external sources. This allows models to
        access information beyond their training data and provide more accurate responses.
        Document ${i} covers specific aspects of RAG implementation and best practices.`,
      metadata: {
        source: `sample-${i}.txt`,
        created: new Date().toISOString()
      }
    });
  }
  
  return documents;
}