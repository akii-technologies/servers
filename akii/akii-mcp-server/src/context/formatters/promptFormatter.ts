/**
 * Prompt Formatter
 *
 * Formats RAG context and user prompts for different model providers.
 */

export interface FormattedPrompt {
  formatted: string;
  tokenCount: number;
}

export enum PromptFormat {
  CLAUDE = 'claude',
  OPENAI = 'openai',
  MISTRAL = 'mistral', 
  FIREWORKS = 'fireworks',
  GENERIC = 'generic',
  RAW = 'raw'
}

export interface PromptOptions {
  systemPrompt?: string;
  contextHeader?: string;
  includeTimestamp?: boolean;
  format?: PromptFormat;
}

/**
 * Formats a user query with context for a specific LLM format
 * 
 * @param query - The user query
 * @param context - The RAG context 
 * @param options - Formatting options
 * @returns Formatted prompt and token count estimate
 */
export function formatPrompt(
  query: string,
  context: string,
  options: PromptOptions = {}
): FormattedPrompt {
  const {
    systemPrompt = 'You are a helpful AI assistant. Use the provided context to answer the user\'s question.',
    contextHeader = 'Context:',
    includeTimestamp = true,
    format = PromptFormat.GENERIC
  } = options;
  
  const timestamp = includeTimestamp ? `Current date and time: ${new Date().toISOString()}\n\n` : '';
  
  let formatted = '';
  
  switch (format) {
    case PromptFormat.CLAUDE:
      formatted = `${systemPrompt}\n\n${timestamp}${contextHeader}\n${context}\n\nHuman: ${query}\n\nAssistant:`;
      break;
      
    case PromptFormat.OPENAI:
      formatted = `${systemPrompt}\n\n${timestamp}${contextHeader}\n${context}\n\nUser: ${query}\n\nAssistant:`;
      break;
      
    case PromptFormat.MISTRAL:
      formatted = `${systemPrompt}\n\n${timestamp}${contextHeader}\n${context}\n\n<s>[INST] ${query} [/INST]`;
      break;
      
    case PromptFormat.FIREWORKS:
      formatted = `${systemPrompt}\n\n${timestamp}${contextHeader}\n${context}\n\nUSER: ${query}\n\nASSISTANT:`;
      break;
      
    case PromptFormat.GENERIC:
    default:
      formatted = `${systemPrompt}\n\n${timestamp}${contextHeader}\n${context}\n\nQuestion: ${query}\n\nAnswer:`;
  }
  
  // Simple token count estimation (approx 4 chars per token)
  const tokenCount = Math.ceil(formatted.length / 4);
  
  return {
    formatted,
    tokenCount
  };
}

/**
 * Formats a user query with context in messaging format (for OpenAI, Anthropic Messages API)
 * 
 * @param query - The user query
 * @param context - The RAG context
 * @param systemPrompt - The system prompt
 * @returns JSON string of message objects
 */
export function formatMessagesPrompt(
  query: string,
  context: string,
  systemPrompt = 'You are a helpful AI assistant. Use the provided context to answer the user\'s question.'
): string {
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Here is some relevant context:\n\n${context}\n\nMy question is: ${query}` }
  ];
  
  return JSON.stringify(messages);
}