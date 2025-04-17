/**
 * Shopify API Context Provider
 * 
 * Retrieves product and order information from Shopify stores
 */

import { createClient } from '@supabase/supabase-js';
import { ContextProvider } from '../../contextHandler';

// Define Shopify schema types
interface ShopifyProduct {
  id: string;
  title: string;
  description: string;
  price: string;
  variants: any[];
  status: string;
  tags: string;
  created_at: string;
  updated_at: string;
}

interface ShopifyOrder {
  id: string;
  order_number: string;
  total_price: string;
  customer: {
    first_name: string;
    last_name: string;
    email: string;
  };
  line_items: any[];
  financial_status: string;
  fulfillment_status: string;
  created_at: string;
  updated_at: string;
}

interface ShopifyCredential {
  shop_domain: string;
  api_key: string;
  api_password: string;
  api_version: string;
}

/**
 * Shopify API Context Provider Implementation
 * 
 * Provides product and order data from connected Shopify stores
 */
export class ShopifyApiProvider implements ContextProvider {
  private supabaseUrl: string;
  private supabaseKey: string;
  
  constructor() {
    // Load from environment variables
    this.supabaseUrl = process.env.SUPABASE_URL || '';
    this.supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!this.supabaseUrl || !this.supabaseKey) {
      console.warn('Shopify API provider: Missing Supabase credentials');
    }
  }
  
  /**
   * Get provider name
   */
  getName(): string {
    return 'shopify';
  }
  
  /**
   * Retrieve context from Shopify API
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
      
      console.log(`Shopify API: Retrieving data for AI instance ${options.aiInstanceId} with query "${query}"`);
      
      // Initialize Supabase client
      const supabase = createClient(this.supabaseUrl, this.supabaseKey);
      
      // Get Shopify credentials from integrations table
      const { data: shopifyIntegration, error: integrationError } = await supabase
        .from('integrations')
        .select('credentials')
        .eq('ai_instance_id', options.aiInstanceId)
        .eq('type', 'shopify')
        .eq('active', true)
        .single();
      
      if (integrationError || !shopifyIntegration) {
        throw new Error('No active Shopify integration found for this AI instance');
      }
      
      const credentials = shopifyIntegration.credentials as ShopifyCredential;
      
      if (!credentials || !credentials.shop_domain || !credentials.api_key || !credentials.api_password) {
        throw new Error('Invalid Shopify integration credentials');
      }
      
      // Determine what type of data to fetch based on the query
      const queryLower = query.toLowerCase();
      let contextData: string = '';
      let sources: any[] = [];
      
      // Handle product-related queries
      if (
        queryLower.includes('product') || 
        queryLower.includes('item') || 
        queryLower.includes('merchandise') ||
        queryLower.includes('inventory') ||
        queryLower.includes('stock')
      ) {
        const { products, productSources } = await this.getProductData(credentials);
        contextData = products;
        sources = productSources;
      } 
      // Handle order-related queries
      else if (
        queryLower.includes('order') || 
        queryLower.includes('purchase') || 
        queryLower.includes('shipment') ||
        queryLower.includes('delivery') ||
        queryLower.includes('tracking')
      ) {
        const { orders, orderSources } = await this.getOrderData(credentials);
        contextData = orders;
        sources = orderSources;
      } 
      // Handle general store queries
      else {
        // For general queries, get both products and orders but limit the amount
        const { products, productSources } = await this.getProductData(credentials, 3);
        const { orders, orderSources } = await this.getOrderData(credentials, 3);
        
        contextData = `${products}\n\n${orders}`;
        sources = [...productSources, ...orderSources];
      }
      
      // If we couldn't get any contextual data, provide a fallback message
      if (!contextData) {
        contextData = 'No relevant Shopify data found based on the query.';
      }
      
      // Format the final context
      const formattedContext = `
Information from connected Shopify store (${credentials.shop_domain}):

${contextData}
      `.trim();
      
      return {
        context: formattedContext,
        sources: sources,
        tokenCount: Math.ceil(formattedContext.length / 4) // Rough token estimate
      };
    } catch (error) {
      console.error('Error in Shopify API provider:', error);
      
      // Return a graceful error message
      const errorMessage = `
Unable to retrieve Shopify data at this time. The Shopify integration may not be set up or there might be an issue with the connection. Please check your Shopify integration settings.
      `.trim();
      
      return {
        context: errorMessage,
        sources: [],
        tokenCount: Math.ceil(errorMessage.length / 4)
      };
    }
  }
  
  /**
   * Retrieve product data from Shopify API
   * 
   * @param credentials Shopify API credentials
   * @param limit Number of products to fetch (default: 5)
   * @returns Formatted product data and sources
   */
  private async getProductData(credentials: ShopifyCredential, limit: number = 5): Promise<{ 
    products: string;
    productSources: any[];
  }> {
    try {
      // In a production environment, this would make a real API call to Shopify
      // For now, return mock data
      const mockProducts: ShopifyProduct[] = [
        {
          id: 'gid://shopify/Product/1234567890',
          title: 'Premium Akii Assistant',
          description: 'Our flagship AI assistant with advanced features.',
          price: '99.99',
          variants: [
            { title: 'Standard', price: '99.99' },
            { title: 'Pro', price: '149.99' }
          ],
          status: 'active',
          tags: 'ai, assistant, premium',
          created_at: '2023-09-15T10:00:00Z',
          updated_at: '2024-05-20T14:30:00Z'
        },
        {
          id: 'gid://shopify/Product/2345678901',
          title: 'Akii Business Suite',
          description: 'Complete AI solution for businesses with multiple users.',
          price: '299.99',
          variants: [
            { title: 'Small Team (5 users)', price: '299.99' },
            { title: 'Enterprise (50 users)', price: '999.99' }
          ],
          status: 'active',
          tags: 'business, enterprise, teams',
          created_at: '2023-10-05T09:15:00Z',
          updated_at: '2024-06-10T11:45:00Z'
        },
        {
          id: 'gid://shopify/Product/3456789012',
          title: 'Akii Knowledge Base Plugin',
          description: 'Add domain-specific knowledge to your Akii instance.',
          price: '49.99',
          variants: [],
          status: 'active',
          tags: 'plugin, knowledge, addon',
          created_at: '2024-01-22T16:20:00Z',
          updated_at: '2024-06-30T08:10:00Z'
        }
      ];
      
      // Take only the requested number of products
      const limitedProducts = mockProducts.slice(0, limit);
      
      // Format the products as a string
      const formattedProducts = `
Products:
${limitedProducts.map(product => `
- ${product.title} ($${product.price})
  Description: ${product.description}
  Status: ${product.status}
  Last updated: ${new Date(product.updated_at).toLocaleDateString()}
`).join('')}
      `.trim();
      
      // Create sources for the products
      const productSources = limitedProducts.map(product => ({
        id: `shopify-product-${product.id.split('/').pop()}`,
        content: `${product.title} - $${product.price} - ${product.description}`,
        metadata: {
          source: 'shopify',
          type: 'product',
          id: product.id,
          store: credentials.shop_domain,
          last_updated: product.updated_at
        }
      }));
      
      return {
        products: formattedProducts,
        productSources: productSources
      };
    } catch (error) {
      console.error('Error fetching Shopify products:', error);
      return {
        products: 'Unable to retrieve product information at this time.',
        productSources: []
      };
    }
  }
  
  /**
   * Retrieve order data from Shopify API
   * 
   * @param credentials Shopify API credentials
   * @param limit Number of orders to fetch (default: 5)
   * @returns Formatted order data and sources
   */
  private async getOrderData(credentials: ShopifyCredential, limit: number = 5): Promise<{
    orders: string;
    orderSources: any[];
  }> {
    try {
      // In a production environment, this would make a real API call to Shopify
      // For now, return mock data
      const mockOrders: ShopifyOrder[] = [
        {
          id: 'gid://shopify/Order/1000000001',
          order_number: '1001',
          total_price: '149.99',
          customer: {
            first_name: 'John',
            last_name: 'Doe',
            email: 'john.doe@example.com'
          },
          line_items: [
            { title: 'Akii Premium Assistant Pro', quantity: 1, price: '149.99' }
          ],
          financial_status: 'paid',
          fulfillment_status: 'fulfilled',
          created_at: '2024-06-02T09:15:00Z',
          updated_at: '2024-06-02T09:30:00Z'
        },
        {
          id: 'gid://shopify/Order/1000000002',
          order_number: '1002',
          total_price: '349.98',
          customer: {
            first_name: 'Jane',
            last_name: 'Smith',
            email: 'jane.smith@example.com'
          },
          line_items: [
            { title: 'Akii Premium Assistant Pro', quantity: 1, price: '149.99' },
            { title: 'Akii Knowledge Base Plugin', quantity: 4, price: '49.99' }
          ],
          financial_status: 'paid',
          fulfillment_status: 'partial',
          created_at: '2024-06-05T14:20:00Z',
          updated_at: '2024-06-05T16:45:00Z'
        },
        {
          id: 'gid://shopify/Order/1000000003',
          order_number: '1003',
          total_price: '999.99',
          customer: {
            first_name: 'Corporate',
            last_name: 'Client',
            email: 'procurement@bigcompany.com'
          },
          line_items: [
            { title: 'Akii Business Suite Enterprise', quantity: 1, price: '999.99' }
          ],
          financial_status: 'pending',
          fulfillment_status: 'unfulfilled',
          created_at: '2024-06-10T11:30:00Z',
          updated_at: '2024-06-10T11:30:00Z'
        }
      ];
      
      // Take only the requested number of orders
      const limitedOrders = mockOrders.slice(0, limit);
      
      // Format the orders as a string
      const formattedOrders = `
Recent Orders:
${limitedOrders.map(order => `
- Order #${order.order_number} ($${order.total_price})
  Customer: ${order.customer.first_name} ${order.customer.last_name}
  Status: ${order.financial_status} (${order.fulfillment_status})
  Date: ${new Date(order.created_at).toLocaleDateString()}
  Items: ${order.line_items.map(item => `${item.title} x${item.quantity}`).join(', ')}
`).join('')}
      `.trim();
      
      // Create sources for the orders
      const orderSources = limitedOrders.map(order => ({
        id: `shopify-order-${order.id.split('/').pop()}`,
        content: `Order #${order.order_number} - $${order.total_price} - ${order.customer.first_name} ${order.customer.last_name} - ${order.financial_status}/${order.fulfillment_status}`,
        metadata: {
          source: 'shopify',
          type: 'order',
          id: order.id,
          store: credentials.shop_domain,
          date: order.created_at
        }
      }));
      
      return {
        orders: formattedOrders,
        orderSources: orderSources
      };
    } catch (error) {
      console.error('Error fetching Shopify orders:', error);
      return {
        orders: 'Unable to retrieve order information at this time.',
        orderSources: []
      };
    }
  }
}