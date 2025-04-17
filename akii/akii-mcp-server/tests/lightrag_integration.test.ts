/**
 * LightRAG Integration Test
 * Tests the integration between LightRAG and token tracking
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as supabaseModule from '@supabase/supabase-js';
import LightRAG, { EmbeddingOptions } from '../src/modules/lightrag';

// Mock Supabase client with proper types
const mockInsert = vi.fn(() => ({ error: null }));
const mockFrom = vi.fn(() => ({
  insert: mockInsert,
  select: vi.fn(() => ({
    match: vi.fn(() => ({
      order: vi.fn(() => ({
        limit: vi.fn(() => ({ data: [], error: null }))
      }))
    }))
  }))
}));

const mockClient = {
  from: mockFrom
};

// Mock the createClient function
vi.spyOn(supabaseModule, 'createClient').mockReturnValue(mockClient as any);

// Mock fetch for the Fireworks API
global.fetch = vi.fn().mockImplementation(() => 
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      data: [{ embedding: new Array(1536).fill(0.1) }],
      usage: { total_tokens: 25 }
    })
  })
);

describe('LightRAG Integration with Token Tracking', () => {
  const OLD_ENV = process.env;
  
  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { 
      ...OLD_ENV,
      SUPABASE_URL: 'https://test-url.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-key',
      FIREWORKS_API_KEY: 'test-fireworks-key'
    };
    
    // Reset mocks
    mockFrom.mockClear();
    mockInsert.mockClear();
    
    // Re-mock fetch for each test
    global.fetch = vi.fn().mockImplementation(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          data: [{ embedding: new Array(1536).fill(0.1) }],
          usage: { total_tokens: 25 }
        })
      })
    );
  });
  
  afterEach(() => {
    process.env = OLD_ENV;
  });
  
  it('tracks token usage when generating embeddings through LightRAG', async () => {
    // Arrange
    const lightrag = new LightRAG({
      supabaseUrl: 'https://test-url.supabase.co',
      supabaseKey: 'test-key'
    });
    
    const aiInstanceId = '12345678-1234-1234-1234-123456789012';
    const testQuery = 'This is a test query for embedding generation';
    
    const embeddingOptions: EmbeddingOptions = {
      provider: 'fireworks',
      modelId: 'deepseek-v3',
      trackUsage: true,
      aiInstanceId: aiInstanceId
    };
    
    // Act
    const result = await lightrag.generateEmbedding(testQuery, embeddingOptions);
    
    // Assert
    expect(result.embedding).toBeDefined();
    expect(result.tokenCount).toBe(25);
    
    // Verify Supabase client was created with correct credentials
    expect(supabaseModule.createClient).toHaveBeenCalledWith(
      'https://test-url.supabase.co',
      'test-key'
    );
    
    // Verify token usage was logged
    expect(mockFrom).toHaveBeenCalledWith('usage_logs');
    expect(mockInsert).toHaveBeenCalledWith({
      ai_instance_id: aiInstanceId,
      provider: 'fireworks',
      model: 'deepseek-v3',
      operation_type: 'embedding',
      input_tokens: 25,
      output_tokens: 0,
      total_tokens: 25,
      created_at: expect.any(String)
    });
  });
});