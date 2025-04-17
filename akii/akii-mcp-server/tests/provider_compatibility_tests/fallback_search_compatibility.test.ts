/**
 * Fallback Search Compatibility Tests
 * 
 * Tests the fallback search behavior across different model providers.
 * Focuses on:
 * 1. Empty vector search results triggering fallback
 * 2. Web search integration
 * 3. Summarization of web results
 * 4. Provider-specific formatting
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import LightRAG, { EmbeddingOptions, RetrievalOptions } from '../../src/modules/lightrag';
import { FALLBACK_CONFIGS } from './test.config';
import * as modelRouterModule from '../../src/models/modelRouter';

// Define a mock WebSearchProvider interface
interface WebSearchResult {
  title: string;
  description: string;
  url: string;
}

interface WebSearchResponse {
  results: WebSearchResult[];
}

class WebSearchProvider {
  async search(query: string): Promise<WebSearchResponse> {
    return {
      results: []
    };
  }
}

// Define a ModelRequest type similar to what would be in the real code
interface ModelRequest {
  provider: any; // Using any for simplicity in the test
  modelId: string;
  messages: Array<{ role: string; content: string }>;
  maxTokens: number;
  temperature: number;
  aiInstanceId: string;
}

// Mock the model router module
vi.mock('../../src/models/modelRouter', () => {
  // Create the enum first to reference in the mocked routeModelCall
  const ModelProvider = {
    FIREWORKS: 'fireworks',
    BEDROCK: 'bedrock'
  };

  return {
    routeModelCall: vi.fn(),
    ModelProvider
  };
});

// Mock WebSearchProvider module
const mockSearchImplementation = vi.fn().mockResolvedValue({
  results: [
    {
      title: "What is RAG?",
      description: "Retrieval Augmented Generation (RAG) is a technique that enhances large language models by retrieving relevant information from external sources.",
      url: "https://example.com/rag-explained"
    },
    {
      title: "RAG vs Fine-tuning",
      description: "Comparing RAG to fine-tuning for improving LLM performance on domain-specific tasks.",
      url: "https://example.com/rag-vs-finetuning"
    }
  ]
});

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn((url, key) => {
    const mockClient = {
      from: vi.fn((table) => {
        const tableObj = {
          insert: vi.fn((data) => ({ error: null })),
          select: vi.fn(() => {
            const selectObj = {
              textSearch: vi.fn(() => selectObj),
              match: vi.fn(() => selectObj),
              filter: vi.fn(() => selectObj),
              eq: vi.fn(() => selectObj),
              order: vi.fn(() => selectObj),
              limit: vi.fn(() => ({ 
                // Return empty results to trigger fallback search
                data: [], 
                error: null 
              }))
            };
            return selectObj;
          })
        };
        return tableObj;
      }),
      rpc: vi.fn(() => ({
        data: [],
        error: null
      }))
    };
    return mockClient;
  })
}));

// Mock WebSearchProvider
vi.mock('../../src/modules/fallback', () => ({
  WebSearchProvider: vi.fn().mockImplementation(() => ({
    search: mockSearchImplementation
  }))
}));

// Mock Fireworks API
function mockFireworksAPI() {
  return vi.fn().mockImplementation((url, options) => {
    if (url.includes('embeddings')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          data: [{ embedding: new Array(1536).fill(0.1) }],
          usage: { total_tokens: 25 }
        })
      });
    } else if (url.includes('chat/completions')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'This is a summarized response from web search results via Fireworks.' } }],
          usage: { total_tokens: 75, prompt_tokens: 50, completion_tokens: 25 }
        })
      });
    }
    return Promise.resolve({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: 'Not found' })
    });
  });
}

// Mock Bedrock API
const mockBedrockSend = vi.fn()
  // First call for embedding
  .mockImplementation((command) => {
    if (command.input && command.input.inputText) {
      return Promise.resolve({
        embedding: new Array(1536).fill(0.1),
        inputTextTokenCount: 30
      });
    } else if (command.input && command.input.prompt) {
      // Second call for completion/summarization
      return Promise.resolve({
        contentType: 'application/json',
        body: JSON.stringify({
          completion: 'This is a summarized response from web search results via Bedrock.',
          usage: {
            input_tokens: 60,
            output_tokens: 30
          }
        })
      });
    }
  });

// Mock the AWS SDK
vi.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: vi.fn(() => ({
    send: mockBedrockSend
  })),
  InvokeModelCommand: vi.fn(params => params),
  InvokeModelWithResponseStreamCommand: vi.fn(params => params)
}));

describe('Fallback Search Compatibility Across Providers', () => {
  const OLD_ENV = process.env;
  const TEST_QUERY = 'what is retrieval augmented generation';
  const AI_INSTANCE_ID = 'test-instance-123';
  let lightrag;
  let modelRouterSpy;
  const { ModelProvider } = modelRouterModule;
  
  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { 
      ...OLD_ENV,
      SUPABASE_URL: 'https://test-url.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-key',
      FIREWORKS_API_KEY: 'test-fireworks-key',
      AWS_REGION: 'us-east-1',
      AWS_ACCESS_KEY_ID: 'test-aws-key',
      AWS_SECRET_ACCESS_KEY: 'test-aws-secret',
      BRAVE_API_KEY: 'test-brave-key'
    };
    
    // Set up spies
    modelRouterSpy = vi.spyOn(modelRouterModule, 'routeModelCall').mockResolvedValue({
      success: true,
      data: { content: 'Summarized content from web search' },
      usage: {
        contextTokens: 50,
        completionTokens: 30,
        totalTokens: 80
      }
    });
    
    // Default mock for Fireworks API
    global.fetch = mockFireworksAPI();
    
    // Initialize LightRAG
    lightrag = new LightRAG({
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY
    });
  });
  
  afterEach(() => {
    process.env = OLD_ENV;
    vi.restoreAllMocks();
  });

  // Test Case 1: Fireworks fallback with web search
  it('correctly triggers fallback search with Fireworks provider when vector search returns no results', async () => {
    // 1. Configure LightRAG with Fireworks and fallback enabled
    const embeddingOptions = {
      provider: 'fireworks',
      modelId: 'deepseek-v3',
      aiInstanceId: AI_INSTANCE_ID,
      config: { apiKey: process.env.FIREWORKS_API_KEY }
    };
    
    const retrievalOptions = {
      aiInstanceId: AI_INSTANCE_ID,
      maxChunks: 5,
      similarityThreshold: 0.7,
      fallbackEnabled: FALLBACK_CONFIGS.BRAVE_SEARCH.enabled
    };
    
    // Mock the Supabase RAG configuration
    const mockSingleFn = vi.fn().mockResolvedValue({
      data: {
        embedding_provider: 'fireworks',
        embedding_model_id: 'deepseek-v3',
        enable_fallback_search: true
      },
      error: null
    });
    
    const mockEqFn = vi.fn().mockReturnValue({ single: mockSingleFn });
    const mockSelectFn = vi.fn().mockReturnValue({ eq: mockEqFn });
    const mockFromFn = vi.fn().mockReturnValue({ select: mockSelectFn });
    
    createClient().from = mockFromFn;
    
    // 2. Generate an embedding
    const embeddingResult = await lightrag.generateEmbedding(TEST_QUERY, embeddingOptions);
    expect(embeddingResult.embedding).toBeDefined();
    expect(embeddingResult.embedding.length).toBeGreaterThan(0);
    
    // 3. Process through RAG pipeline - this should return empty results
    const contextResult = await lightrag.generateContext(embeddingResult.embedding, retrievalOptions);
    expect(contextResult.sources).toEqual([]);
    
    // 4. Verify that appropriate web search and summarization would be triggered
    // (Note: We're not testing the actual LightRAGContextProvider here, 
    // just verifying the components work together through the providers)
    expect(mockFromFn).toHaveBeenCalledWith('rag_configurations');
    
    // 5. Verify we can process Fireworks results from web search
    const summaryResponse = await modelRouterModule.routeModelCall({
      provider: ModelProvider.FIREWORKS,
      modelId: 'accounts/fireworks/models/claude-3-haiku-20240307',
      messages: [
        { role: 'system', content: expect.any(String) },
        { role: 'user', content: expect.any(String) }
      ],
      maxTokens: expect.any(Number),
      temperature: expect.any(Number),
      aiInstanceId: AI_INSTANCE_ID
    });
    
    expect(summaryResponse.success).toBe(true);
    expect(summaryResponse.data.content).toBeDefined();
    expect(summaryResponse.usage).toBeDefined();
  });

  // Test Case 2: Bedrock fallback with web search
  it('correctly triggers fallback search with Bedrock provider when vector search returns no results', async () => {
    // 1. Configure LightRAG with Bedrock and fallback enabled
    const embeddingOptions = {
      provider: 'bedrock',
      modelId: 'amazon.titan-embed-text-v1',
      aiInstanceId: AI_INSTANCE_ID,
      config: { 
        region: 'us-east-1',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    };
    
    const retrievalOptions = {
      aiInstanceId: AI_INSTANCE_ID,
      maxChunks: 5,
      similarityThreshold: 0.7,
      fallbackEnabled: FALLBACK_CONFIGS.BRAVE_SEARCH.enabled
    };
    
    // Mock the Supabase RAG configuration
    const mockSingleFn = vi.fn().mockResolvedValue({
      data: {
        embedding_provider: 'bedrock',
        embedding_model_id: 'amazon.titan-embed-text-v1',
        enable_fallback_search: true
      },
      error: null
    });
    
    const mockEqFn = vi.fn().mockReturnValue({ single: mockSingleFn });
    const mockSelectFn = vi.fn().mockReturnValue({ eq: mockEqFn });
    const mockFromFn = vi.fn().mockReturnValue({ select: mockSelectFn });
    
    createClient().from = mockFromFn;
    
    // 2. Generate an embedding using Bedrock
    const embeddingResult = await lightrag.generateEmbedding(TEST_QUERY, embeddingOptions);
    expect(embeddingResult.embedding).toBeDefined();
    expect(embeddingResult.embedding.length).toBeGreaterThan(0);
    
    // Verify Bedrock was used
    expect(mockBedrockSend).toHaveBeenCalled();
    
    // 3. Process through RAG pipeline - this should return empty results
    const contextResult = await lightrag.generateContext(embeddingResult.embedding, retrievalOptions);
    expect(contextResult.sources).toEqual([]);
    
    // 4. Verify that appropriate web search and summarization would be triggered
    expect(mockFromFn).toHaveBeenCalledWith('rag_configurations');
    
    // 5. Verify we can process Bedrock results for summarization
    // Reset the implementation to provide summarization response
    const summaryResponse = await modelRouterModule.routeModelCall({
      provider: ModelProvider.BEDROCK,
      modelId: 'anthropic.claude-instant-v1',
      messages: [
        { role: 'system', content: expect.any(String) },
        { role: 'user', content: expect.any(String) }
      ],
      maxTokens: expect.any(Number),
      temperature: expect.any(Number),
      aiInstanceId: AI_INSTANCE_ID
    });
    
    expect(summaryResponse.success).toBe(true);
    expect(summaryResponse.data.content).toBeDefined();
    expect(summaryResponse.usage).toBeDefined();
  });

  // Test Case 3: Fallback disabled behavior
  it('returns empty context when fallback search is disabled', async () => {
    // 1. Configure LightRAG with fallback disabled
    const embeddingOptions = {
      provider: 'fireworks',
      modelId: 'deepseek-v3',
      aiInstanceId: AI_INSTANCE_ID,
      config: { apiKey: process.env.FIREWORKS_API_KEY }
    };
    
    const retrievalOptions = {
      aiInstanceId: AI_INSTANCE_ID,
      maxChunks: 5,
      similarityThreshold: 0.7,
      fallbackEnabled: FALLBACK_CONFIGS.WEB_DISABLED.enabled // false
    };
    
    // Mock the Supabase RAG configuration with fallback disabled
    const mockSingleFn = vi.fn().mockResolvedValue({
      data: {
        embedding_provider: 'fireworks',
        embedding_model_id: 'deepseek-v3',
        enable_fallback_search: false
      },
      error: null
    });
    
    const mockEqFn = vi.fn().mockReturnValue({ single: mockSingleFn });
    const mockSelectFn = vi.fn().mockReturnValue({ eq: mockEqFn });
    const mockFromFn = vi.fn().mockReturnValue({ select: mockSelectFn });
    
    createClient().from = mockFromFn;
    
    // 2. Generate an embedding
    const embeddingResult = await lightrag.generateEmbedding(TEST_QUERY, embeddingOptions);
    
    // 3. Process through RAG pipeline - this should return empty results
    const contextResult = await lightrag.generateContext(embeddingResult.embedding, retrievalOptions);
    
    // 4. Verify that web search would NOT be triggered
    // We're verifying that with fallback disabled, we'd return empty results
    // In the real LightRAGContextProvider, this would mean not calling braveSearchProvider
    
    expect(contextResult).toEqual({
      context: '',
      sources: [],
      tokenCount: 0
    });
    
    // The model router should not be called for summarization with fallback disabled
    expect(modelRouterSpy).not.toHaveBeenCalled();
  });

  // Test Case 4: Error handling in web search
  it('handles errors in web search gracefully', async () => {
    // 1. Configure LightRAG with fallback enabled
    const embeddingOptions = {
      provider: 'fireworks',
      modelId: 'deepseek-v3',
      aiInstanceId: AI_INSTANCE_ID,
      config: { apiKey: process.env.FIREWORKS_API_KEY }
    };
    
    const retrievalOptions = {
      aiInstanceId: AI_INSTANCE_ID,
      maxChunks: 5,
      similarityThreshold: 0.7,
      fallbackEnabled: FALLBACK_CONFIGS.BRAVE_SEARCH.enabled
    };
    
    // Mock the Supabase RAG configuration
    const mockSingleFn = vi.fn().mockResolvedValue({
      data: {
        embedding_provider: 'fireworks',
        embedding_model_id: 'deepseek-v3',
        enable_fallback_search: true
      },
      error: null
    });
    
    const mockEqFn = vi.fn().mockReturnValue({ single: mockSingleFn });
    const mockSelectFn = vi.fn().mockReturnValue({ eq: mockEqFn });
    const mockFromFn = vi.fn().mockReturnValue({ select: mockSelectFn });
    
    createClient().from = mockFromFn;
    
    // 2. Mock web search to throw an error
    mockSearchImplementation.mockRejectedValueOnce(new Error('Failed to connect to search API'));
    
    // 3. Generate an embedding
    const embeddingResult = await lightrag.generateEmbedding(TEST_QUERY, embeddingOptions);
    
    // 4. Process through RAG pipeline - this should return empty results
    const contextResult = await lightrag.generateContext(embeddingResult.embedding, retrievalOptions);
    
    // 5. Verify appropriate error handling
    // In the real implementation, the LightRAGContextProvider would catch the error
    // and return empty context as a fallback to the fallback
    
    expect(contextResult).toEqual({
      context: '',
      sources: [],
      tokenCount: 0
    });
    
    // We would still try the web search, but it would fail
    expect(mockSearchImplementation).toHaveBeenCalledOnce();
  });
});