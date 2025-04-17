/**
 * Context Providers Index
 * 
 * Central export for all context providers
 */

// Individual providers
import { LightRAGContextProvider } from './lightrag';
import { BraveSearchProvider } from './brave';
import { KnowledgeGraphProvider } from './knowledgeGraph';
import { MobileContextProvider } from './mobile';

// API providers
import { 
  ShopifyApiProvider,
  N8nApiProvider,
  ZapierApiProvider,
  SlackApiProvider,
  WordPressApiProvider
} from './apis';

// Messaging providers
import {
  TelegramProvider,
  WhatsAppProvider,
  FacebookMessengerProvider,
  InstagramProvider,
  WebChatProvider
} from './messaging';

// Context provider interface
export interface ContextProvider {
  getName(): string;
  getContext(query: string, options: any): Promise<{
    context: string;
    sources: any[];
    tokenCount: number;
  }>;
}

/**
 * Creates a registry of all available context providers
 * 
 * @returns Record of instantiated providers
 */
export function createProviderRegistry(): Record<string, ContextProvider> {
  return {
    // Individual providers
    'lightrag': new LightRAGContextProvider(),
    'brave': new BraveSearchProvider(),
    'graph': new KnowledgeGraphProvider(),
    'mobile': new MobileContextProvider(),
    
    // API providers
    'shopify': new ShopifyApiProvider(),
    'n8n': new N8nApiProvider(),
    'zapier': new ZapierApiProvider(),
    'slack': new SlackApiProvider(),
    'wordpress': new WordPressApiProvider(),
    
    // Messaging providers
    'telegram': new TelegramProvider(),
    'whatsapp': new WhatsAppProvider(),
    'facebook': new FacebookMessengerProvider(),
    'instagram': new InstagramProvider(),
    'webchat': new WebChatProvider()
  };
} 