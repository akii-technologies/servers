/**
 * WebChat Context Provider
 * 
 * Retrieves conversation history and data from website chat widget
 */

import { createClient } from '@supabase/supabase-js';
import { ContextProvider } from '../../contextHandler';

interface WebChatCredential {
  api_key?: string;
  site_id?: string;
}

/**
 * WebChat Context Provider Implementation
 * 
 * Provides conversation history and user data from website chat
 */
export class WebChatProvider implements ContextProvider {
  private supabaseUrl: string;
  private supabaseKey: string;
  
  constructor() {
    // Load from environment variables
    this.supabaseUrl = process.env.SUPABASE_URL || '';
    this.supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!this.supabaseUrl || !this.supabaseKey) {
      console.warn('WebChat provider: Missing Supabase credentials');
    }
  }
  
  /**
   * Get provider name
   */
  getName(): string {
    return 'webchat';
  }
  
  /**
   * Retrieve context from WebChat conversations
   * 
   * @param query The user's query
   * @param options Additional options including aiInstanceId and sessionId
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
      
      console.log(`WebChat: Retrieving conversation data for AI instance ${options.aiInstanceId} with query "${query}"`);
      
      // Initialize Supabase client
      const supabase = createClient(this.supabaseUrl, this.supabaseKey);
      
      // Get WebChat integration details
      const { data: webChatIntegration, error: integrationError } = await supabase
        .from('integrations')
        .select('credentials, config')
        .eq('ai_instance_id', options.aiInstanceId)
        .eq('type', 'webchat')
        .eq('active', true)
        .single();
      
      if (integrationError || !webChatIntegration) {
        throw new Error('No active WebChat integration found for this AI instance');
      }
      
      const credentials = webChatIntegration.credentials as WebChatCredential;
      const config = webChatIntegration.config || {};
      
      // Get conversation based on the session ID if provided in options
      let sessionId = options.sessionId;
      let visitorId = options.visitorId;
      
      // Use different queries depending on whether we have a specific session/visitor ID
      let conversationQuery = supabase
        .from('web_chat_messages')
        .select('*')
        .eq('ai_instance_id', options.aiInstanceId)
        .order('timestamp', { ascending: false })
        .limit(20);
      
      if (sessionId) {
        conversationQuery = conversationQuery.eq('session_id', sessionId);
      } else if (visitorId) {
        conversationQuery = conversationQuery.eq('visitor_id', visitorId);
      }
      
      const { data: messages, error: messagesError } = await conversationQuery;
      
      if (messagesError) {
        console.error('Error fetching WebChat messages:', messagesError);
        throw new Error('Failed to retrieve WebChat conversation history');
      }
      
      // Check if user was browsing specific pages (from session data)
      let pageViewsQuery = supabase
        .from('web_visitor_pageviews')
        .select('*')
        .eq('ai_instance_id', options.aiInstanceId)
        .order('timestamp', { ascending: false })
        .limit(5);
        
      if (sessionId) {
        pageViewsQuery = pageViewsQuery.eq('session_id', sessionId);
      } else if (visitorId) {
        pageViewsQuery = pageViewsQuery.eq('visitor_id', visitorId);
      }
      
      const { data: pageViews, error: pageViewsError } = await pageViewsQuery;
      
      // For now, use mock data if no real data is available
      const conversationData = messages && messages.length > 0 ? 
        this.formatRealMessages(messages) : 
        this.getMockConversationData();
      
      // Add page view context if available
      let pageViewContext = '';
      if (pageViews && pageViews.length > 0 && !pageViewsError) {
        pageViewContext = this.formatPageViews(pageViews);
      }
      
      // Format the final context
      const formattedContext = `
WebChat Conversation History:

${conversationData.text}

${pageViewContext ? `\nVisitor Page Views:\n${pageViewContext}` : ''}
      `.trim();
      
      return {
        context: formattedContext,
        sources: conversationData.sources,
        tokenCount: Math.ceil(formattedContext.length / 4) // Rough token estimate
      };
    } catch (error) {
      console.error('Error in WebChat provider:', error);
      
      // Return a graceful error message
      const errorMessage = `
Unable to retrieve WebChat conversation data at this time. The WebChat integration may not be properly set up.
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
      const sender = msg.sender_type === 'user' ? 'Visitor' : 'AI Assistant';
      return `${sender} (${date}): ${msg.message}`;
    }).join('\n\n');
    
    // Create sources
    const sources = [{
      id: 'webchat-conversation',
      content: 'WebChat conversation history',
      metadata: {
        source: 'webchat',
        type: 'conversation_history',
        message_count: sortedMessages.length,
        last_updated: sortedMessages[sortedMessages.length - 1]?.timestamp || new Date().toISOString()
      }
    }];
    
    return { text: conversation, sources };
  }
  
  /**
   * Format page views data
   */
  private formatPageViews(pageViews: any[]): string {
    // Sort page views by timestamp (newest first)
    const sortedPageViews = [...pageViews].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    // Format the page views
    return sortedPageViews.map(view => {
      const date = new Date(view.timestamp).toLocaleString();
      return `- ${view.page_url} (viewed on ${date})`;
    }).join('\n');
  }
  
  /**
   * Get mock conversation data
   */
  private getMockConversationData(): { text: string, sources: any[] } {
    const conversation = `
Visitor (08/30/2024, 2:15 PM): Hi, I'm looking for information about your pricing plans

AI Assistant (08/30/2024, 2:15 PM): Hello! I'd be happy to help you with our pricing plans. We offer three tiers: Starter ($29/month), Professional ($99/month), and Enterprise (custom pricing). Which plan are you most interested in learning about?

Visitor (08/30/2024, 2:16 PM): What's included in the Professional plan?

AI Assistant (08/30/2024, 2:16 PM): The Professional plan at $99/month includes:
- Up to 5 AI instances
- 50,000 messages per month
- Advanced RAG capabilities
- Priority support
- Custom branding options
- API access
- 10 team members
- All integrations (Slack, WhatsApp, Telegram, etc.)

Is there a specific feature you're particularly interested in?

Visitor (08/30/2024, 2:18 PM): Do you offer any discounts for annual subscriptions?

AI Assistant (08/30/2024, 2:18 PM): Yes, we offer a 20% discount on all plans for annual subscriptions! For the Professional plan, that would bring the price down to $79.20/month when billed annually ($950.40 total for the year). Would you like me to provide more details about the annual subscription options?

Visitor (08/30/2024, 2:19 PM): That sounds good. Can I start with a trial before committing?

AI Assistant (08/30/2024, 2:20 PM): Absolutely! We offer a 14-day free trial for all our plans with no credit card required. You'll get full access to all features during the trial period so you can thoroughly test if it meets your needs. Would you like me to help you set up a trial account?
    `.trim();
    
    const sources = [{
      id: 'webchat-conversation-mock',
      content: 'Mock WebChat conversation history',
      metadata: {
        source: 'webchat',
        type: 'conversation_history',
        is_mock: true,
        created_at: new Date().toISOString()
      }
    }];
    
    return { text: conversation, sources };
  }
}