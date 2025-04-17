/**
 * n8n API Provider
 * 
 * Retrieves context from n8n automation workflows
 */

import { ContextProvider } from '../../contextHandler';

export interface N8nCredentials {
  apiKey: string;
  baseUrl: string;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  workflowName: string;
  startedAt: string;
  finishedAt: string;
  status: 'success' | 'error' | 'running';
  data?: Record<string, any>;
}

export class N8nApiProvider implements ContextProvider {
  private credentials: N8nCredentials | null = null;

  getName(): string {
    return 'n8n';
  }

  /**
   * Set credentials for the n8n API
   * @param credentials - n8n API credentials
   */
  setCredentials(credentials: N8nCredentials): void {
    this.credentials = credentials;
  }

  /**
   * Get context from n8n workflows
   * @param query - User query
   * @param options - Additional options
   * @returns Context information from n8n
   */
  async getContext(query: string, options: any): Promise<{
    context: string;
    sources: any[];
    tokenCount: number;
  }> {
    try {
      if (!this.credentials) {
        console.warn('N8n credentials not configured');
        return this.getMockData(query);
      }

      // In a real implementation, this would make API calls to n8n
      // Example: const workflows = await fetch(`${this.credentials.baseUrl}/api/v1/workflows`, ...);
      
      return this.getMockData(query);
    } catch (error) {
      console.error('Error fetching n8n data:', error);
      return {
        context: 'Error fetching automation data from n8n.',
        sources: [],
        tokenCount: 20
      };
    }
  }

  /**
   * Get mock data for development and testing
   * @param query - User query
   * @returns Mock workflow data
   */
  private getMockData(query: string): {
    context: string;
    sources: any[];
    tokenCount: number;
  } {
    // Sample workflows that might be relevant to the query
    const workflows = [
      {
        id: 'wf1',
        name: 'Lead Generation Workflow',
        description: 'Captures leads from website form and adds them to CRM',
        lastRun: '2023-05-15T10:30:00Z',
        status: 'active'
      },
      {
        id: 'wf2',
        name: 'Customer Support Ticket Processing',
        description: 'Routes support tickets to appropriate teams based on content',
        lastRun: '2023-05-16T14:20:00Z',
        status: 'active'
      },
      {
        id: 'wf3',
        name: 'Social Media Content Scheduler',
        description: 'Schedules and posts content across multiple social platforms',
        lastRun: '2023-05-14T09:15:00Z',
        status: 'active'
      }
    ];

    // Recent workflow runs
    const recentRuns: WorkflowRun[] = [
      {
        id: 'run1',
        workflowId: 'wf1',
        workflowName: 'Lead Generation Workflow',
        startedAt: '2023-05-15T10:30:00Z',
        finishedAt: '2023-05-15T10:31:05Z',
        status: 'success',
        data: {
          leadsProcessed: 12,
          addedToCRM: 10,
          errors: 2
        }
      },
      {
        id: 'run2',
        workflowId: 'wf2',
        workflowName: 'Customer Support Ticket Processing',
        startedAt: '2023-05-16T14:20:00Z',
        finishedAt: '2023-05-16T14:22:30Z',
        status: 'success',
        data: {
          ticketsProcessed: 8,
          routedToSales: 3,
          routedToSupport: 5
        }
      }
    ];

    // Format workflow information into context
    const contextParts = [
      '## n8n Workflow Information\n',
      '### Active Workflows\n'
    ];

    workflows.forEach(wf => {
      contextParts.push(`- ${wf.name}: ${wf.description} (Status: ${wf.status}, Last run: ${new Date(wf.lastRun).toLocaleString()})`);
    });

    contextParts.push('\n### Recent Workflow Runs\n');
    recentRuns.forEach(run => {
      contextParts.push(
        `- ${run.workflowName} (${run.startedAt}): ${run.status}`
      );
      if (run.data) {
        const dataPoints = Object.entries(run.data)
          .map(([key, value]) => `${key}: ${value}`)
          .join(', ');
        contextParts.push(`  Data: ${dataPoints}`);
      }
    });

    return {
      context: contextParts.join('\n'),
      sources: [
        { id: 'n8n-workflows', name: 'n8n Workflows', type: 'automation' }
      ],
      tokenCount: contextParts.join('\n').length / 4 // Approximate token count
    };
  }
}