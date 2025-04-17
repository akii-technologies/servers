/**
 * Facebook Messenger Context Provider
 * 
 * Retrieves conversation history and data from Facebook Messenger
 */

import { createClient } from '@supabase/supabase-js';
import { ContextProvider } from '../../contextHandler';

interface FacebookCredential {
  page_id: string;
  page_access_token: string;
  app_id?: string;
  app_secret?: string;
}

/**
 * Facebook Messenger Context Provider Implementation
 * 
 * Provides conversation history and user data from Facebook Messenger
 */
export class FacebookMessengerProvider implements ContextProvider {
  private supabaseUrl: string;
  private supabaseKey: string;
  
  constructor() {
    // Load from environment variables
    this.supabaseUrl = process.env.SUPABASE_URL || '';
    this.supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!this.supabaseUrl || !this.supabaseKey) {
      console.warn('Facebook Messenger provider: Missing Supabase credentials');
    }
  }
  
  /**
   * Get provider name
   */
  getName(): string {
    return 'facebook';
  }
  
  /**
   * Retrieve context from Facebook Messenger conversations
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
      
      console.log(`Facebook Messenger: Retrieving conversation data for AI instance ${options.aiInstanceId} with query "${query}"`);
      
      // Initialize Supabase client
      const supabase = createClient(this.supabaseUrl, this.supabaseKey);
      
      // Get Facebook integration details
      const { data: facebookIntegration, error: integrationError } = await supabase
        .from('integrations')
        .select('credentials, config')
        .eq('ai_instance_id', options.aiInstanceId)
        .eq('type', 'facebook')
        .eq('active', true)
        .single();
      
      if (integrationError || !facebookIntegration) {
        throw new Error('No active Facebook Messenger integration found for this AI instance');
      }
      
      const credentials = facebookIntegration.credentials as FacebookCredential;
      
      if (!credentials || !credentials.page_id || !credentials.page_access_token) {
        throw new Error('Invalid Facebook Messenger integration credentials');
      }
      
      // In a production environment, we would use the Facebook Graph API to fetch messages
      // For now, retrieve conversation data from the 'facebook_messages' table in Supabase
      
      // Get the Facebook user ID from options, or use a default
      const facebookUserId = options.facebookUserId || options.userId;
      
      // Query for recent messages
      let messageQuery = supabase
        .from('facebook_messages')
        .select('*')
        .eq('ai_instance_id', options.aiInstanceId)
        .order('timestamp', { ascending: false })
        .limit(10);
      
      if (facebookUserId) {
        messageQuery = messageQuery.eq('sender_id', facebookUserId);
      }
      
      const { data: messages, error: messagesError } = await messageQuery;
      
      if (messagesError) {
        console.error('Error fetching Facebook messages:', messagesError);
        throw new Error('Failed to retrieve Facebook Messenger conversation history');
      }
      
      // For now, use mock data if no real data is available
      const conversationData = messages && messages.length > 0 ? 
        this.formatRealMessages(messages) : 
        this.getMockConversationData();
      
      // Format the final context
      const formattedContext = `
Facebook Messenger Conversation History:

${conversationData.text}
      `.trim();
      
      return {
        context: formattedContext,
        sources: conversationData.sources,
        tokenCount: Math.ceil(formattedContext.length / 4) // Rough token estimate
      };
    } catch (error) {
      console.error('Error in Facebook Messenger provider:', error);
      
      // Return a graceful error message
      const errorMessage = `
Unable to retrieve Facebook Messenger conversation data at this time. The Facebook Page integration may not be properly set up.
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
      // Determine if the message is from the user or the page/assistant
      const isFromUser = msg.sender_id !== msg.page_id;
      const sender = isFromUser ? 'User' : 'Assistant';
      
      let messageContent = msg.message;
      if (msg.attachments && msg.attachments.length > 0) {
        messageContent += ` [Attachment: ${msg.attachments[0].type}]`;
      }
      
      return `${sender} (${date}): ${messageContent}`;
    }).join('\n\n');
    
    // Create sources
    const sources = [{
      id: 'facebook-conversation',
      content: 'Facebook Messenger conversation history',
      metadata: {
        source: 'facebook',
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
User (08/01/2024, 2:15 PM): Hi there, I saw your Facebook ad about AI assistants

Assistant (08/01/2024, 2:16 PM): Hello! Thanks for reaching out. Yes, we specialize in AI assistants for businesses. How can I help you today?

User (08/01/2024, 2:18 PM): I run an e-commerce store and I'm interested in adding an AI chat to help customers

Assistant (08/01/2024, 2:20 PM): That's a great use case! Our AI assistants are perfect for e-commerce. They can help with:
- Product recommendations
- Order status inquiries
- Return policy questions
- Technical support
- Inventory checks

Would you like to know more about how it works with e-commerce platforms specifically?

User (08/01/2024, 2:22 PM): Yes, I use Shopify. How does the integration work?

Assistant (08/01/2024, 2:24 PM): We have a seamless integration with Shopify! Here's how it works:

1. You install our Shopify app from the app store
2. Connect your AI instance to your Shopify store with just a few clicks
3. Upload your product catalog and policies (or we can automatically import them)
4. Customize the chat widget to match your brand
5. The AI will be able to:
   - Search your entire product catalog
   - Check real-time inventory
   - Look up order statuses
   - Process returns
   - Provide accurate shipping estimates

Would you like to see a demo of how this works on a Shopify store?

User (08/01/2024, 2:26 PM): That sounds great! Yes, I'd like to see a demo

Assistant (08/01/2024, 2:27 PM): Wonderful! I can schedule a personalized demo for you. Would you prefer a video call or a pre-recorded demo? And what would be a good time for you in the next few days?
    `.trim();
    
    const sources = [{
      id: 'facebook-conversation-mock',
      content: 'Mock Facebook Messenger conversation history',
      metadata: {
        source: 'facebook',
        type: 'conversation_history',
        is_mock: true,
        created_at: new Date().toISOString()
      }
    }];
    
    return { text: conversation, sources };
  }
}