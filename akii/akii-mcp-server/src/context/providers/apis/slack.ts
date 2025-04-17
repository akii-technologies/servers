/**
 * Slack API Context Provider
 * 
 * Retrieves data from Slack API
 */

import { createClient } from '@supabase/supabase-js';
import { ContextProvider } from '../../contextHandler';

interface SlackCredential {
  access_token: string;
  bot_token?: string;
  workspace_id?: string;
}

/**
 * Slack API Context Provider Implementation
 * 
 * Provides data from Slack channels, messages, and users
 */
export class SlackApiProvider implements ContextProvider {
  private supabaseUrl: string;
  private supabaseKey: string;
  
  constructor() {
    // Load from environment variables
    this.supabaseUrl = process.env.SUPABASE_URL || '';
    this.supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!this.supabaseUrl || !this.supabaseKey) {
      console.warn('Slack API provider: Missing Supabase credentials');
    }
  }
  
  /**
   * Get provider name
   */
  getName(): string {
    return 'slack';
  }
  
  /**
   * Retrieve context from Slack API
   * 
   * @param query The user's query
   * @param options Additional options including aiInstanceId
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
      
      console.log(`Slack API: Retrieving data for AI instance ${options.aiInstanceId} with query "${query}"`);
      
      // Initialize Supabase client
      const supabase = createClient(this.supabaseUrl, this.supabaseKey);
      
      // Get Slack credentials from integrations table
      const { data: slackIntegration, error: integrationError } = await supabase
        .from('integrations')
        .select('credentials, config')
        .eq('ai_instance_id', options.aiInstanceId)
        .eq('type', 'slack')
        .eq('active', true)
        .single();
      
      if (integrationError || !slackIntegration) {
        throw new Error('No active Slack integration found for this AI instance');
      }
      
      const credentials = slackIntegration.credentials as SlackCredential;
      const integrationConfig = slackIntegration.config || {};
      
      if (!credentials || !credentials.access_token) {
        throw new Error('Invalid Slack integration credentials');
      }
      
      // In production, we would call the Slack API with the credentials
      // For now, return mock data based on the query
      
      const queryLower = query.toLowerCase();
      let contextData = '';
      let sources = [];
      
      // Determine what Slack data to retrieve based on the query
      if (queryLower.includes('channel') || queryLower.includes('channels')) {
        const { data: channelData, dataSources } = this.getChannelData();
        contextData = channelData;
        sources = dataSources;
      } 
      else if (queryLower.includes('message') || queryLower.includes('conversation') || queryLower.includes('chat')) {
        const { data: messageData, dataSources } = this.getMessageData();
        contextData = messageData;
        sources = dataSources;
      }
      else if (queryLower.includes('user') || queryLower.includes('member') || queryLower.includes('team')) {
        const { data: userData, dataSources } = this.getUserData();
        contextData = userData;
        sources = dataSources;
      }
      else if (queryLower.includes('file') || queryLower.includes('document')) {
        const { data: fileData, dataSources } = this.getFileData();
        contextData = fileData;
        sources = dataSources;
      }
      else {
        // General information about Slack workspace
        const workspaceName = integrationConfig.workspace_name || 'Your Workspace';
        contextData = `
Slack Workspace Information: ${workspaceName}

You have access to the following Slack data:
- Channels and conversations
- Recent messages
- Team members and user information
- Shared files and documents

To get specific data, you can ask about:
- Channels (list of channels, channel info)
- Messages (recent conversations, message history)
- Users (team members, user presence)
- Files (shared documents, images)
        `.trim();
        
        sources = [{
          id: 'slack-workspace-info',
          content: 'General Slack workspace information',
          metadata: {
            source: 'slack',
            type: 'workspace_info',
            workspace_name: workspaceName
          }
        }];
      }
      
      // Format the final context
      const formattedContext = `
Information from Slack:

${contextData}
      `.trim();
      
      return {
        context: formattedContext,
        sources: sources,
        tokenCount: Math.ceil(formattedContext.length / 4) // Rough token estimate
      };
    } catch (error) {
      console.error('Error in Slack API provider:', error);
      
      // Return a graceful error message
      const errorMessage = `
Unable to retrieve data from Slack at this time. The Slack integration may not be set up correctly or there might be an authentication issue. Please check your Slack integration settings.
      `.trim();
      
      return {
        context: errorMessage,
        sources: [],
        tokenCount: Math.ceil(errorMessage.length / 4)
      };
    }
  }
  
  /**
   * Get mock channel data from Slack
   */
  private getChannelData(): { data: string, dataSources: any[] } {
    const channelData = `
Slack Channels:

- #general
  Purpose: Company-wide announcements and work-based matters
  Members: 45 members
  Latest Activity: Today at 10:23 AM
  
- #product-development
  Purpose: Product planning, development updates, and technical discussions
  Members: 18 members
  Latest Activity: Yesterday at 4:15 PM
  
- #customer-support
  Purpose: Customer issues, support tickets, and resolution tracking
  Members: 12 members
  Latest Activity: Today at 9:05 AM
  
- #marketing
  Purpose: Marketing campaigns, content planning, and analytics
  Members: 8 members
  Latest Activity: 2 days ago at 2:30 PM
    `.trim();
    
    const dataSources = [
      {
        id: 'slack-channels',
        content: 'Channel list from Slack workspace',
        metadata: {
          source: 'slack',
          type: 'channel_data',
          channel_count: 4,
          last_updated: new Date().toISOString()
        }
      }
    ];
    
    return { data: channelData, dataSources };
  }
  
  /**
   * Get mock message data from Slack
   */
  private getMessageData(): { data: string, dataSources: any[] } {
    const messageData = `
Recent Slack Messages:

Channel: #product-development
- Sarah Chen (Today at 10:15 AM): The new feature mockups are ready for review. I've shared them in the Design folder.
- Mike Johnson (Today at 10:20 AM): Thanks Sarah! I'll take a look and provide feedback by EOD.
- Sarah Chen (Today at 10:22 AM): Great, we should finalize these by Thursday to stay on schedule.

Channel: #customer-support
- Alex Morgan (Today at 9:05 AM): We're seeing an increase in login issues from users on the mobile app.
- Jordan Lee (Today at 9:12 AM): I'm checking the logs now. Might be related to yesterday's deployment.
- Alex Morgan (Today at 9:30 AM): Let's create a ticket and prioritize this for the engineering team.
    `.trim();
    
    const dataSources = [
      {
        id: 'slack-messages',
        content: 'Recent messages from Slack channels',
        metadata: {
          source: 'slack',
          type: 'message_data',
          channels: ['#product-development', '#customer-support'],
          message_count: 6,
          last_updated: new Date().toISOString()
        }
      }
    ];
    
    return { data: messageData, dataSources };
  }
  
  /**
   * Get mock user data from Slack
   */
  private getUserData(): { data: string, dataSources: any[] } {
    const userData = `
Slack Team Members:

- Sarah Chen
  Role: Product Designer
  Status: Active (Working on mockups)
  Time Zone: Pacific Time (UTC-7)
  
- Mike Johnson
  Role: Senior Developer
  Status: Active
  Time Zone: Eastern Time (UTC-4)
  
- Alex Morgan
  Role: Customer Support Lead
  Status: Active
  Time Zone: Central Time (UTC-5)
  
- Jordan Lee
  Role: DevOps Engineer
  Status: Away (Back at 2:00 PM)
  Time Zone: Pacific Time (UTC-7)
  
- Priya Patel
  Role: Marketing Manager
  Status: In a meeting
  Time Zone: Eastern Time (UTC-4)
    `.trim();
    
    const dataSources = [
      {
        id: 'slack-users',
        content: 'Team member information from Slack',
        metadata: {
          source: 'slack',
          type: 'user_data',
          user_count: 5,
          last_updated: new Date().toISOString()
        }
      }
    ];
    
    return { data: userData, dataSources };
  }
  
  /**
   * Get mock file data from Slack
   */
  private getFileData(): { data: string, dataSources: any[] } {
    const fileData = `
Recent Shared Files in Slack:

- Q3_Product_Roadmap.pdf
  Shared by: Priya Patel in #general
  Shared: Yesterday at 2:45 PM
  Size: 2.8 MB
  Downloads: 12
  
- Frontend_Design_Mockups.sketch
  Shared by: Sarah Chen in #product-development
  Shared: Today at 10:15 AM
  Size: 8.5 MB
  Downloads: 3
  
- Customer_Feedback_Summary.xlsx
  Shared by: Alex Morgan in #customer-support
  Shared: 2 days ago at 11:20 AM
  Size: 1.2 MB
  Downloads: 8
  
- System_Architecture_Diagram.png
  Shared by: Jordan Lee in #product-development
  Shared: 3 days ago at 4:35 PM
  Size: 650 KB
  Downloads: 15
    `.trim();
    
    const dataSources = [
      {
        id: 'slack-files',
        content: 'Recently shared files in Slack',
        metadata: {
          source: 'slack',
          type: 'file_data',
          file_count: 4,
          last_updated: new Date().toISOString()
        }
      }
    ];
    
    return { data: fileData, dataSources };
  }
}