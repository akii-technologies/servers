/**
 * Zapier API Context Provider
 * 
 * Retrieves data from Zapier webhooks
 */

import { createClient } from '@supabase/supabase-js';
import { ContextProvider } from '../../contextHandler';

interface ZapierCredential {
  webhook_url: string;
  api_key?: string;
}

/**
 * Zapier API Context Provider Implementation
 * 
 * Provides data from Zapier integrations through webhooks
 */
export class ZapierApiProvider implements ContextProvider {
  private supabaseUrl: string;
  private supabaseKey: string;
  
  constructor() {
    // Load from environment variables
    this.supabaseUrl = process.env.SUPABASE_URL || '';
    this.supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!this.supabaseUrl || !this.supabaseKey) {
      console.warn('Zapier API provider: Missing Supabase credentials');
    }
  }
  
  /**
   * Get provider name
   */
  getName(): string {
    return 'zapier';
  }
  
  /**
   * Retrieve context from Zapier integrations
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
      
      console.log(`Zapier API: Retrieving data for AI instance ${options.aiInstanceId} with query "${query}"`);
      
      // Initialize Supabase client
      const supabase = createClient(this.supabaseUrl, this.supabaseKey);
      
      // Get Zapier credentials from integrations table
      const { data: zapierIntegration, error: integrationError } = await supabase
        .from('integrations')
        .select('credentials, config')
        .eq('ai_instance_id', options.aiInstanceId)
        .eq('type', 'zapier')
        .eq('active', true)
        .single();
      
      if (integrationError || !zapierIntegration) {
        throw new Error('No active Zapier integration found for this AI instance');
      }
      
      const credentials = zapierIntegration.credentials as ZapierCredential;
      const integrationConfig = zapierIntegration.config || {};
      
      if (!credentials || !credentials.webhook_url) {
        throw new Error('Invalid Zapier integration credentials');
      }
      
      // In production, we would call the Zapier webhook with the query
      // The webhook would then trigger a Zap that would fetch relevant data
      // For now, return mock data based on the query and integration config
      
      // Get the list of integrated apps from config
      const integratedApps = integrationConfig.apps || ['Gmail', 'Slack', 'Google Calendar', 'Trello'];
      
      const queryLower = query.toLowerCase();
      let contextData = '';
      let sources = [];
      
      // Simulate different Zapier responses based on query content
      if (queryLower.includes('email') || queryLower.includes('gmail') || queryLower.includes('message')) {
        // Simulate Gmail integration
        const { data: emailData, dataSources } = this.getEmailData();
        contextData = emailData;
        sources = dataSources;
      } 
      else if (queryLower.includes('calendar') || queryLower.includes('meeting') || queryLower.includes('event') || queryLower.includes('schedule')) {
        // Simulate Google Calendar integration
        const { data: calendarData, dataSources } = this.getCalendarData();
        contextData = calendarData;
        sources = dataSources;
      }
      else if (queryLower.includes('task') || queryLower.includes('card') || queryLower.includes('trello') || queryLower.includes('board')) {
        // Simulate Trello integration
        const { data: trelloData, dataSources } = this.getTrelloData();
        contextData = trelloData;
        sources = dataSources;
      }
      else if (queryLower.includes('slack') || queryLower.includes('channel') || queryLower.includes('chat')) {
        // Simulate Slack integration
        const { data: slackData, dataSources } = this.getSlackData();
        contextData = slackData;
        sources = dataSources;
      }
      else {
        // General information about Zapier integrations
        contextData = `
You have the following apps integrated through Zapier:
${integratedApps.map((app: string) => `- ${app}`).join('\n')}

To get specific data, you can ask about:
- Emails (Gmail integration)
- Calendar events (Google Calendar integration)
- Tasks and cards (Trello integration)
- Chat messages (Slack integration)
        `.trim();
        
        sources = [{
          id: 'zapier-integrations-list',
          content: 'List of available Zapier integrations',
          metadata: {
            source: 'zapier',
            type: 'integrations_list',
            integrated_apps: integratedApps,
            webhook_url: '[redacted]'
          }
        }];
      }
      
      // Format the final context
      const formattedContext = `
Information from Zapier integrations:

${contextData}
      `.trim();
      
      return {
        context: formattedContext,
        sources: sources,
        tokenCount: Math.ceil(formattedContext.length / 4) // Rough token estimate
      };
    } catch (error) {
      console.error('Error in Zapier API provider:', error);
      
      // Return a graceful error message
      const errorMessage = `
Unable to retrieve data from Zapier at this time. The Zapier integration may not be set up or there might be an issue with the webhook. Please check your Zapier integration settings.
      `.trim();
      
      return {
        context: errorMessage,
        sources: [],
        tokenCount: Math.ceil(errorMessage.length / 4)
      };
    }
  }
  
  /**
   * Get mock email data for Gmail integration
   */
  private getEmailData(): { data: string, dataSources: any[] } {
    const emailData = `
Recent Emails (Gmail):

- From: product@example.com
  Subject: Your Premium Subscription Confirmation
  Received: Today at 09:15 AM
  Summary: Confirmation of Premium plan subscription renewal. Next billing date is September 1, 2024.
  
- From: meeting@acmecorp.com
  Subject: Meeting Notes: Product Demo
  Received: Yesterday at 03:45 PM
  Summary: Notes from product demo with Acme Corp. They were interested in the enterprise features and requested a follow-up next week.
  
- From: support@cloudservice.io
  Subject: Your Support Ticket #45678 - Status Update
  Received: 2 days ago at 11:20 AM
  Summary: Support ticket regarding API integration issue has been resolved. The technical team implemented a patch.
    `.trim();
    
    const dataSources = [
      {
        id: 'zapier-gmail-emails',
        content: 'Recent email data from Gmail',
        metadata: {
          source: 'zapier',
          type: 'email_data',
          app: 'Gmail',
          last_updated: new Date().toISOString()
        }
      }
    ];
    
    return { data: emailData, dataSources };
  }
  
  /**
   * Get mock calendar data for Google Calendar integration
   */
  private getCalendarData(): { data: string, dataSources: any[] } {
    const calendarData = `
Upcoming Calendar Events:

- Product Planning Meeting
  When: Today at 2:00 PM - 3:00 PM
  Where: Conference Room A / Zoom Link
  Attendees: Marketing Team, Product Team
  Notes: Discuss Q4 roadmap and feature prioritization
  
- Client Demo: XYZ Corporation
  When: Tomorrow at 10:00 AM - 11:30 AM
  Where: Zoom Meeting (link in calendar invite)
  Attendees: Sales Team, John from XYZ Corp
  Notes: Present new dashboard features, prepare technical documentation
  
- Team Weekly Sync
  When: August 4, 2024 at 9:00 AM - 10:00 AM
  Where: Main Office - Meeting Room
  Attendees: All Department Heads
  Notes: Regular sync meeting, come prepared with weekly updates
    `.trim();
    
    const dataSources = [
      {
        id: 'zapier-google-calendar',
        content: 'Upcoming calendar events from Google Calendar',
        metadata: {
          source: 'zapier',
          type: 'calendar_data',
          app: 'Google Calendar',
          last_updated: new Date().toISOString()
        }
      }
    ];
    
    return { data: calendarData, dataSources };
  }
  
  /**
   * Get mock task data for Trello integration
   */
  private getTrelloData(): { data: string, dataSources: any[] } {
    const trelloData = `
Trello Boards and Tasks:

Board: Product Development
- List: To Do
  • Implement dark mode theme (High Priority)
  • Create export to PDF feature (Medium Priority)
  • Fix mobile navigation bug (High Priority)
  
- List: In Progress
  • Optimize database queries (Assigned to: Dev Team)
  • Update user onboarding flow (Assigned to: UX Team)
  
- List: Review
  • New dashboard widgets (Ready for QA testing)
  • Authentication improvements (Awaiting security review)

Board: Marketing
- List: Campaign Ideas
  • Back-to-school promotion
  • Product launch announcement
  
- List: Content Calendar
  • Blog post: "10 Ways to Improve Productivity" (Due: August 10)
  • Case study: Acme Corp Success Story (Due: August 15)
    `.trim();
    
    const dataSources = [
      {
        id: 'zapier-trello-tasks',
        content: 'Task and board data from Trello',
        metadata: {
          source: 'zapier',
          type: 'task_data',
          app: 'Trello',
          last_updated: new Date().toISOString()
        }
      }
    ];
    
    return { data: trelloData, dataSources };
  }
  
  /**
   * Get mock chat data for Slack integration
   */
  private getSlackData(): { data: string, dataSources: any[] } {
    const slackData = `
Recent Slack Messages:

Channel: #general
- Alice (Yesterday at 4:30 PM): "Has everyone submitted their weekly reports?"
- Bob (Yesterday at 4:32 PM): "Just uploaded mine to the shared drive."
- Charlie (Yesterday at 4:45 PM): "I'll have mine done by EOD today."

Channel: #product-team
- Dave (Today at 9:15 AM): "The new feature release will be on August 10th."
- Emma (Today at 9:20 AM): "Have we completed all the QA for the release?"
- Dave (Today at 9:22 AM): "Yes, final testing was completed yesterday."

Channel: #support
- Frank (Today at 10:05 AM): "We're seeing an increase in API-related tickets this week."
- Grace (Today at 10:10 AM): "I've created a KB article to address the common questions."
- Frank (Today at 10:15 AM): "Thanks! That should help reduce the ticket volume."
    `.trim();
    
    const dataSources = [
      {
        id: 'zapier-slack-messages',
        content: 'Recent message data from Slack channels',
        metadata: {
          source: 'zapier',
          type: 'chat_data',
          app: 'Slack',
          last_updated: new Date().toISOString()
        }
      }
    ];
    
    return { data: slackData, dataSources };
  }
}