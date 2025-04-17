/**
 * WordPress API Context Provider
 * 
 * Retrieves data from WordPress sites via REST API
 */

import { createClient } from '@supabase/supabase-js';
import { ContextProvider } from '../../contextHandler';

interface WordPressCredential {
  site_url: string;
  api_key?: string;
  username?: string;
  password?: string;
}

/**
 * WordPress API Context Provider Implementation
 * 
 * Provides data from WordPress sites including posts, pages, products, and comments
 */
export class WordPressApiProvider implements ContextProvider {
  private supabaseUrl: string;
  private supabaseKey: string;
  
  constructor() {
    // Load from environment variables
    this.supabaseUrl = process.env.SUPABASE_URL || '';
    this.supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!this.supabaseUrl || !this.supabaseKey) {
      console.warn('WordPress API provider: Missing Supabase credentials');
    }
  }
  
  /**
   * Get provider name
   */
  getName(): string {
    return 'wordpress';
  }
  
  /**
   * Retrieve context from WordPress site
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
      
      console.log(`WordPress API: Retrieving data for AI instance ${options.aiInstanceId} with query "${query}"`);
      
      // Initialize Supabase client
      const supabase = createClient(this.supabaseUrl, this.supabaseKey);
      
      // Get WordPress credentials from integrations table
      const { data: wpIntegration, error: integrationError } = await supabase
        .from('integrations')
        .select('credentials, config')
        .eq('ai_instance_id', options.aiInstanceId)
        .eq('type', 'wordpress')
        .eq('active', true)
        .single();
      
      if (integrationError || !wpIntegration) {
        throw new Error('No active WordPress integration found for this AI instance');
      }
      
      const credentials = wpIntegration.credentials as WordPressCredential;
      const config = wpIntegration.config || {};
      
      if (!credentials || !credentials.site_url) {
        throw new Error('Invalid WordPress integration credentials');
      }
      
      // In production, we would call the WordPress REST API
      // For now, return mock data based on the query
      
      // Determine what WordPress data to retrieve based on the query
      const queryLower = query.toLowerCase();
      let contextData = '';
      let sources = [];
      
      // Check for WooCommerce specific queries
      const hasWooCommerce = config.has_woocommerce === true;
      
      if (hasWooCommerce && (
          queryLower.includes('product') || 
          queryLower.includes('shop') || 
          queryLower.includes('store') || 
          queryLower.includes('price') || 
          queryLower.includes('buy') ||
          queryLower.includes('purchase') ||
          queryLower.includes('order')
        )) {
        const { data: productData, dataSources } = this.getProductData();
        contextData = productData;
        sources = dataSources;
      }
      else if (queryLower.includes('post') || queryLower.includes('article') || queryLower.includes('blog')) {
        const { data: postData, dataSources } = this.getPostData();
        contextData = postData;
        sources = dataSources;
      }
      else if (queryLower.includes('page') || queryLower.includes('about') || queryLower.includes('contact')) {
        const { data: pageData, dataSources } = this.getPageData();
        contextData = pageData;
        sources = dataSources;
      }
      else if (queryLower.includes('comment') || queryLower.includes('feedback') || queryLower.includes('review')) {
        const { data: commentData, dataSources } = this.getCommentData();
        contextData = commentData;
        sources = dataSources;
      }
      else {
        // General WordPress site information
        const siteName = config.site_name || 'WordPress Site';
        const siteDescription = config.site_description || 'A WordPress website';
        
        contextData = `
WordPress Site Information:
- Site Name: ${siteName}
- Description: ${siteDescription}
- URL: ${credentials.site_url}
- WooCommerce Enabled: ${hasWooCommerce ? 'Yes' : 'No'}

Available Content Types:
- Posts: Blog posts and articles
- Pages: Static pages like About Us, Contact, etc.
- ${hasWooCommerce ? 'Products: Items available for purchase in the store' : ''}
- Comments: User feedback and discussions

To get specific data, you can ask about:
- Blog posts or articles
- Specific pages (about, contact, etc.)
${hasWooCommerce ? '- Products, prices, or orders' : ''}
- Comments or reviews
        `.trim();
        
        sources = [{
          id: 'wordpress-site-info',
          content: 'WordPress site information',
          metadata: {
            source: 'wordpress',
            type: 'site_info',
            site_name: siteName,
            site_url: credentials.site_url
          }
        }];
      }
      
      // Format the final context
      const formattedContext = `
Information from WordPress:

${contextData}
      `.trim();
      
      return {
        context: formattedContext,
        sources: sources,
        tokenCount: Math.ceil(formattedContext.length / 4) // Rough token estimate
      };
    } catch (error) {
      console.error('Error in WordPress API provider:', error);
      
      // Return a graceful error message
      const errorMessage = `
Unable to retrieve data from WordPress at this time. The WordPress integration may not be set up correctly or there might be an authentication issue. Please check your WordPress integration settings.
      `.trim();
      
      return {
        context: errorMessage,
        sources: [],
        tokenCount: Math.ceil(errorMessage.length / 4)
      };
    }
  }
  
  /**
   * Get mock post data from WordPress
   */
  private getPostData(): { data: string, dataSources: any[] } {
    const postData = `
Recent Blog Posts:

1. "5 Ways to Optimize Your Website for Better Performance"
   Published: August 25, 2024
   Author: John Smith
   Excerpt: Learn how to improve your website loading times and user experience with these five proven optimization techniques. From image compression to caching strategies, these tips will help your site perform better.
   Categories: Web Development, Performance
   
2. "The Future of E-commerce in 2025"
   Published: August 20, 2024
   Author: Sarah Johnson
   Excerpt: Explore the emerging trends that will shape e-commerce in the coming years. From AI-driven personalization to voice shopping, discover what your business needs to prepare for.
   Categories: E-commerce, Business Strategy
   
3. "Beginner's Guide to Content Marketing"
   Published: August 15, 2024
   Author: Michael Brown
   Excerpt: Start your content marketing journey with this comprehensive guide for beginners. Learn how to create engaging content, distribute it effectively, and measure your success.
   Categories: Marketing, Content Strategy
    `.trim();
    
    const dataSources = [
      {
        id: 'wordpress-posts',
        content: 'Recent blog posts from WordPress',
        metadata: {
          source: 'wordpress',
          type: 'posts',
          post_count: 3,
          last_updated: new Date().toISOString()
        }
      }
    ];
    
    return { data: postData, dataSources };
  }
  
  /**
   * Get mock page data from WordPress
   */
  private getPageData(): { data: string, dataSources: any[] } {
    const pageData = `
WordPress Pages:

1. About Us
   Last Updated: July 15, 2024
   Excerpt: We are a leading digital agency specializing in web development, design, and marketing. Founded in 2015, our team of 25+ professionals has helped over 200 clients achieve their online goals.
   
2. Services
   Last Updated: August 10, 2024
   Excerpt: We offer a comprehensive range of digital services including website development, e-commerce solutions, content marketing, SEO optimization, and social media management. Each service is tailored to your specific needs.
   
3. Contact Us
   Last Updated: June 5, 2024
   Excerpt: Get in touch with our team through our contact form, by email at info@example.com, or by phone at (555) 123-4567. Our office hours are Monday-Friday, 9am-5pm EST.
   
4. Privacy Policy
   Last Updated: May 20, 2024
   Excerpt: Our privacy policy explains how we collect, use, and protect your personal information. We are committed to maintaining the privacy and security of your data in compliance with all relevant regulations.
    `.trim();
    
    const dataSources = [
      {
        id: 'wordpress-pages',
        content: 'Pages from WordPress',
        metadata: {
          source: 'wordpress',
          type: 'pages',
          page_count: 4,
          last_updated: new Date().toISOString()
        }
      }
    ];
    
    return { data: pageData, dataSources };
  }
  
  /**
   * Get mock product data from WooCommerce
   */
  private getProductData(): { data: string, dataSources: any[] } {
    const productData = `
Featured Products (WooCommerce):

1. Premium WordPress Theme
   Price: $59.99
   Category: Themes
   Description: A responsive, customizable WordPress theme perfect for businesses and portfolios. Includes 20+ pre-built page templates, WooCommerce support, and lifetime updates.
   Stock Status: In Stock
   
2. SEO Pro Plugin
   Price: $39.99
   Category: Plugins
   Description: Boost your website's search engine rankings with our comprehensive SEO plugin. Features include keyword analysis, content optimization, and detailed performance reports.
   Stock Status: In Stock
   
3. Website Maintenance Package
   Price: $99.99/month
   Category: Services
   Description: Comprehensive website maintenance service including security updates, performance optimization, content updates, and 24/7 technical support.
   Stock Status: Available
   
4. E-commerce Starter Kit
   Price: $149.99
   Category: Bundles
   Description: Everything you need to launch your online store. Includes a premium WooCommerce theme, essential plugins, and a step-by-step setup guide.
   Stock Status: In Stock (Limited Availability)
    `.trim();
    
    const dataSources = [
      {
        id: 'wordpress-woocommerce-products',
        content: 'WooCommerce products from WordPress',
        metadata: {
          source: 'wordpress',
          type: 'products',
          product_count: 4,
          last_updated: new Date().toISOString()
        }
      }
    ];
    
    return { data: productData, dataSources };
  }
  
  /**
   * Get mock comment data from WordPress
   */
  private getCommentData(): { data: string, dataSources: any[] } {
    const commentData = `
Recent Comments:

1. On "5 Ways to Optimize Your Website for Better Performance"
   User: TechEnthusiast
   Date: August 27, 2024
   Comment: "Great article! I implemented the caching strategies you mentioned and saw a 40% improvement in my site loading times. Would love to see a follow-up post on mobile optimization specifically."
   
2. On "The Future of E-commerce in 2025"
   User: OnlineRetailer
   Date: August 22, 2024
   Comment: "Very insightful analysis. As someone running an e-commerce business, I'm particularly interested in the AI-driven personalization trends. Are there any specific tools you recommend for smaller businesses to get started with this?"
   
3. On "Premium WordPress Theme" (Product)
   User: WebDesigner99
   Date: August 15, 2024
   Rating: ★★★★★ (5/5)
   Review: "This theme is outstanding! The documentation is thorough, the code is clean, and the support team was extremely helpful when I had questions about customization. Highly recommended for professionals and beginners alike."
   
4. On "SEO Pro Plugin" (Product)
   User: MarketingGuru
   Date: August 10, 2024
   Rating: ★★★★☆ (4/5)
   Review: "A solid SEO plugin with great features. The keyword analysis is particularly useful. Only giving 4 stars because the user interface could be more intuitive, but the functionality is excellent."
    `.trim();
    
    const dataSources = [
      {
        id: 'wordpress-comments',
        content: 'Recent comments and reviews from WordPress',
        metadata: {
          source: 'wordpress',
          type: 'comments',
          comment_count: 4,
          last_updated: new Date().toISOString()
        }
      }
    ];
    
    return { data: commentData, dataSources };
  }
}