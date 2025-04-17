/**
 * WhatsApp Context Provider
 * 
 * Retrieves conversation history and data from WhatsApp chats
 */

import { createClient } from '@supabase/supabase-js';
import { ContextProvider } from '../../contextHandler';

interface WhatsAppCredential {
  phone_number_id: string;
  access_token: string;
  webhook_secret?: string;
}

/**
 * WhatsApp Context Provider Implementation
 * 
 * Provides conversation history and user data from WhatsApp
 */
export class WhatsAppProvider implements ContextProvider {
  private supabaseUrl: string;
  private supabaseKey: string;
  
  constructor() {
    // Load from environment variables
    this.supabaseUrl = process.env.SUPABASE_URL || '';
    this.supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!this.supabaseUrl || !this.supabaseKey) {
      console.warn('WhatsApp provider: Missing Supabase credentials');
    }
  }
  
  /**
   * Get provider name
   */
  getName(): string {
    return 'whatsapp';
  }
  
  /**
   * Retrieve context from WhatsApp conversations
   * 
   * @param query The user's query
   * @param options Additional options including aiInstanceId and phone
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
      
      console.log(`WhatsApp: Retrieving conversation data for AI instance ${options.aiInstanceId} with query "${query}"`);
      
      // Initialize Supabase client
      const supabase = createClient(this.supabaseUrl, this.supabaseKey);
      
      // Get WhatsApp integration details
      const { data: whatsappIntegration, error: integrationError } = await supabase
        .from('integrations')
        .select('credentials, config')
        .eq('ai_instance_id', options.aiInstanceId)
        .eq('type', 'whatsapp')
        .eq('active', true)
        .single();
      
      if (integrationError || !whatsappIntegration) {
        throw new Error('No active WhatsApp integration found for this AI instance');
      }
      
      const credentials = whatsappIntegration.credentials as WhatsAppCredential;
      
      if (!credentials || !credentials.phone_number_id || !credentials.access_token) {
        throw new Error('Invalid WhatsApp integration credentials');
      }
      
      // In a production environment, we would use the WhatsApp Business API to fetch messages
      // For now, retrieve conversation data from the 'whatsapp_messages' table in Supabase
      
      // Get the user's phone number from options, or use a default
      const userPhone = options.phone || options.userId;
      
      // Query for recent messages
      let messageQuery = supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('ai_instance_id', options.aiInstanceId)
        .order('timestamp', { ascending: false })
        .limit(10);
      
      if (userPhone) {
        messageQuery = messageQuery.eq('from', userPhone);
      }
      
      const { data: messages, error: messagesError } = await messageQuery;
      
      if (messagesError) {
        console.error('Error fetching WhatsApp messages:', messagesError);
        throw new Error('Failed to retrieve WhatsApp conversation history');
      }
      
      // For now, use mock data if no real data is available
      const conversationData = messages && messages.length > 0 ? 
        this.formatRealMessages(messages) : 
        this.getMockConversationData();
      
      // Format the final context
      const formattedContext = `
WhatsApp Conversation History:

${conversationData.text}
      `.trim();
      
      return {
        context: formattedContext,
        sources: conversationData.sources,
        tokenCount: Math.ceil(formattedContext.length / 4) // Rough token estimate
      };
    } catch (error) {
      console.error('Error in WhatsApp provider:', error);
      
      // Return a graceful error message
      const errorMessage = `
Unable to retrieve WhatsApp conversation data at this time. The WhatsApp Business API integration may not be properly set up.
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
      const sender = msg.from_number ? `+${msg.from_number.substr(-4)}` : 'User';
      const role = msg.direction === 'inbound' ? sender : 'Assistant';
      return `${role} (${date}): ${msg.body}`;
    }).join('\n\n');
    
    // Create sources
    const sources = [{
      id: 'whatsapp-conversation',
      content: 'WhatsApp conversation history',
      metadata: {
        source: 'whatsapp',
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
+1234 (08/01/2024, 9:45 AM): Hi, I have a question about your service

Assistant (08/01/2024, 9:46 AM): Hello! I'm here to help with any questions you have about our service. What would you like to know?

+1234 (08/01/2024, 9:47 AM): What features are included in the premium plan?

Assistant (08/01/2024, 9:48 AM): The Premium Plan includes:
- Unlimited AI conversations
- Custom knowledge base
- Advanced analytics
- Priority support
- API access
- 5 team members
- All integrations (Slack, Gmail, etc.)

The price is $49/month or $470/year (saving 20%). Would you like more details about any specific feature?

+1234 (08/01/2024, 9:50 AM): How does the custom knowledge base work?

Assistant (08/01/2024, 9:52 AM): The custom knowledge base allows you to upload your own documents, websites, and data that the AI can learn from. Here's how it works:

1. Upload files (PDF, Word, Excel, etc.) or connect data sources
2. Our system automatically processes and indexes all content
3. The AI can now reference your specific information when answering questions
4. You can organize content into different knowledge bases for different purposes

This ensures the AI gives answers specific to your business, products, or processes. Would you like to know about the file types supported or size limits?

+1234 (08/01/2024, 9:55 AM): What file types are supported?

Assistant (08/01/2024, 9:56 AM): We support a wide range of file types:

Documents: PDF, DOCX, DOC, TXT, RTF, MD
Spreadsheets: XLSX, XLS, CSV
Presentations: PPTX, PPT
Web: HTML, XML
Images: JPG, PNG (with OCR for text extraction)
Code: JSON, YAML, PY, JS, etc.

The maximum file size is 50MB per file, and the Premium plan includes 10GB of storage for your knowledge base. Is there a specific file type you plan to use?
    `.trim();
    
    const sources = [{
      id: 'whatsapp-conversation-mock',
      content: 'Mock WhatsApp conversation history',
      metadata: {
        source: 'whatsapp',
        type: 'conversation_history',
        is_mock: true,
        created_at: new Date().toISOString()
      }
    }];
    
    return { text: conversation, sources };
  }
}