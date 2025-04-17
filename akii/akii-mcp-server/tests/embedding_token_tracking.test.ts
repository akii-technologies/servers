/**
 * Embedding Token Tracking Test
 * Tests the token tracking functionality for embeddings
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { FireworksEmbedder } from '../src/modules/lightrag/embedder';

// Mock @supabase/supabase-js
vi.mock('@supabase/supabase-js', () => {
  const mockInsert = vi.fn().mockReturnValue({ error: null });
  const mockFrom = vi.fn().mockReturnValue({
    insert: mockInsert
  });
  
  return {
    createClient: vi.fn().mockImplementation(() => ({
      from: mockFrom
    }))
  };
});

// Mock the fetch API
const mockFetchResponse = {
  ok: true,
  json: () => Promise.resolve({
    data: [{ embedding: Array(768).fill(0.1) }],
    usage: { total_tokens: 25 }
  })
};

global.fetch = vi.fn().mockResolvedValue(mockFetchResponse);

describe('Embedding Token Tracking', () => {
  const aiInstanceId = 'test-instance-123';
  
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Setup environment variables
    process.env.FIREWORKS_API_KEY = 'test-api-key';
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  });
  
  afterEach(() => {
    // Restore environment
    vi.resetModules();
  });
  
  it('tracks token usage when generating embeddings', async () => {
    // Create embedder
    const embedder = new FireworksEmbedder('deepseek-v3');
    
    // Generate embedding
    const result = await embedder.generateEmbedding('Test text for embedding', aiInstanceId);
    
    // Verify embedding result
    expect(result.embedding).toBeDefined();
    expect(result.tokenCount).toBe(25);
    
    // Verify Supabase client was created with correct credentials
    expect(createClient).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'test-service-key'
    );
    
    // Get the mock Supabase client and its methods
    const mockSupabase = vi.mocked(createClient).mock.results[0].value;
    const mockFrom = mockSupabase.from;
    const mockInsert = mockFrom().insert;
    
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
  
  it('respects trackUsage option', async () => {
    // Create embedder with trackUsage disabled
    const embedder = new FireworksEmbedder('deepseek-v3', undefined, { trackUsage: false });
    
    // Generate embedding
    const result = await embedder.generateEmbedding('Test text for embedding', aiInstanceId);
    
    // Verify embedding result
    expect(result.embedding).toBeDefined();
    expect(result.tokenCount).toBe(25);
    
    // Verify Supabase client was NOT created (token usage not tracked)
    expect(createClient).not.toHaveBeenCalled();
  });
});