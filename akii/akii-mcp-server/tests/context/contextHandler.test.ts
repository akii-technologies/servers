import { handleContextRequest } from '../../src/context/contextHandler';
import { formatPrompt, formatMessagesPrompt } from '../../src/context/formatters/promptFormatter';
import { McpResponse } from '../../src/mcp';
import { describe, test, expect, beforeEach, vi } from 'vitest';

// Mock the modules instead of trying to spy on actual implementations
vi.mock('../../src/context/providers/lightrag', () => ({
  LightRAGContextProvider: vi.fn().mockImplementation(() => ({
    getName: () => 'lightrag',
    getContext: vi.fn().mockResolvedValue({
      context: 'This is the context from LightRAG',
      sources: [{ id: 'doc1', content: 'Content 1' }],
      tokenCount: 50
    })
  }))
}));

vi.mock('../../src/context/providers/brave', () => ({
  BraveSearchProvider: vi.fn().mockImplementation(() => ({
    getName: () => 'brave',
    getContext: vi.fn().mockResolvedValue({
      context: 'Additional context from Brave',
      sources: [{ id: 'doc2', content: 'Content 2' }],
      tokenCount: 30
    })
  }))
}));

vi.mock('../../src/context/providers/knowledgeGraph', () => ({
  KnowledgeGraphProvider: vi.fn().mockImplementation(() => ({
    getName: () => 'graph',
    getContext: vi.fn().mockRejectedValue(new Error('Failed to get context'))
  }))
}));

// Mock other providers with empty implementations
vi.mock('../../src/context/providers/mobile', () => ({
  MobileContextProvider: vi.fn().mockImplementation(() => ({
    getName: () => 'mobile',
    getContext: vi.fn().mockResolvedValue({ context: '', sources: [], tokenCount: 0 })
  }))
}));

// Mock APIs providers
vi.mock('../../src/context/providers/apis', () => ({
  ShopifyApiProvider: vi.fn().mockImplementation(() => ({
    getName: () => 'shopify',
    getContext: vi.fn().mockResolvedValue({ context: '', sources: [], tokenCount: 0 })
  })),
  N8nApiProvider: vi.fn().mockImplementation(() => ({
    getName: () => 'n8n',
    getContext: vi.fn().mockResolvedValue({ context: '', sources: [], tokenCount: 0 })
  })),
  ZapierApiProvider: vi.fn().mockImplementation(() => ({
    getName: () => 'zapier',
    getContext: vi.fn().mockResolvedValue({ context: '', sources: [], tokenCount: 0 })
  })),
  SlackApiProvider: vi.fn().mockImplementation(() => ({
    getName: () => 'slack',
    getContext: vi.fn().mockResolvedValue({ context: '', sources: [], tokenCount: 0 })
  })),
  WordPressApiProvider: vi.fn().mockImplementation(() => ({
    getName: () => 'wordpress',
    getContext: vi.fn().mockResolvedValue({ context: '', sources: [], tokenCount: 0 })
  }))
}));

// Mock messaging providers
vi.mock('../../src/context/providers/messaging', () => ({
  TelegramProvider: vi.fn().mockImplementation(() => ({
    getName: () => 'telegram',
    getContext: vi.fn().mockResolvedValue({ context: '', sources: [], tokenCount: 0 })
  })),
  WhatsAppProvider: vi.fn().mockImplementation(() => ({
    getName: () => 'whatsapp',
    getContext: vi.fn().mockResolvedValue({ context: '', sources: [], tokenCount: 0 })
  })),
  FacebookMessengerProvider: vi.fn().mockImplementation(() => ({
    getName: () => 'facebook',
    getContext: vi.fn().mockResolvedValue({ context: '', sources: [], tokenCount: 0 })
  })),
  InstagramProvider: vi.fn().mockImplementation(() => ({
    getName: () => 'instagram',
    getContext: vi.fn().mockResolvedValue({ context: '', sources: [], tokenCount: 0 })
  })),
  WebChatProvider: vi.fn().mockImplementation(() => ({
    getName: () => 'webchat',
    getContext: vi.fn().mockResolvedValue({ context: '', sources: [], tokenCount: 0 })
  }))
}));

// Mock formatters
vi.mock('../../src/context/formatters/promptFormatter', () => ({
  formatPrompt: vi.fn().mockImplementation((query, context, options) => ({
    formatted: `FORMATTED_PROMPT: ${query} | ${context} | ${options?.format || 'generic'}`,
    tokenCount: 100
  })),
  formatMessagesPrompt: vi.fn().mockImplementation((query, context, systemPrompt) => 
    JSON.stringify([
      { role: 'system', content: systemPrompt || 'default' },
      { role: 'user', content: `FORMATTED_MESSAGE: ${query} | ${context}` }
    ])
  ),
  PromptFormat: {
    CLAUDE: 'claude',
    OPENAI: 'openai',
    MISTRAL: 'mistral',
    FIREWORKS: 'fireworks',
    GENERIC: 'generic',
    RAW: 'raw'
  }
}));

describe('contextHandler', () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
  });

  describe('handleContextRequest', () => {
    test('returns formatted context with default formatter', async () => {
      const payload = {
        query: 'What is Paris?',
        aiInstanceId: 'test-instance',
        providers: ['lightrag'],
        options: {}
      };

      const result = await handleContextRequest(payload);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('context');
      expect(result.data).toHaveProperty('formattedPrompt');
      expect(result.sources).toHaveLength(1);
      expect(result.usage?.contextTokens).toBe(50);
      expect(result.usage?.totalTokens).toBe(150); // 50 context + 100 formatted

      // Verify formatPrompt was called with the expected arguments
      expect(formatPrompt).toHaveBeenCalledWith(
        'What is Paris?',
        'This is the context from LightRAG',
        expect.objectContaining({
          format: 'generic'
        })
      );
    });

    test('returns formatted context with specified formatter', async () => {
      const payload = {
        query: 'What is Paris?',
        aiInstanceId: 'test-instance',
        providers: ['lightrag'],
        options: {},
        formatOptions: {
          format: 'claude',
          systemPrompt: 'You are a travel assistant'
        }
      };

      const result = await handleContextRequest(payload);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('formattedPrompt');
      
      // Verify formatPrompt was called with the expected arguments
      expect(formatPrompt).toHaveBeenCalledWith(
        'What is Paris?',
        'This is the context from LightRAG',
        expect.objectContaining({
          format: 'claude',
          systemPrompt: 'You are a travel assistant'
        })
      );
    });

    test('returns messages format when useMessagesFormat is true', async () => {
      const payload = {
        query: 'What is Paris?',
        aiInstanceId: 'test-instance',
        providers: ['lightrag'],
        options: {},
        formatOptions: {
          useMessagesFormat: true,
          systemPrompt: 'You are a travel assistant'
        }
      };

      const result = await handleContextRequest(payload);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('formattedPrompt');
      
      // Verify formatMessagesPrompt was called with the expected arguments
      expect(formatMessagesPrompt).toHaveBeenCalledWith(
        'What is Paris?',
        'This is the context from LightRAG',
        'You are a travel assistant'
      );
    });

    test('handles multiple providers and combines their contexts', async () => {
      const payload = {
        query: 'What is Paris?',
        aiInstanceId: 'test-instance',
        providers: ['lightrag', 'brave'],
        options: {}
      };

      const result = await handleContextRequest(payload);

      expect(result.success).toBe(true);
      expect(result.data.context).toContain('This is the context from LightRAG');
      expect(result.data.context).toContain('Additional context from Brave');
      expect(result.sources).toHaveLength(2);
      expect(result.usage?.contextTokens).toBe(80); // 50 + 30

      // Verify formatPrompt was called with the combined context
      expect(formatPrompt).toHaveBeenCalledWith(
        'What is Paris?',
        expect.stringContaining('This is the context from LightRAG'),
        expect.any(Object)
      );
    });

    test('handles provider errors gracefully', async () => {
      const payload = {
        query: 'What is Paris?',
        aiInstanceId: 'test-instance',
        providers: ['lightrag', 'graph'],
        options: {}
      };

      const result = await handleContextRequest(payload);

      expect(result.success).toBe(true);
      expect(result.data.context).toContain('This is the context from LightRAG');
      // The error from the 'graph' provider should not cause the whole request to fail
      expect(result.sources).toHaveLength(1);
    });

    test('validates required query parameter', async () => {
      const payload = {
        aiInstanceId: 'test-instance',
        providers: ['lightrag']
      };

      // @ts-ignore - Testing invalid payload
      const result = await handleContextRequest(payload);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Query is required');
    });

    test('validates at least one valid provider', async () => {
      const payload = {
        query: 'What is Paris?',
        aiInstanceId: 'test-instance',
        providers: ['invalid-provider'],
        options: {}
      };

      const result = await handleContextRequest(payload);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No valid context providers specified');
    });
  });
}); 