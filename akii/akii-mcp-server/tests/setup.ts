/**
 * Vitest Setup File
 * 
 * Configures the test environment before running tests
 */

import { vi } from 'vitest';

// Mock environment variables
process.env.SUPABASE_URL = 'https://mock-supabase-url.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key';

// Mock modules
vi.mock('../../../../../supabase/modules/lightrag', async () => {
  const actualModule = await import('./mocks/lightrag');
  return actualModule;
});

// Mock fetch for API calls
global.fetch = vi.fn();

// Set up any other global mocks or configuration here