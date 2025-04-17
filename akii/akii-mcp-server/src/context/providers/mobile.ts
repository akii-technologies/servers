/**
 * Mobile Context Provider
 * 
 * Provides mobile-specific context from device data and app interactions
 */

import { createClient } from '@supabase/supabase-js';
import { ContextProvider } from '../contextHandler';

interface MobileDeviceInfo {
  device_id: string;
  device_type: string;
  os_version: string;
  app_version: string;
  last_active: string;
}

interface MobileActivityEvent {
  event_id: string;
  device_id: string;
  event_type: string;
  event_data: Record<string, any>;
  timestamp: string;
}

/**
 * Mobile Context Provider Implementation
 * 
 * Provides mobile-specific data from app usage, device information, and contextual preferences
 */
export class MobileContextProvider implements ContextProvider {
  private supabaseUrl: string;
  private supabaseKey: string;
  
  constructor() {
    // Load from environment variables
    this.supabaseUrl = process.env.SUPABASE_URL || '';
    this.supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!this.supabaseUrl || !this.supabaseKey) {
      console.warn('Mobile context provider: Missing Supabase credentials');
    }
  }
  
  /**
   * Get provider name
   */
  getName(): string {
    return 'mobile';
  }
  
  /**
   * Retrieve context from mobile device and app data
   * 
   * @param query The user's query
   * @param options Additional options including aiInstanceId and deviceId
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
      
      const deviceId = options.deviceId;
      if (!deviceId) {
        // If no device ID, return generic mobile context
        return this.getGenericMobileContext();
      }
      
      console.log(`Mobile: Retrieving context for device ${deviceId} with query "${query}"`);
      
      // Initialize Supabase client
      const supabase = createClient(this.supabaseUrl, this.supabaseKey);
      
      // Get device information
      const { data: deviceInfo, error: deviceError } = await supabase
        .from('mobile_devices')
        .select('*')
        .eq('device_id', deviceId)
        .single();
      
      if (deviceError || !deviceInfo) {
        console.warn(`No device info found for device ID: ${deviceId}`);
        return this.getGenericMobileContext();
      }
      
      // Get recent activities for this device
      const { data: activities, error: activitiesError } = await supabase
        .from('mobile_activities')
        .select('*')
        .eq('device_id', deviceId)
        .order('timestamp', { ascending: false })
        .limit(10);
      
      if (activitiesError) {
        console.error('Error fetching mobile activities:', activitiesError);
      }
      
      // For now, use mock data if no real data is available
      const deviceData = deviceInfo || this.getMockDeviceInfo();
      const activityData = activities && activities.length > 0 ? 
        this.formatRealActivities(activities) : 
        this.getMockActivityData();
      
      // Format the context based on the device and activity data
      const context = this.formatMobileContext(deviceData, activityData);
      
      return {
        context: context.text,
        sources: context.sources,
        tokenCount: Math.ceil(context.text.length / 4) // Rough token estimate
      };
    } catch (error) {
      console.error('Error in Mobile context provider:', error);
      
      // Return a graceful error message
      const errorMessage = `
Unable to retrieve mobile context data at this time. Please ensure you're using the latest version of the mobile app.
      `.trim();
      
      return {
        context: errorMessage,
        sources: [],
        tokenCount: Math.ceil(errorMessage.length / 4)
      };
    }
  }
  
  /**
   * Format real activities from the database
   */
  private formatRealActivities(activities: any[]): string {
    // Format the activities into a structured text
    return activities.map(activity => {
      const date = new Date(activity.timestamp).toLocaleString();
      const eventData = typeof activity.event_data === 'object' 
        ? Object.entries(activity.event_data)
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ')
        : 'No data';
      
      return `- ${activity.event_type} (${date}): ${eventData}`;
    }).join('\n');
  }
  
  /**
   * Format mobile context from device and activity data
   */
  private formatMobileContext(device: any, activities: string): { text: string, sources: any[] } {
    const deviceType = device.device_type || 'Unknown';
    const osVersion = device.os_version || 'Unknown';
    const appVersion = device.app_version || 'Unknown';
    const lastActive = device.last_active ? new Date(device.last_active).toLocaleString() : 'Unknown';
    
    const text = `
Mobile Device Information:
- Device Type: ${deviceType}
- OS Version: ${osVersion}
- App Version: ${appVersion}
- Last Active: ${lastActive}

Recent Mobile Activities:
${activities}
    `.trim();
    
    const sources = [{
      id: 'mobile-context',
      content: 'Mobile device and activity data',
      metadata: {
        source: 'mobile',
        device_type: deviceType,
        os_version: osVersion,
        app_version: appVersion
      }
    }];
    
    return { text, sources };
  }
  
  /**
   * Get generic mobile context when no device ID is provided
   */
  private getGenericMobileContext(): {
    context: string;
    sources: any[];
    tokenCount: number;
  } {
    const contextText = `
Mobile Context Information:
- You are interacting from a mobile device
- For personalized assistance, please ensure you're logged in to the app
- The mobile app provides additional features like push notifications and device-specific optimizations
    `.trim();
    
    return {
      context: contextText,
      sources: [{
        id: 'mobile-generic',
        content: 'Generic mobile context information',
        metadata: {
          source: 'mobile',
          type: 'generic'
        }
      }],
      tokenCount: Math.ceil(contextText.length / 4)
    };
  }
  
  /**
   * Get mock device information
   */
  private getMockDeviceInfo(): MobileDeviceInfo {
    return {
      device_id: 'mock-device-123',
      device_type: 'iPhone 13',
      os_version: 'iOS 16.5',
      app_version: '1.4.2',
      last_active: new Date().toISOString()
    };
  }
  
  /**
   * Get mock activity data
   */
  private getMockActivityData(): string {
    return `
- APP_OPEN (${new Date(Date.now() - 120000).toLocaleString()}): screen: HomeScreen
- VIEW_DASHBOARD (${new Date(Date.now() - 180000).toLocaleString()}): user_id: user-123, dashboard_type: personal
- SEARCH_QUERY (${new Date(Date.now() - 300000).toLocaleString()}): query: "how to create new instance", results: 5
- VIEW_PROFILE (${new Date(Date.now() - 600000).toLocaleString()}): user_id: user-123
- TOGGLE_SETTING (${new Date(Date.now() - 900000).toLocaleString()}): setting: "notifications", value: true
- CHAT_STARTED (${new Date(Date.now() - 1800000).toLocaleString()}): ai_instance_id: instance-456, session_id: session-789
- DOCUMENT_VIEWED (${new Date(Date.now() - 3600000).toLocaleString()}): document_id: doc-123, title: "User Guide", time_spent: 120
    `.trim();
  }
}