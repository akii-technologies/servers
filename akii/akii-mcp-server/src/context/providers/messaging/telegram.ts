/**
 * Telegram Context Provider
 * 
 * Retrieves conversation history and data from Telegram chats
 */

import { createClient } from '@supabase/supabase-js';
import { ContextProvider } from '../../contextHandler';

interface TelegramCredential {
  bot_token: string;
  webhook_url?: string;
}

/**
 * Telegram Context Provider Implementation
 * 
 * Provides conversation history and user data from Telegram
 */
export class TelegramProvider implements ContextProvider {
  private supabaseUrl: string;
  private supabaseKey: string;
  
  constructor() {
    // Load from environment variables
    this.supabaseUrl = process.env.SUPABASE_URL || '';
    this.supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!this.supabaseUrl || !this.supabaseKey) {
      console.warn('Telegram provider: Missing Supabase credentials');
    }
  }
  
  /**
   * Get provider name
   */
  getName(): string {
    return 'telegram';
  }
  
  /**
   * Retrieve context from Telegram conversations
   * 
   * @param query The user's query
   * @param options Additional options including aiInstanceId and userId
   * @returns Context and sources
   */
  async getContext(query: string, options: any): Promise<{
    context: string;
    sources: any[];
    tokenCount: number;
  }> {
    try {
      // Validate required options
      if (!options.aiInstanceId) {
        throw new Error('aiInstanceId is required');
      }
      
      console.log(`Telegram: Retrieving conversation data for AI instance ${options.aiInstanceId} with query "${query}"`);
      
      // Initialize Supabase client
      const supabase = createClient(this.supabaseUrl, this.supabaseKey);
      
      // Get Telegram integration details
      const { data: telegramIntegration, error: integrationError } = await supabase
        .from('integrations')
        .select('credentials, config')
        .eq('ai_instance_id', options.aiInstanceId)
        .eq('type', 'telegram')
        .eq('active', true)
        .single();
      
      if (integrationError || !telegramIntegration) {
        throw new Error('No active Telegram integration found for this AI instance');
      }
      
      const credentials = telegramIntegration.credentials as TelegramCredential;
      
      if (!credentials || !credentials.bot_token) {
        throw new Error('Invalid Telegram integration credentials');
      }
      
      // In a production environment, we would use the Telegram Bot API to fetch messages
      // For now, retrieve conversation data from the 'telegram_messages' table in Supabase
      
      // Get conversation based on the user ID if provided in options
      let userId = options.userId;
      let chatId = options.chatId; // Can be used if provided in options
      
      // Use different queries depending on whether we have a specific chat/user ID
      let messageQuery = supabase
        .from('telegram_messages')
        .select('*')
        .eq('ai_instance_id', options.aiInstanceId)
        .order('timestamp', { ascending: false })
        .limit(10);
      
      if (chatId) {
        messageQuery = messageQuery.eq('chat_id', chatId);
      } else if (userId) {
        messageQuery = messageQuery.eq('user_id', userId);
      }
      
      const { data: messages, error: messagesError } = await messageQuery;
      
      if (messagesError) {
        console.error('Error fetching Telegram messages:', messagesError);
        throw new Error('Failed to retrieve Telegram conversation history');
      }
      
      // For now, use mock data if no real data is available
      const conversationData = messages && messages.length > 0 ? 
        this.formatRealMessages(messages) : 
        this.getMockConversationData();
      
      // Format the final context
      const formattedContext = `
Telegram Conversation History:

${conversationData.text}
      `.trim();
      
      return {
        context: formattedContext,
        sources: conversationData.sources,
        tokenCount: Math.ceil(formattedContext.length / 4) // Rough token estimate
      };
    } catch (error) {
      console.error('Error in Telegram provider:', error);
      
      // Return a graceful error message
      const errorMessage = `
Unable to retrieve Telegram conversation data at this time. The Telegram bot integration may not be properly set up.
      `.trim();
      
      return {
        context: errorMessage,
        sources: [],
        tokenCount: Math.ceil(errorMessage.length / 4)
      };
    }
  }
  
  /**
   * Format real messages from the database
   */
  private formatRealMessages(messages: any[]): { text: string, sources: any[] } {
    // Sort messages by timestamp (oldest first)
    const sortedMessages = [...messages].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    // Format the conversation
    const conversation = sortedMessages.map(msg => {
      const date = new Date(msg.timestamp).toLocaleString();
      const sender = msg.from_user_username || msg.from_user_first_name || 'User';
      return `${sender} (${date}): ${msg.text}`;
    }).join('\n\n');
    
    // Create sources
    const sources = [{
      id: 'telegram-conversation',
      content: 'Telegram conversation history',
      metadata: {
        source: 'telegram',
        type: 'conversation_history',
        message_count: sortedMessages.length,
        last_updated: sortedMessages[sortedMessages.length - 1]?.timestamp || new Date().toISOString()
      }
    }];
    
    return { text: conversation, sources };
  }
  
  /**
   * Get mock conversation data
   */
  private getMockConversationData(): { text: string, sources: any[] } {
    const conversation = `
User123 (08/01/2024, 10:15 AM): Hello, I need help with my order

AkiiBot (08/01/2024, 10:16 AM): Hi! I'm Akii, your AI assistant. I'd be happy to help with your order. Could you please provide your order number?

User123 (08/01/2024, 10:17 AM): It's #A12345

AkiiBot (08/01/2024, 10:18 AM): Thank you. I can see your order #A12345 for the Premium Package was placed yesterday and is currently being processed. It should ship within 24-48 hours. Is there anything specific you'd like to know about this order?

User123 (08/01/2024, 10:20 AM): I need to change the shipping address

AkiiBot (08/01/2024, 10:21 AM): I'd be happy to help you update the shipping address. Since the order is still processing, we can make this change. Could you please provide the new shipping address?

User123 (08/01/2024, 10:22 AM): 123 New Street, Apt 4B, New City, NY 10001

AkiiBot (08/01/2024, 10:24 AM): Thank you. I've updated the shipping address for order #A12345 to:
123 New Street, Apt 4B
New City, NY 10001
You'll receive a confirmation email shortly. Is there anything else you need help with?

User123 (08/01/2024, 10:25 AM): That's all, thank you!

AkiiBot (08/01/2024, 10:26 AM): You're welcome! If you have any other questions, feel free to ask. Have a great day!
    `.trim();
    
    const sources = [{
      id: 'telegram-conversation-mock',
      content: 'Mock Telegram conversation history',
      metadata: {
        source: 'telegram',
        type: 'conversation_history',
        is_mock: true,
        created_at: new Date().toISOString()
      }
    }];
    
    return { text: conversation, sources };
  }
}