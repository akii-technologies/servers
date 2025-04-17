/**
 * Instagram Context Provider
 * 
 * Retrieves conversation history and data from Instagram DMs
 */

import { createClient } from '@supabase/supabase-js';
import { ContextProvider } from '../../contextHandler';

interface InstagramCredential {
  instagram_account_id: string;
  page_access_token: string;
  app_id?: string;
}

/**
 * Instagram Context Provider Implementation
 * 
 * Provides conversation history and user data from Instagram DMs
 */
export class InstagramProvider implements ContextProvider {
  private supabaseUrl: string;
  private supabaseKey: string;
  
  constructor() {
    // Load from environment variables
    this.supabaseUrl = process.env.SUPABASE_URL || '';
    this.supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!this.supabaseUrl || !this.supabaseKey) {
      console.warn('Instagram provider: Missing Supabase credentials');
    }
  }
  
  /**
   * Get provider name
   */
  getName(): string {
    return 'instagram';
  }
  
  /**
   * Retrieve context from Instagram conversations
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
      
      console.log(`Instagram: Retrieving conversation data for AI instance ${options.aiInstanceId} with query "${query}"`);
      
      // Initialize Supabase client
      const supabase = createClient(this.supabaseUrl, this.supabaseKey);
      
      // Get Instagram integration details
      const { data: instagramIntegration, error: integrationError } = await supabase
        .from('integrations')
        .select('credentials, config')
        .eq('ai_instance_id', options.aiInstanceId)
        .eq('type', 'instagram')
        .eq('active', true)
        .single();
      
      if (integrationError || !instagramIntegration) {
        throw new Error('No active Instagram integration found for this AI instance');
      }
      
      const credentials = instagramIntegration.credentials as InstagramCredential;
      
      if (!credentials || !credentials.instagram_account_id || !credentials.page_access_token) {
        throw new Error('Invalid Instagram integration credentials');
      }
      
      // In a production environment, we would use the Instagram Graph API via Facebook to fetch messages
      // For now, retrieve conversation data from the 'instagram_messages' table in Supabase
      
      // Get the Instagram user ID from options, or use a default
      const instagramUserId = options.instagramUserId || options.userId;
      
      // Query for recent messages
      let messageQuery = supabase
        .from('instagram_messages')
        .select('*')
        .eq('ai_instance_id', options.aiInstanceId)
        .order('timestamp', { ascending: false })
        .limit(10);
      
      if (instagramUserId) {
        messageQuery = messageQuery.eq('sender_id', instagramUserId);
      }
      
      const { data: messages, error: messagesError } = await messageQuery;
      
      if (messagesError) {
        console.error('Error fetching Instagram messages:', messagesError);
        throw new Error('Failed to retrieve Instagram conversation history');
      }
      
      // For now, use mock data if no real data is available
      const conversationData = messages && messages.length > 0 ? 
        this.formatRealMessages(messages) : 
        this.getMockConversationData();
      
      // Format the final context
      const formattedContext = `
Instagram DM Conversation History:

${conversationData.text}
      `.trim();
      
      return {
        context: formattedContext,
        sources: conversationData.sources,
        tokenCount: Math.ceil(formattedContext.length / 4) // Rough token estimate
      };
    } catch (error) {
      console.error('Error in Instagram provider:', error);
      
      // Return a graceful error message
      const errorMessage = `
Unable to retrieve Instagram conversation data at this time. The Instagram Business account integration may not be properly set up.
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
      // Determine if the message is from the user or the business/assistant
      const isFromUser = msg.sender_id !== msg.instagram_account_id;
      const sender = isFromUser ? (msg.username || 'User') : 'Assistant';
      
      let messageContent = msg.message;
      if (msg.media_type && msg.media_type !== 'text') {
        messageContent += ` [${msg.media_type.charAt(0).toUpperCase() + msg.media_type.slice(1)}]`;
      }
      
      return `${sender} (${date}): ${messageContent}`;
    }).join('\n\n');
    
    // Create sources
    const sources = [{
      id: 'instagram-conversation',
      content: 'Instagram DM conversation history',
      metadata: {
        source: 'instagram',
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
fashion_lover22 (08/01/2024, 11:30 AM): Hi, I saw your post about the new summer collection [Image]

Assistant (08/01/2024, 11:32 AM): Hello! Thanks for reaching out. Yes, we just launched our summer collection! The image you shared is our new Coastal Breeze line. Is there something specific you're interested in?

fashion_lover22 (08/01/2024, 11:34 AM): I love the blue dress in that collection. Do you have it in size medium?

Assistant (08/01/2024, 11:36 AM): The Coastal Breeze dress in azure blue is one of our bestsellers! I just checked our inventory and we do have it in medium. Would you like me to send you the link to purchase it or add it to your cart?

fashion_lover22 (08/01/2024, 11:38 AM): Could you send me the link please? And does it come in other colors?

Assistant (08/01/2024, 11:40 AM): Here's the link to the Azure Blue Coastal Breeze dress in medium: [website.com/coastal-breeze-azure-m]

It also comes in:
- Coral Sunset
- Mint Green
- Classic Black

All colors are currently in stock in medium. Would you like me to send links for those as well?

fashion_lover22 (08/01/2024, 11:42 AM): Just the mint green one please!

Assistant (08/01/2024, 11:43 AM): Here's the link for the Mint Green Coastal Breeze dress in medium: [website.com/coastal-breeze-mint-m]

Is there anything else I can help you with today? We're also offering free shipping on orders over $50 for the next 48 hours!
    `.trim();
    
    const sources = [{
      id: 'instagram-conversation-mock',
      content: 'Mock Instagram DM conversation history',
      metadata: {
        source: 'instagram',
        type: 'conversation_history',
        is_mock: true,
        created_at: new Date().toISOString()
      }
    }];
    
    return { text: conversation, sources };
  }
}