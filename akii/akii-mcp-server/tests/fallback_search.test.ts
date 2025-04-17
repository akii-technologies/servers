/**
 * LightRAG Fallback Search Test
 * Tests the fallback search functionality when vector results are empty
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { LightRAGContextProvider } from '../src/context/providers/lightrag';
import LightRAG from '../src/modules/lightrag';
import { BraveSearchProvider } from '../src/context/providers/brave';

// Mock LightRAG module
vi.mock('../src/modules/lightrag', () => {
  const mockGenerateEmbedding = vi.fn().mockResolvedValue({
    embedding: [0.1, 0.2, 0.3],
    tokenCount: 10
  });
  
  const mockGenerateContext = vi.fn().mockResolvedValue({
    context: '',
    sources: [],
    tokenCount: 0
  });
  
  const LightRAGMock = vi.fn().mockImplementation(() => ({
    generateEmbedding: mockGenerateEmbedding,
    generateContext: mockGenerateContext
  }));
  
  // Add the mock functions directly to the mock object for test access
  return {
    default: Object.assign(LightRAGMock, {
      mockGenerateEmbedding,
      mockGenerateContext
    }),
    __esModule: true
  };
});

// Mock BraveSearchProvider
vi.mock('../src/context/providers/brave', () => {
  const mockGetContext = vi.fn().mockResolvedValue({
    context: 'This is a summarized web search result for the query.',
    sources: [
      {
        title: 'Web Search Result',
        url: 'https://example.com/result',
        snippet: 'Example web search result snippet'
      }
    ],
    tokenCount: 20
  });
  
  return {
    BraveSearchProvider: vi.fn().mockImplementation(() => ({
      getName: () => 'brave',
      getContext: mockGetContext
    })),
    __esModule: true
  };
});

describe('LightRAG Context Provider with Fallback Search', () => {
  const OLD_ENV = process.env;
  
  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { 
      ...OLD_ENV,
      BRAVE_SEARCH_API_KEY: 'test-brave-key',
      SUPABASE_URL: 'https://test-url.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-key'
    };
  });
  
  afterEach(() => {
    process.env = OLD_ENV;
  });
  
  it('falls back to web search when vector results are empty', async () => {
    // Arrange
    const mockLightRAG = require('../src/modules/lightrag').default;
    const mockBraveProvider = require('../src/context/providers/brave').BraveSearchProvider;
    
    // Configure mock to return empty context
    mockLightRAG.mockGenerateContext.mockResolvedValueOnce({
      context: '',
      sources: [],
      tokenCount: 0
    });
    
    const provider = new LightRAGContextProvider();
    
    // Act
    const result = await provider.getContext('Test query', {
      aiInstanceId: 'test-instance',
      enableFallbackSearch: true,
      maxChunks: 5,
      similarityThreshold: 0.7
    });
    
    // Assert
    expect(mockLightRAG).toHaveBeenCalledTimes(1);
    expect(mockLightRAG.mockGenerateEmbedding).toHaveBeenCalledWith(
      'Test query',
      expect.objectContaining({
        provider: expect.any(String),
        modelId: expect.any(String)
      })
    );
    expect(mockLightRAG.mockGenerateContext).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        maxChunks: 5,
        similarityThreshold: 0.7
      }),
      'Test query'
    );
    
    // Verify BraveSearchProvider was used for fallback
    expect(mockBraveProvider).toHaveBeenCalledTimes(1);
    expect(result.context).toContain('This is a summarized web search result');
  });
  
  it('respects the fallback search config option', async () => {
    // Arrange
    const mockLightRAG = require('../src/modules/lightrag').default;
    const mockBraveProvider = require('../src/context/providers/brave').BraveSearchProvider;
    
    // Configure mock to return empty context
    mockLightRAG.mockGenerateContext.mockResolvedValueOnce({
      context: '',
      sources: [],
      tokenCount: 0
    });
    
    const provider = new LightRAGContextProvider();
    
    // Act
    const result = await provider.getContext('Test query', {
      aiInstanceId: 'test-instance',
      enableFallbackSearch: false, // Disable fallback
      maxChunks: 5,
      similarityThreshold: 0.7
    });
    
    // Assert
    expect(mockLightRAG).toHaveBeenCalledTimes(1);
    expect(mockBraveProvider).not.toHaveBeenCalled();
    expect(result.context).toBe('');
    expect(result.sources).toEqual([]);
    expect(mockLightRAG.mockGenerateContext).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        maxChunks: 5,
        similarityThreshold: 0.7
      }),
      'Test query'
    );
  });
});