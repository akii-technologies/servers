import { 
  formatPrompt, 
  formatMessagesPrompt, 
  PromptFormat 
} from '../../../src/context/formatters/promptFormatter';
import { describe, test, expect, beforeAll, afterAll, vi } from 'vitest';

// Mock the Date.toISOString() method to return a fixed timestamp for testing
const mockTimestamp = '2023-08-30T12:00:00.000Z';
const originalDateToISOString = Date.prototype.toISOString;

beforeAll(() => {
  // @ts-ignore - Using 'as any' does not work in all testing setups
  Date.prototype.toISOString = vi.fn(() => mockTimestamp);
});

afterAll(() => {
  Date.prototype.toISOString = originalDateToISOString;
});

describe('promptFormatter', () => {
  const testQuery = 'What is the capital of France?';
  const testContext = 'Paris is the capital and most populous city of France.';
  const testSystemPrompt = 'You are a geography assistant.';

  describe('formatPrompt', () => {
    test('formats prompt for Claude', () => {
      const result = formatPrompt(testQuery, testContext, {
        systemPrompt: testSystemPrompt,
        format: PromptFormat.CLAUDE
      });

      expect(result.formatted).toContain(testSystemPrompt);
      expect(result.formatted).toContain(`Current date and time: ${mockTimestamp}`);
      expect(result.formatted).toContain(testContext);
      expect(result.formatted).toContain(`Human: ${testQuery}`);
      expect(result.formatted).toContain('Assistant:');
      expect(result.tokenCount).toBeGreaterThan(0);
    });

    test('formats prompt for OpenAI', () => {
      const result = formatPrompt(testQuery, testContext, {
        systemPrompt: testSystemPrompt,
        format: PromptFormat.OPENAI
      });

      expect(result.formatted).toContain(testSystemPrompt);
      expect(result.formatted).toContain(`Current date and time: ${mockTimestamp}`);
      expect(result.formatted).toContain(testContext);
      expect(result.formatted).toContain(`User: ${testQuery}`);
      expect(result.formatted).toContain('Assistant:');
      expect(result.tokenCount).toBeGreaterThan(0);
    });

    test('formats prompt for Mistral', () => {
      const result = formatPrompt(testQuery, testContext, {
        systemPrompt: testSystemPrompt,
        format: PromptFormat.MISTRAL
      });

      expect(result.formatted).toContain(testSystemPrompt);
      expect(result.formatted).toContain(`Current date and time: ${mockTimestamp}`);
      expect(result.formatted).toContain(testContext);
      expect(result.formatted).toContain(`<s>[INST] ${testQuery} [/INST]`);
      expect(result.tokenCount).toBeGreaterThan(0);
    });

    test('formats prompt for Fireworks', () => {
      const result = formatPrompt(testQuery, testContext, {
        systemPrompt: testSystemPrompt,
        format: PromptFormat.FIREWORKS
      });

      expect(result.formatted).toContain(testSystemPrompt);
      expect(result.formatted).toContain(`Current date and time: ${mockTimestamp}`);
      expect(result.formatted).toContain(testContext);
      expect(result.formatted).toContain(`USER: ${testQuery}`);
      expect(result.formatted).toContain('ASSISTANT:');
      expect(result.tokenCount).toBeGreaterThan(0);
    });

    test('uses default Generic format if not specified', () => {
      const result = formatPrompt(testQuery, testContext, {
        systemPrompt: testSystemPrompt
      });

      expect(result.formatted).toContain(testSystemPrompt);
      expect(result.formatted).toContain(`Current date and time: ${mockTimestamp}`);
      expect(result.formatted).toContain(testContext);
      expect(result.formatted).toContain(`Question: ${testQuery}`);
      expect(result.formatted).toContain('Answer:');
      expect(result.tokenCount).toBeGreaterThan(0);
    });

    test('allows disabling timestamp', () => {
      const result = formatPrompt(testQuery, testContext, {
        systemPrompt: testSystemPrompt,
        includeTimestamp: false,
        format: PromptFormat.CLAUDE
      });

      expect(result.formatted).toContain(testSystemPrompt);
      expect(result.formatted).not.toContain(`Current date and time: ${mockTimestamp}`);
      expect(result.formatted).toContain(testContext);
      expect(result.formatted).toContain(`Human: ${testQuery}`);
      expect(result.formatted).toContain('Assistant:');
      expect(result.tokenCount).toBeGreaterThan(0);
    });

    test('allows custom context header', () => {
      const customHeader = 'Relevant Information:';
      const result = formatPrompt(testQuery, testContext, {
        systemPrompt: testSystemPrompt,
        contextHeader: customHeader,
        format: PromptFormat.CLAUDE
      });

      expect(result.formatted).toContain(testSystemPrompt);
      expect(result.formatted).toContain(customHeader);
      expect(result.formatted).toContain(testContext);
      expect(result.formatted).toContain(`Human: ${testQuery}`);
      expect(result.formatted).toContain('Assistant:');
      expect(result.tokenCount).toBeGreaterThan(0);
    });

    test('estimates token count based on text length', () => {
      const longText = 'a'.repeat(1000);
      const shortText = 'b'.repeat(100);
      
      const longResult = formatPrompt(testQuery, longText, {
        systemPrompt: testSystemPrompt,
        format: PromptFormat.CLAUDE
      });
      
      const shortResult = formatPrompt(testQuery, shortText, {
        systemPrompt: testSystemPrompt,
        format: PromptFormat.CLAUDE
      });
      
      expect(longResult.tokenCount).toBeGreaterThan(shortResult.tokenCount);
      // Rough estimate check: 1 token ≈ 4 characters, so we expect approximately 250 tokens for 1000 chars
      expect(longResult.tokenCount).toBeGreaterThanOrEqual(Math.ceil((1000 + testQuery.length + testSystemPrompt.length) / 4));
    });
  });

  describe('formatMessagesPrompt', () => {
    test('returns JSON with system and user messages', () => {
      const result = formatMessagesPrompt(testQuery, testContext, testSystemPrompt);
      const parsed = JSON.parse(result);
      
      expect(parsed).toHaveLength(2);
      expect(parsed[0].role).toBe('system');
      expect(parsed[0].content).toBe(testSystemPrompt);
      expect(parsed[1].role).toBe('user');
      expect(parsed[1].content).toContain(testContext);
      expect(parsed[1].content).toContain(testQuery);
    });

    test('uses default system prompt if not provided', () => {
      const result = formatMessagesPrompt(testQuery, testContext);
      const parsed = JSON.parse(result);
      
      expect(parsed[0].role).toBe('system');
      expect(parsed[0].content).toContain('You are a helpful AI assistant');
    });
  });
}); 